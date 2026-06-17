import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import type { User } from '@clarbit/database';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    // Tell passport to use `email` field instead of the default `username`
    super({ usernameField: 'email', passwordField: 'password', passReqToCallback: false });
  }

  /** Called by LocalAuthGuard. Returns the validated User or throws. */
  async validate(email: string, password: string): Promise<User> {
    return this.authService.validateCredentials(email, password);
  }
}
