import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as OTPLib from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../database/prisma.service';
import { TokenService } from './token.service';
import { AuditService } from '../audit/audit.service';
import {
  hashPassword,
  verifyPassword,
  encrypt,
  decrypt,
  hashToken,
  generateBackupCodes,
} from '../common/utils/crypto.util';
import type { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuditAction, type User } from '@onemdr/database';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
// Short-lived JWT used to bridge the MFA challenge step
const MFA_TOKEN_TTL = '10m';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly encKey: string;
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.encKey = config.getOrThrow<string>('ENCRYPTION_KEY');
    this.appName = config.get<string>('APP_NAME', 'OneMDR');
  }

  // ── Registration ─────────────────────────────────────────────────────────────

  async register(
    dto: RegisterDto,
    meta: { ip?: string; device?: string },
  ): Promise<{ accessToken: string; rawRefreshToken: string; user: SafeUser }> {
    // 1. Derive a URL-safe tenant slug
    const slug = this.toSlug(dto.tenantName);

    // 2. Ensure slug is unique
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Organisation slug "${slug}" is already taken`);
    }

    // 3. Hash password with Argon2id
    const passwordHash = await hashPassword(dto.password);

    // 4. Create tenant + owner user atomically
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.tenantName,
        slug,
        users: {
          create: {
            email: dto.email.toLowerCase().trim(),
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            passwordHash,
            role: 'OWNER',
            emailVerified: false,
            lastLoginAt: new Date(),
            lastLoginIp: meta.ip,
          },
        },
      },
      include: { users: true },
    });

    const user = tenant.users[0];

    // 5. Issue tokens
    const payload = this.buildPayload(user);
    const accessToken = this.tokens.generateAccessToken(payload);
    const rawRefreshToken = await this.tokens.issueRefreshToken(user.id, meta);

    // 6. Audit log (async, non-blocking)
    this.emitter.emit('audit.log', {
      tenantId: tenant.id,
      actorId: user.id,
      action: AuditAction.AUTH_REGISTER,
      resource: 'user',
      resourceId: user.id,
      metadata: { email: user.email },
      ipAddress: meta.ip,
    });

    return { accessToken, rawRefreshToken, user: this.sanitize(user) };
  }

  // ── Credential validation (called by LocalStrategy) ─────────────────────────

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
    });

    // Generic error — never reveal whether email exists
    const invalid = () => new UnauthorizedException('Invalid email or password');

    if (!user || !user.passwordHash) throw invalid();

    // Account lockout check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`Account locked. Try again in ${mins} minute(s).`);
    }

    const valid = await verifyPassword(user.passwordHash, password);

    if (!valid) {
      const attempts = user.loginAttempts + 1;
      const lockedUntil =
        attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: attempts, lockedUntil },
      });

      throw invalid();
    }

    // Reset attempt counter on successful validation
    if (user.loginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null },
      });
    }

    return user;
  }

  // ── Login (called by AuthController after LocalStrategy succeeds) ────────────

  async login(
    user: User,
    meta: { ip?: string; device?: string; rememberMe?: boolean },
  ): Promise<
    | { requiresMfa: true; mfaToken: string }
    | { accessToken: string; rawRefreshToken: string; user: SafeUser }
  > {
    // If MFA is enabled → return a short-lived token for the challenge step
    if (user.mfaEnabled) {
      const mfaToken = this.jwt.sign(
        { sub: user.id, mfaChallenge: true } as unknown as JwtPayload,
        { expiresIn: MFA_TOKEN_TTL },
      );
      return { requiresMfa: true, mfaToken };
    }

    return this.issueSession(user, meta);
  }

  // ── Complete MFA login ───────────────────────────────────────────────────────

  async loginWithMfa(
    mfaToken: string,
    totpCode: string,
    meta: { ip?: string; device?: string; rememberMe?: boolean },
  ): Promise<{ accessToken: string; rawRefreshToken: string; user: SafeUser }> {
    let payload: { sub: string; mfaChallenge: boolean };
    try {
      payload = this.jwt.verify<{ sub: string; mfaChallenge: boolean }>(mfaToken);
    } catch {
      throw new UnauthorizedException('MFA session expired — please log in again');
    }

    if (!payload.mfaChallenge) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
    });

    await this.verifyTotpCode(user, totpCode);

    return this.issueSession(user, meta);
  }

  // ── Refresh ──────────────────────────────────────────────────────────────────

  async refresh(
    rawRefreshToken: string,
    meta: { ip?: string; device?: string },
  ): Promise<{ accessToken: string; rawRefreshToken: string }> {
    const { newRawToken, userId } = await this.tokens.rotateRefreshToken(rawRefreshToken, meta);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const accessToken = this.tokens.generateAccessToken(this.buildPayload(user));

    this.emitter.emit('audit.log', {
      tenantId: user.tenantId,
      actorId: user.id,
      action: AuditAction.AUTH_REFRESH_REVOKED,
      ipAddress: meta.ip,
    });

    return { accessToken, rawRefreshToken: newRawToken };
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  async logout(
    userId: string,
    rawRefreshToken: string | undefined,
    meta: { ip?: string },
  ): Promise<void> {
    if (rawRefreshToken) {
      await this.tokens.revokeRefreshToken(rawRefreshToken);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      this.emitter.emit('audit.log', {
        tenantId: user.tenantId,
        actorId: user.id,
        action: AuditAction.AUTH_LOGOUT,
        ipAddress: meta.ip,
      });
    }
  }

  // ── MFA: Setup (generate secret + QR code) ──────────────────────────────────

  async setupMfa(userId: string): Promise<{ qrDataUrl: string; backupCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) {
      throw new ConflictException('MFA is already enabled');
    }

    const secret = OTPLib.authenticator.generateSecret();
    const encSecret = encrypt(secret, this.encKey);
    const otpAuthUrl = OTPLib.authenticator.keyuri(user.email, this.appName, secret);
    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Store encrypted secret but don't enable yet — user must verify first
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: encSecret },
    });

    // Generate 10 backup codes; hash them before storing
    const rawCodes = generateBackupCodes(10);
    const hashedCodes = rawCodes.map(hashToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: hashedCodes },
    });

    // Return plain codes once — user must save them
    return { qrDataUrl, backupCodes: rawCodes };
  }

  // ── MFA: Enable (confirm setup by verifying first TOTP) ─────────────────────

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

  // ── MFA: Disable ─────────────────────────────────────────────────────────────

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

  // ── Google OAuth: find or create ─────────────────────────────────────────────

  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  }): Promise<User> {
    // Try to find by googleId first
    const byGoogleId = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    if (byGoogleId) return byGoogleId;

    // Try to find by email (link account)
    const byEmail = await this.prisma.user.findFirst({
      where: { email: profile.email.toLowerCase(), deletedAt: null },
    });
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId: profile.googleId, avatarUrl: profile.avatarUrl },
      });
    }

    // New user + new tenant
    const slug = this.toSlug(profile.email.split('@')[1] ?? profile.firstName);
    const unique = await this.uniqueSlug(slug);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: `${profile.firstName}'s Workspace`,
        slug: unique,
        users: {
          create: {
            email: profile.email.toLowerCase(),
            firstName: profile.firstName,
            lastName: profile.lastName,
            avatarUrl: profile.avatarUrl,
            googleId: profile.googleId,
            role: 'OWNER',
            emailVerified: true, // Google has verified the email
          },
        },
      },
      include: { users: true },
    });

    return tenant.users[0];
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async issueSession(
    user: User,
    meta: { ip?: string; device?: string; rememberMe?: boolean },
  ): Promise<{ accessToken: string; rawRefreshToken: string; user: SafeUser }> {
    const payload = this.buildPayload(user);
    const accessToken = this.tokens.generateAccessToken(payload);
    const rawRefreshToken = await this.tokens.issueRefreshToken(user.id, meta);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: meta.ip },
    });

    this.emitter.emit('audit.log', {
      tenantId: user.tenantId,
      actorId: user.id,
      action: AuditAction.AUTH_LOGIN,
      ipAddress: meta.ip,
    });

    return { accessToken, rawRefreshToken, user: this.sanitize(user) };
  }

  private async verifyTotpCode(user: User, code: string): Promise<void> {
    if (!user.mfaSecret) {
      throw new BadRequestException('MFA is not configured for this account');
    }
    const secret = decrypt(user.mfaSecret, this.encKey);
    const isValid = OTPLib.authenticator.check(code, secret);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired TOTP code');
    }
  }

  private buildPayload(user: User): JwtPayload {
    return {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };
  }

  private sanitize(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      avatarUrl: user.avatarUrl ?? undefined,
      mfaEnabled: user.mfaEnabled,
    };
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 50);
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let i = 0;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${base}-${++i}`;
    }
    return slug;
  }
}

// ── Minimal safe user shape returned to clients ──────────────────────────────
export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  avatarUrl?: string;
  mfaEnabled: boolean;
}
