import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { SecretsService } from './secrets.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateSecretDto, ViewSecretDto } from './dto/secrets.dto';

@ApiTags('secrets')
@Controller('secrets')
export class SecretsController {
  constructor(private readonly svc: SecretsService) {}

  // ── Authenticated: create / list / revoke ────────────────────────────────────

  // Gap 5 fix: GUEST role excluded — only MEMBER+ can create or revoke secrets.
  // GUESTs are read-only observers and should not be able to exfiltrate data
  // via one-time links sent outside the tenant.
  @ApiBearerAuth('access-token')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @Post()
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateSecretDto) {
    return this.svc.createSecret(u, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @Get()
  list(@CurrentUser() u: JwtPayload) {
    return this.svc.listSecrets(u);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @Delete(':id')
  revoke(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.revokeSecret(u, id);
  }

  // ── Public: peek metadata + view (burns the secret) ──────────────────────────

  // Gap 2 fix: tight per-IP throttle on public endpoints.
  // 20 peek/min is generous for legitimate use; 256-bit token space makes
  // brute-force computationally infeasible regardless.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Get('peek/:token')
  peek(@Param('token') token: string) {
    return this.svc.peekSecret(token);
  }

  // Gap 2 fix: 5 view attempts per minute per IP is enough for any legitimate
  // recipient; aggressive enough to stop credential-stuffing style attacks.
  // Gap 3 fix: passes client IP to service for structured audit logging.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('view/:token')
  @HttpCode(HttpStatus.OK)
  view(@Param('token') token: string, @Body() dto: ViewSecretDto, @Req() req: FastifyRequest) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return this.svc.viewSecret(token, dto, ip);
  }
}
