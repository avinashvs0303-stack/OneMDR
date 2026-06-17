import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Initiates / handles Google OAuth2 flow. */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
