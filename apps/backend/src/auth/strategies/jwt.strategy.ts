import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload, SupabaseJwtPayload } from '../interfaces/jwt-payload.interface';
import type { UserRole } from '@onemdr/database';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Supabase JWT secret — found at: Dashboard → Settings → API → JWT Settings
      secretOrKey: config.getOrThrow<string>('SUPABASE_JWT_SECRET'),
      // Supabase JWTs always have aud: 'authenticated'
      audience: 'authenticated',
    });
  }

  validate(payload: SupabaseJwtPayload): JwtPayload {
    const appMeta = payload.app_metadata ?? {};

    // app_metadata is only writable by service_role — safe to trust for auth decisions.
    // user_metadata is writable by the user — never used for auth decisions.
    const userId = appMeta['user_id'] as string | undefined;
    const tenantId = appMeta['tenant_id'] as string | undefined;
    const appRole = appMeta['app_role'] as string | undefined;

    if (!tenantId || !appRole) {
      // User exists in Supabase Auth but has no tenant provisioned yet.
      // This happens if someone signs up via OAuth without being invited first.
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
