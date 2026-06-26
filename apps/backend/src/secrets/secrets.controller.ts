import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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

  @ApiBearerAuth('access-token')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'GUEST')
  @Post()
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateSecretDto) {
    return this.svc.createSecret(u, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'GUEST')
  @Get()
  list(@CurrentUser() u: JwtPayload) {
    return this.svc.listSecrets(u);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'GUEST')
  @Delete(':id')
  revoke(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.revokeSecret(u, id);
  }

  // ── Public: peek metadata + view (burns the secret) ──────────────────────────

  @Public()
  @Get('peek/:token')
  peek(@Param('token') token: string) {
    return this.svc.peekSecret(token);
  }

  @Public()
  @Post('view/:token')
  @HttpCode(HttpStatus.OK)
  view(@Param('token') token: string, @Body() dto: ViewSecretDto) {
    return this.svc.viewSecret(token, dto);
  }
}
