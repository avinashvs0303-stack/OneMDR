import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateLicenseDto } from './dto/update-license.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { InviteTenantUserDto } from './dto/invite-tenant-user.dto';
import { UpdateSupportCaseDto, CreateSupportCaseDto } from './dto/update-support-case.dto';
import {
  ApproveTenantRequestDto,
  RejectTenantRequestDto,
} from '../tenant-requests/dto/approve-tenant-request.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClarbitEmailGuard } from '../common/guards/clarbit-email.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type { SupportCaseStatus, SupportCasePriority } from '@onemdr/database';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(RolesGuard, ClarbitEmailGuard)
@Roles('SUPER_ADMIN')
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  // ── Overview KPIs ────────────────────────────────────────────────────────────

  @Get('overview')
  @ApiOperation({ summary: 'Admin overview — KPI stats' })
  async getOverview() {
    const data = await this.svc.getOverview();
    return { data };
  }

  // ── Tenant list ───────────────────────────────────────────────────────────────

  @Get('tenants')
  @ApiOperation({ summary: 'List all customer tenants' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'plan', required: false, enum: ['FREE', 'PRO', 'ENTERPRISE'] })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'suspended'] })
  async listTenants(
    @Query('search') search?: string,
    @Query('plan') plan?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.svc.listTenants({ search, plan, status });
    return { data };
  }

  // ── Manual tenant creation ────────────────────────────────────────────────────

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Manually create a tenant and send invite to the owner' })
  async createTenant(@Body() dto: CreateTenantDto, @CurrentUser() user: JwtPayload) {
    const data = await this.svc.createTenant(dto, user);
    return { data };
  }

  // ── Single tenant ────────────────────────────────────────────────────────────

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant detail with users and license' })
  async getTenant(@Param('id') id: string) {
    const data = await this.svc.getTenant(id);
    return { data };
  }

  // ── License management ────────────────────────────────────────────────────────

  @Patch('tenants/:id/license')
  @ApiOperation({ summary: 'Update tenant license (plan, modules, expiry, seat count)' })
  async updateLicense(
    @Param('id') id: string,
    @Body() dto: UpdateLicenseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.svc.updateLicense(id, dto, user);
    return { data };
  }

  // ── Suspend / reactivate ──────────────────────────────────────────────────────

  @Patch('tenants/:id/suspend')
  @ApiOperation({ summary: 'Suspend a tenant (blocks all logins for that org)' })
  @HttpCode(HttpStatus.OK)
  async suspendTenant(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const data = await this.svc.suspendTenant(id, user);
    return { data };
  }

  @Patch('tenants/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended tenant' })
  @HttpCode(HttpStatus.OK)
  async reactivateTenant(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const data = await this.svc.reactivateTenant(id, user);
    return { data };
  }

  // ── User management ───────────────────────────────────────────────────────────

  @Post('tenants/:id/users')
  @ApiOperation({ summary: 'Invite a new user to an existing tenant' })
  @HttpCode(HttpStatus.CREATED)
  async inviteUser(
    @Param('id') tenantId: string,
    @Body() dto: InviteTenantUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.svc.inviteUser(tenantId, dto, user);
    return { data };
  }

  @Delete('tenants/:id/users/:userId')
  @ApiOperation({ summary: 'Deactivate a user and revoke their Supabase session' })
  @HttpCode(HttpStatus.OK)
  async deactivateUser(
    @Param('id') tenantId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.svc.deactivateUser(tenantId, userId, user);
    return { data };
  }

  // ── License expiry dashboard ──────────────────────────────────────────────────

  @Get('licenses/expiring')
  @ApiOperation({ summary: 'List tenants with licenses expiring within N days' })
  @ApiQuery({ name: 'days', required: false, description: 'Default 90' })
  async getExpiringLicenses(@Query('days') days?: string) {
    const data = await this.svc.getExpiringLicenses(Number(days ?? 90));
    return { data };
  }

  // ── Leads (tenant requests) ───────────────────────────────────────────────────

  @Get('leads')
  @ApiOperation({ summary: 'List all inbound access requests' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  async listLeads(@Query('status') status?: string) {
    const data = await this.svc.listLeads(status);
    return { data };
  }

  @Get('leads/:id')
  @ApiOperation({ summary: 'Get single access request detail' })
  async getLead(@Param('id') id: string) {
    const data = await this.svc.getLead(id);
    return { data };
  }

  @Patch('leads/:id/provision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve and provision a tenant from a lead' })
  async provisionLead(
    @Param('id') id: string,
    @Body() dto: ApproveTenantRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.svc.provisionLead(id, dto, user);
    return { data };
  }

  @Patch('leads/:id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline an access request' })
  async declineLead(
    @Param('id') id: string,
    @Body() dto: RejectTenantRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.svc.declineLead(id, dto, user);
    return { data };
  }

  // ── Support Cases ─────────────────────────────────────────────────────────────

  @Get('support-cases')
  @ApiOperation({ summary: 'List all support cases' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  })
  @ApiQuery({ name: 'priority', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @ApiQuery({ name: 'tenantId', required: false })
  async listSupportCases(
    @Query('status') status?: SupportCaseStatus,
    @Query('priority') priority?: SupportCasePriority,
    @Query('tenantId') tenantId?: string,
  ) {
    const data = await this.svc.listSupportCases({ status, priority, tenantId });
    return { data };
  }

  @Post('support-cases')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a support case on behalf of a tenant' })
  async createSupportCase(@Body() dto: CreateSupportCaseDto, @CurrentUser() user: JwtPayload) {
    const data = await this.svc.createSupportCase(dto, user);
    return { data };
  }

  @Patch('support-cases/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update support case status, assignment, or notes' })
  async updateSupportCase(
    @Param('id') id: string,
    @Body() dto: UpdateSupportCaseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.svc.updateSupportCase(id, dto, user);
    return { data };
  }
}
