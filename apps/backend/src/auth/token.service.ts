import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { generateSecureToken, hashToken } from '../common/utils/crypto.util';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

const COOKIE_NAME = 'refresh_token';
const TOKEN_BYTES = 48;
const DEFAULT_TTL_S = 7 * 24 * 3600; // 7 days
const REMEMBER_TTL_S = 30 * 24 * 3600; // 30 days

@Injectable()
export class TokenService {
  private readonly isProd: boolean;
  private readonly defaultTtl: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.isProd = config.get<string>('NODE_ENV') === 'production';
    this.defaultTtl = this.parseDuration(config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'));
  }

  // ── Access token ────────────────────────────────────────────────────────────

  generateAccessToken(payload: JwtPayload): string {
    return this.jwt.sign(payload);
  }

  // ── Refresh token ───────────────────────────────────────────────────────────

  /** Issue a brand-new refresh token (new family). Used on first login/register. */
  async issueRefreshToken(
    userId: string,
    meta: { ip?: string; device?: string; rememberMe?: boolean },
  ): Promise<string> {
    const { v4: uuid } = await import('uuid');
    const familyId = uuid();
    return this.createToken(userId, familyId, meta);
  }

  /**
   * Rotate an existing refresh token:
   * 1. Verify it exists and is not revoked/expired.
   * 2. Revoke the old token.
   * 3. Issue a new token in the same family.
   * If a revoked token is re-presented → entire family is revoked (theft detection).
   */
  async rotateRefreshToken(
    rawToken: string,
    meta: { ip?: string; device?: string },
  ): Promise<{ newRawToken: string; userId: string }> {
    const tokenHash = hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      // Reuse detected — revoke entire family immediately
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected — session revoked');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // Issue new token in the same family (maintains session lineage)
    const newRaw = await this.createToken(stored.userId, stored.familyId, meta);
    return { newRawToken: newRaw, userId: stored.userId };
  }

  /** Revoke a specific refresh token on logout. */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke ALL refresh tokens for a user (force sign-out all devices). */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Cookie helpers ───────────────────────────────────────────────────────────

  buildCookieOptions(rememberMe = false): Record<string, unknown> {
    const maxAge = rememberMe ? REMEMBER_TTL_S : DEFAULT_TTL_S;
    return {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'strict' : 'lax',
      maxAge,
      path: '/',
    };
  }

  clearCookieOptions(): Record<string, unknown> {
    return {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'strict' : 'lax',
      maxAge: 0,
      path: '/',
    };
  }

  get cookieName(): string {
    return COOKIE_NAME;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async createToken(
    userId: string,
    familyId: string,
    meta: { ip?: string; device?: string; rememberMe?: boolean },
  ): Promise<string> {
    const raw = generateSecureToken(TOKEN_BYTES);
    const tokenHash = hashToken(raw);
    const ttl = meta.rememberMe ? REMEMBER_TTL_S : this.defaultTtl;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId,
        expiresAt,
        ipAddress: meta.ip,
        deviceInfo: meta.device,
      },
    });

    return raw;
  }

  private parseDuration(s: string): number {
    const m = /^(\d+)([smhd])$/.exec(s);
    if (!m) return DEFAULT_TTL_S;
    const n = parseInt(m[1], 10);
    return n * ({ s: 1, m: 60, h: 3600, d: 86400 }[m[2]] ?? 1);
  }
}
