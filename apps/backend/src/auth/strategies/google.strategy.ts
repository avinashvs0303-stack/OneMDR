import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type VerifyCallback, type Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import type { User } from '@onemdr/database';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID', 'not-configured'),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET', 'not-configured'),
      callbackURL: config.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:3001/api/v1/auth/google/callback',
      ),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    const googleId = profile.id;
    const firstName = profile.name?.givenName ?? '';
    const lastName = profile.name?.familyName ?? '';
    const avatarUrl = profile.photos?.[0]?.value;

    if (!email) {
      done(new Error('Google account has no email address'), undefined);
      return;
    }

    try {
      const user: User = await this.authService.findOrCreateGoogleUser({
        googleId,
        email,
        firstName,
        lastName,
        avatarUrl,
      });
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
