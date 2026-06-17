import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Triggers LocalStrategy.validate() — use on POST /auth/login. */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
