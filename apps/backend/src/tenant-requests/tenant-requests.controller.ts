import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { TenantRequestsService } from './tenant-requests.service';
import { SubmitTenantRequestDto } from './dto/submit-tenant-request.dto';
import { ApproveTenantRequestDto, RejectTenantRequestDto } from './dto/approve-tenant-request.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClarbitEmailGuard } from '../common/guards/clarbit-email.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type { FastifyRequest } from 'fastify';
import { Req } from '@nestjs/common';

@ApiTags('tenant-requests')
@Controller('tenant-requests')
@UseGuards(RolesGuard, ClarbitEmailGuard)
export class TenantRequestsController {
  constructor(private readonly svc: TenantRequestsService) {}

  // ── Public: submit application ────────────────────────────────────────────

  @Public()
  @SkipThrottle()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new tenant access request (public)' })
  async submit(@Body() dto: SubmitTenantRequestDto, @Req() req: FastifyRequest) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
    const device = req.headers['user-agent'];
    const result = await this.svc.submit(dto, { ip, device });
    return {
      data: {
        id: result.id,
        status: result.status,
        contactEmail: result.contactEmail,
        message: 'Your application has been received. We will review it and be in touch shortly.',
      },
    };
  }

  // ── Super Admin: list all requests ────────────────────────────────────────

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiOperation({ summary: 'List tenant requests (super admin only)' })
  async findAll(@Query('status') status?: string) {
    const data = await this.svc.findAll(status);
    return { data };
  }

  // ── Super Admin: get single request ──────────────────────────────────────

  @Get(':id')
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  async findOne(@Param('id') id: string) {
    const data = await this.svc.findOne(id);
    return { data };
  }

  // ── Super Admin: approve ──────────────────────────────────────────────────

  @Patch(':id/approve')
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Approve tenant request — creates tenant + owner user (super admin only)',
  })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveTenantRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.svc.approve(id, dto, user);
    return { data };
  }

  // ── Super Admin: reject ───────────────────────────────────────────────────

  @Patch(':id/reject')
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reject tenant request (super admin only)' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectTenantRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.svc.reject(id, dto, user);
    return { data };
  }
}
