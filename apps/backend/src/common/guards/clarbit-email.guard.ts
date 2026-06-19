import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const ALLOWED_DOMAIN = 'clarbit.com';

@Injectable()
export class ClarbitEmailGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Skip for @Public() routes (e.g., POST /tenant-requests submit)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: JwtPayload }>();
    const email = req.user?.email ?? '';

    if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      throw new ForbiddenException('Access restricted to Clarbit staff');
    }

    return true;
  }
}
