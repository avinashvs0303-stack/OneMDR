import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';
import type { JwtPayload, SupabaseJwtPayload } from '../interfaces/jwt-payload.interface';
import type { UserRole } from '@onemdr/database';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL');
    // Supabase now signs JWTs with ES256 (asymmetric). Verify against the public JWKS
    // rather than the legacy symmetric secret.
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }),
      audience: 'authenticated',
      algorithms: ['ES256', 'RS256'],
    });
  }

  validate(payload: SupabaseJwtPayload): JwtPayload {
    const appMeta = payload.app_metadata ?? {};

    // app_metadata is only writable by service_role — safe to trust for auth decisions.
    // user_metadata is writable by the user — never used for auth decisions.
    const userId = appMeta['user_id'] as string | undefined;
    const tenantId = appMeta['tenant_id'] as string | undefined;
    const appRole = appMeta['app_role'] as string | undefined;

    if (!appRole) {
      throw new UnauthorizedException(
        'Account not provisioned. Please contact your administrator.',
      );
    }

    // SUPER_ADMIN is vendor-level — no tenant scoping required
    if (appRole !== 'SUPER_ADMIN' && !tenantId) {
      throw new UnauthorizedException(
        'Account not provisioned. Please contact your administrator.',
      );
    }

    return {
      sub: userId ?? payload.sub, // Our users.id (preferred) or Supabase UUID fallback
      supabaseId: payload.sub, // Always the raw Supabase auth user UUID
      tenantId,
      role: appRole as UserRole,
      email: payload.email,
    };
  }
}
