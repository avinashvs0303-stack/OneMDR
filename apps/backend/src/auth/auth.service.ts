import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

// otplib v13 CJS declarations don't expose named exports — use require
const { authenticator } = require('otplib') as {
  authenticator: {
    generateSecret(): string;
    keyuri(accountName: string, service: string, secret: string): string;
    check(token: string, secret: string): boolean;
  };
};
import * as QRCode from 'qrcode';
import { PrismaService } from '../database/prisma.service';
import { encrypt, decrypt, hashToken, generateBackupCodes } from '../common/utils/crypto.util';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuditAction } from '@onemdr/database';

const MFA_TOKEN_TTL = '10m';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly encKey: string;
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.encKey = config.getOrThrow<string>('ENCRYPTION_KEY');
    this.appName = config.get<string>('APP_NAME', 'OneMDR');
  }

  // ── Current user ─────────────────────────────────────────────────────────────

  /**
   * Returns the full user profile from our DB, looked up by supabase_uid.
   * Called by GET /auth/me after JWT verification.
   */
  async getMe(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: payload.sub }, { supabaseUid: payload.supabaseId }],
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        avatarUrl: true,
        mfaEnabled: true,
        tenant: { select: { name: true, plan: true, slug: true } },
      },
    });

    return user;
  }

  // ── MFA: Setup ──────────────────────────────────────────────────────────────

  async setupMfa(userId: string): Promise<{ qrDataUrl: string; backupCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) {
      throw new ConflictException('MFA is already enabled');
    }

    const secret = authenticator.generateSecret();
    const encSecret = encrypt(secret, this.encKey);
    const otpAuthUrl = authenticator.keyuri(user.email, this.appName, secret);
    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: encSecret },
    });

    const rawCodes = generateBackupCodes(10);
    const hashedCodes = rawCodes.map(hashToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: hashedCodes },
    });

    return { qrDataUrl, backupCodes: rawCodes };
  }

  // ── MFA: Enable ─────────────────────────────────────────────────────────────

  async enableMfa(userId: string, totpCode: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.verifyTotpCode(user, totpCode);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    this.emitter.emit('audit.log', {
      tenantId: user.tenantId,
      actorId: user.id,
      action: AuditAction.AUTH_MFA_ENABLED,
    });
  }

  // ── MFA: Disable ────────────────────────────────────────────────────────────

  async disableMfa(userId: string, totpCode: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.verifyTotpCode(user, totpCode);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
    });

    this.emitter.emit('audit.log', {
      tenantId: user.tenantId,
      actorId: user.id,
      action: AuditAction.AUTH_MFA_DISABLED,
    });
  }

  // ── MFA: Issue a short-lived bridge token for the MFA challenge step ─────────

  issueMfaBridgeToken(userId: string): string {
    return this.jwt.sign({ sub: userId, mfaChallenge: true } as unknown as JwtPayload, {
      expiresIn: MFA_TOKEN_TTL,
    });
  }

  // ── MFA: Complete challenge ───────────────────────────────────────────────────

  async completeMfaChallenge(mfaToken: string, totpCode: string): Promise<{ userId: string }> {
    let payload: { sub: string; mfaChallenge: boolean };
    try {
      payload = this.jwt.verify<{ sub: string; mfaChallenge: boolean }>(mfaToken);
    } catch {
      throw new UnauthorizedException('MFA session expired — please log in again');
    }

    if (!payload.mfaChallenge) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    await this.verifyTotpCode(user, totpCode);

    this.emitter.emit('audit.log', {
      tenantId: user.tenantId,
      actorId: user.id,
      action: AuditAction.AUTH_LOGIN,
    });

    return { userId: user.id };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async verifyTotpCode(
    user: { mfaSecret: string | null; id: string },
    code: string,
  ): Promise<void> {
    if (!user.mfaSecret) {
      throw new BadRequestException('MFA is not configured for this account');
    }
    const secret = decrypt(user.mfaSecret, this.encKey);
    const isValid = authenticator.check(code, secret);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired TOTP code');
    }
  }

  // ── Update own profile ──────────────────────────────────────────────────────

  async updateMe(
    payload: JwtPayload,
    dto: { firstName?: string; lastName?: string; timezone?: string },
  ) {
    return this.prisma.user.update({
      where: { id: payload.sub },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        avatarUrl: true,
        mfaEnabled: true,
        timezone: true,
        tenant: { select: { name: true, plan: true, slug: true } },
      },
    });
  }

  // ── List tenant members ─────────────────────────────────────────────────────

  async getMembers(payload: JwtPayload) {
    return this.prisma.user.findMany({
      where: { tenantId: payload.tenantId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }

  // ── Tenant settings ─────────────────────────────────────────────────────────

  async getTenant(payload: JwtPayload) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: payload.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        tenantType: true,
        isActive: true,
        maxUsers: true,
        licenseModules: true,
        licenseExpiresAt: true,
        mfaEnforced: true,
        _count: { select: { users: { where: { deletedAt: null } } } },
      },
    });
  }

  async updateTenant(payload: JwtPayload, dto: { name?: string; mfaEnforced?: boolean }) {
    if (!['OWNER', 'ADMIN'].includes(payload.role)) {
      throw new ForbiddenException('Only OWNER or ADMIN can update workspace settings');
    }
    return this.prisma.tenant.update({
      where: { id: payload.tenantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.mfaEnforced !== undefined && { mfaEnforced: dto.mfaEnforced }),
      },
      select: { id: true, name: true, slug: true, plan: true, mfaEnforced: true },
    });
  }

  // ── Tenant activity feed ────────────────────────────────────────────────────

  async getActivity(payload: JwtPayload, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { tenantId: payload.tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        metadata: true,
        createdAt: true,
        actor: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
      },
    });
  }
}
