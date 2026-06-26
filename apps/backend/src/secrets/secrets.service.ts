import {
  Injectable,
  NotFoundException,
  GoneException,
  ForbiddenException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@onemdr/database';
import { PrismaService } from '../database/prisma.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type { CreateSecretDto, ViewSecretDto } from './dto/secrets.dto';

const ALGO = 'aes-256-gcm';

function p2021(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2021' || e.code === 'P2010')
  );
}

@Injectable()
export class SecretsService {
  private readonly masterKey: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.masterKey = this.config.get<string>('ENCRYPTION_KEY')!;
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  // ── Crypto helpers ──────────────────────────────────────────────────────────

  private deriveKey(rawToken: string): Buffer {
    return createHash('sha256').update(`${rawToken}:${this.masterKey}`).digest();
  }

  private encrypt(plaintext: string, key: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, key, iv);
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: data.toString('base64'),
    });
  }

  private decrypt(blob: string, key: Buffer): string {
    const parsed = JSON.parse(blob) as { iv: string; tag: string; data: string };
    const decipher = createDecipheriv(ALGO, key, Buffer.from(parsed.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(parsed.data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private hashPassphrase(passphrase: string, salt: string): string {
    return scryptSync(passphrase, salt, 32).toString('hex');
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async createSecret(user: JwtPayload, dto: CreateSecretDto) {
    const rawToken = randomBytes(32).toString('base64url');
    const key = this.deriveKey(rawToken);
    const encryptedBlob = this.encrypt(dto.content, key);
    const ttl = dto.ttlSeconds ?? 86400;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    let passphraseHash: string | null = null;
    if (dto.passphrase) {
      passphraseHash = this.hashPassphrase(dto.passphrase, this.hashToken(rawToken));
    }

    try {
      const record = await this.prisma.sharedSecret.create({
        data: {
          tenantId: user.tenantId ?? null,
          creatorId: user.sub,
          creatorName: `User ${user.sub.slice(0, 6)}`,
          label: dto.label ?? null,
          tokenHash: this.hashToken(rawToken),
          encryptedBlob,
          hasPassphrase: Boolean(dto.passphrase),
          passphraseHash,
          ttlSeconds: ttl,
          expiresAt,
        },
      });

      return {
        id: record.id,
        shareUrl: `${this.frontendUrl}/s/${rawToken}`,
        expiresAt: record.expiresAt,
        hasPassphrase: record.hasPassphrase,
        label: record.label,
      };
    } catch (e) {
      if (p2021(e))
        throw new ServiceUnavailableException(
          'Secrets table not found. Run migration 20260626000001_shared_secrets.',
        );
      throw e;
    }
  }

  async viewSecret(rawToken: string, dto: ViewSecretDto) {
    const hash = this.hashToken(rawToken);

    let record;
    try {
      record = await this.prisma.sharedSecret.findUnique({ where: { tokenHash: hash } });
    } catch (e) {
      if (p2021(e))
        throw new ServiceUnavailableException(
          'Secrets table not found. Run migration 20260626000001_shared_secrets.',
        );
      throw e;
    }

    if (!record) throw new NotFoundException('Secret not found or already burned');
    if (record.isRevoked) throw new GoneException('This secret has been revoked');
    if (record.viewedAt) throw new GoneException('This secret has already been viewed');
    if (new Date() > record.expiresAt) throw new GoneException('This secret has expired');

    if (record.hasPassphrase) {
      if (!dto.passphrase) throw new UnauthorizedException('Passphrase required');
      const expected = this.hashPassphrase(dto.passphrase, hash);
      const expectedBuf = Buffer.from(expected, 'hex');
      const actualBuf = Buffer.from(record.passphraseHash ?? '', 'hex');
      if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
        throw new ForbiddenException('Incorrect passphrase');
      }
    }

    // Burn on read
    await this.prisma.sharedSecret.update({
      where: { id: record.id },
      data: { viewedAt: new Date() },
    });

    const key = this.deriveKey(rawToken);
    const plaintext = this.decrypt(record.encryptedBlob, key);

    return {
      content: plaintext,
      label: record.label,
      creatorName: record.creatorName,
      createdAt: record.createdAt,
    };
  }

  async peekSecret(rawToken: string) {
    const hash = this.hashToken(rawToken);
    let record;
    try {
      record = await this.prisma.sharedSecret.findUnique({ where: { tokenHash: hash } });
    } catch (e) {
      if (p2021(e)) throw new ServiceUnavailableException('Secrets table not found.');
      throw e;
    }
    if (!record) throw new NotFoundException('Secret not found or already burned');

    const expired = new Date() > record.expiresAt;
    const burned = Boolean(record.viewedAt) || record.isRevoked || expired;

    return {
      label: record.label,
      hasPassphrase: record.hasPassphrase,
      expiresAt: record.expiresAt,
      burned,
      burnReason: record.viewedAt
        ? 'viewed'
        : record.isRevoked
          ? 'revoked'
          : expired
            ? 'expired'
            : null,
    };
  }

  async listSecrets(user: JwtPayload) {
    try {
      return await this.prisma.sharedSecret.findMany({
        where: { tenantId: user.tenantId ?? undefined, creatorId: user.sub },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          label: true,
          hasPassphrase: true,
          ttlSeconds: true,
          expiresAt: true,
          viewedAt: true,
          isRevoked: true,
          createdAt: true,
        },
        take: 100,
      });
    } catch (e) {
      if (p2021(e))
        throw new ServiceUnavailableException(
          'Secrets table not found. Run migration 20260626000001_shared_secrets.',
        );
      throw e;
    }
  }

  async revokeSecret(user: JwtPayload, id: string) {
    const record = await this.prisma.sharedSecret.findFirst({
      where: { id, creatorId: user.sub },
    });
    if (!record) throw new NotFoundException('Secret not found');
    await this.prisma.sharedSecret.update({ where: { id }, data: { isRevoked: true } });
    return { revoked: true };
  }
}
