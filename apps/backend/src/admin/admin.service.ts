import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';
import { TenantRequestsService } from '../tenant-requests/tenant-requests.service';
import type { UpdateLicenseDto } from './dto/update-license.dto';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { InviteTenantUserDto } from './dto/invite-tenant-user.dto';
import type { UpdateSupportCaseDto, CreateSupportCaseDto } from './dto/update-support-case.dto';
import type {
  ApproveTenantRequestDto,
  RejectTenantRequestDto,
} from '../tenant-requests/dto/approve-tenant-request.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type {
  TenantPlan,
  TenantType,
  Prisma,
  SupportCaseStatus,
  SupportCasePriority,
} from '@onemdr/database';

const CLARBIT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly supabase: SupabaseAdminService,
    private readonly tenantRequestsSvc: TenantRequestsService,
  ) {}

  // ── Overview / KPIs ─────────────────────────────────────────────────────────

  async getOverview() {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86400_000);
    const in60Days = new Date(now.getTime() + 60 * 86400_000);
    const in90Days = new Date(now.getTime() + 90 * 86400_000);

    const [
      pendingRequests,
      overdueRequests,
      totalTenants,
      activeTenants,
      expiring30,
      expiring60,
      expiring90,
      recentRequests,
      recentTenants,
    ] = await Promise.all([
      this.db.tenantRequest.count({ where: { status: 'PENDING' } }),
      // Requests pending >7 days are "overdue"
      this.db.tenantRequest.count({
        where: {
          status: 'PENDING',
          createdAt: { lte: new Date(now.getTime() - 7 * 86400_000) },
        },
      }),
      this.db.tenant.count({ where: { id: { not: CLARBIT_TENANT_ID } } }),
      this.db.tenant.count({ where: { id: { not: CLARBIT_TENANT_ID }, isActive: true } }),
      this.db.tenant.count({
        where: {
          id: { not: CLARBIT_TENANT_ID },
          isActive: true,
          licenseExpiresAt: { gte: now, lte: in30Days },
        },
      }),
      this.db.tenant.count({
        where: {
          id: { not: CLARBIT_TENANT_ID },
          isActive: true,
          licenseExpiresAt: { gte: now, lte: in60Days },
        },
      }),
      this.db.tenant.count({
        where: {
          id: { not: CLARBIT_TENANT_ID },
          isActive: true,
          licenseExpiresAt: { gte: now, lte: in90Days },
        },
      }),
      this.db.tenantRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: {
          id: true,
          companyName: true,
          contactEmail: true,
          industry: true,
          createdAt: true,
          status: true,
        },
      }),
      this.db.tenant.findMany({
        where: { id: { not: CLARBIT_TENANT_ID } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          plan: true,
          isActive: true,
          createdAt: true,
          licenseExpiresAt: true,
        },
      }),
    ]);

    return {
      requests: { pending: pendingRequests, overdue: overdueRequests },
      tenants: {
        total: totalTenants,
        active: activeTenants,
        suspended: totalTenants - activeTenants,
      },
      licenses: { expiring30, expiring60, expiring90 },
      recentRequests,
      recentTenants,
    };
  }

  // ── Tenant list ──────────────────────────────────────────────────────────────

  async listTenants(opts: { search?: string; plan?: string; status?: string }) {
    const where: Prisma.TenantWhereInput = {
      id: { not: CLARBIT_TENANT_ID },
      ...(opts.status === 'active' && { isActive: true }),
      ...(opts.status === 'suspended' && { isActive: false }),
      ...(opts.plan && { plan: opts.plan as TenantPlan }),
      ...(opts.search && {
        OR: [
          { name: { contains: opts.search, mode: 'insensitive' } },
          { slug: { contains: opts.search, mode: 'insensitive' } },
          { billingEmail: { contains: opts.search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.db.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        isActive: true,
        maxUsers: true,
        licenseModules: true,
        licenseExpiresAt: true,
        createdAt: true,
        _count: {
          select: {
            users: { where: { isActive: true, deletedAt: null } },
          },
        },
      },
    });
  }

  // ── Single tenant detail ──────────────────────────────────────────────────────

  async getTenant(id: string) {
    const tenant = await this.db.tenant.findUnique({
      where: { id },
      include: {
        users: {
          where: { deletedAt: null },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            mfaEnabled: true,
            lastLoginAt: true,
            createdAt: true,
            supabaseUid: true,
          },
        },
        tenantRequest: {
          select: {
            companySize: true,
            industry: true,
            website: true,
            contactPhone: true,
            useCase: true,
            reviewedAt: true,
            adminNotes: true,
            rejectionReason: true,
          },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  // ── License management ────────────────────────────────────────────────────────

  async updateLicense(id: string, dto: UpdateLicenseDto, actor: JwtPayload) {
    const tenant = await this.db.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const updated = await this.db.tenant.update({
      where: { id },
      data: {
        plan: dto.planType,
        ...(dto.tenantType && { tenantType: dto.tenantType }),
        maxUsers: dto.maxUsers,
        maxSubTenants: dto.maxSubTenants ?? null,
        licenseModules: dto.licenseModules,
        licenseExpiresAt: dto.licenseExpiresAt ? new Date(dto.licenseExpiresAt) : null,
      },
      include: {
        users: {
          where: { isActive: true, deletedAt: null },
          select: { supabaseUid: true, id: true, role: true },
        },
      },
    });

    // Sync tenant_type into each user's Supabase app_metadata so the JWT reflects the change
    // on their next token refresh (no re-login required after ~1h).
    if (dto.tenantType && dto.tenantType !== tenant.tenantType) {
      const newTenantType = dto.tenantType as TenantType;
      await Promise.allSettled(
        updated.users
          .filter((u) => u.supabaseUid)
          .map((u) =>
            this.supabase.updateUserAppMetadata(u.supabaseUid!, {
              user_id: u.id,
              tenant_id: id,
              app_role: u.role,
              tenant_type: newTenantType,
            }),
          ),
      );
    }

    this.emitter.emit('audit.log', {
      tenantId: actor.tenantId ?? CLARBIT_TENANT_ID,
      actorId: actor.sub,
      action: 'TENANT_UPDATED',
      resource: 'tenant',
      resourceId: id,
      metadata: {
        op: 'license_update',
        from: { plan: tenant.plan, maxUsers: tenant.maxUsers },
        to: dto,
      },
    });

    this.logger.log(`License updated for tenant ${tenant.name} by ${actor.email}`);
    return updated;
  }

  // ── Suspend / reactivate ───────────────────────────────────────────────────────

  async suspendTenant(id: string, actor: JwtPayload) {
    const tenant = await this.db.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.isActive) throw new BadRequestException('Tenant is already suspended');
    if (id === CLARBIT_TENANT_ID)
      throw new BadRequestException('Cannot suspend the Clarbit platform tenant');

    await this.db.tenant.update({ where: { id }, data: { isActive: false } });

    this.emitter.emit('audit.log', {
      tenantId: actor.tenantId ?? CLARBIT_TENANT_ID,
      actorId: actor.sub,
      action: 'TENANT_UPDATED',
      resource: 'tenant',
      resourceId: id,
      metadata: { op: 'suspend', tenantName: tenant.name },
    });

    this.logger.log(`Tenant ${tenant.name} suspended by ${actor.email}`);
    return { message: `Tenant "${tenant.name}" suspended` };
  }

  async reactivateTenant(id: string, actor: JwtPayload) {
    const tenant = await this.db.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.isActive) throw new BadRequestException('Tenant is already active');

    await this.db.tenant.update({ where: { id }, data: { isActive: true } });

    this.emitter.emit('audit.log', {
      tenantId: actor.tenantId ?? CLARBIT_TENANT_ID,
      actorId: actor.sub,
      action: 'TENANT_UPDATED',
      resource: 'tenant',
      resourceId: id,
      metadata: { op: 'reactivate', tenantName: tenant.name },
    });

    this.logger.log(`Tenant ${tenant.name} reactivated by ${actor.email}`);
    return { message: `Tenant "${tenant.name}" reactivated` };
  }

  // ── User management ───────────────────────────────────────────────────────────

  async inviteUser(tenantId: string, dto: InviteTenantUserDto, actor: JwtPayload) {
    const tenant = await this.db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!tenant.isActive)
      throw new BadRequestException('Cannot invite users to a suspended tenant');

    const userCount = await this.db.user.count({
      where: { tenantId, isActive: true, deletedAt: null },
    });
    if (userCount >= tenant.maxUsers) {
      throw new BadRequestException(
        `Tenant has reached its user limit of ${tenant.maxUsers}. Upgrade the license first.`,
      );
    }

    const existing = await this.db.user.findUnique({
      where: { email_tenantId: { email: dto.email, tenantId } },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists in this tenant');
    }

    const [firstName, ...rest] = dto.name.trim().split(' ');
    const lastName = rest.join(' ') || '-';
    const role = dto.role ?? 'MEMBER';

    const user = await this.db.user.create({
      data: {
        tenantId,
        email: dto.email,
        firstName: firstName ?? dto.email,
        lastName,
        role,
        emailVerified: false,
        isActive: true,
      },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const supabaseUid = await this.supabase.inviteUser({
      email: dto.email,
      redirectTo: `${frontendUrl}/auth/set-password`,
      userMetadata: { first_name: firstName, last_name: lastName },
      appMetadata: {
        user_id: user.id,
        tenant_id: tenantId,
        app_role: role,
        tenant_type: tenant.tenantType,
      },
    });

    await this.db.user.update({ where: { id: user.id }, data: { supabaseUid } });

    this.emitter.emit('audit.log', {
      tenantId: actor.tenantId ?? CLARBIT_TENANT_ID,
      actorId: actor.sub,
      action: 'USER_INVITED',
      resource: 'user',
      resourceId: user.id,
      metadata: { email: dto.email, tenantId, tenantName: tenant.name, role },
    });

    this.logger.log(`User ${dto.email} invited to tenant ${tenant.name} as ${role}`);
    return { userId: user.id, message: `Invite sent to ${dto.email}` };
  }

  async deactivateUser(tenantId: string, userId: string, actor: JwtPayload) {
    const user = await this.db.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found in this tenant');
    if (user.role === 'OWNER') {
      throw new BadRequestException(
        'Cannot deactivate the tenant owner. Transfer ownership first.',
      );
    }
    if (!user.isActive) throw new BadRequestException('User is already inactive');

    await this.db.user.update({ where: { id: userId }, data: { isActive: false } });

    if (user.supabaseUid) {
      try {
        await this.supabase.deleteUser(user.supabaseUid);
      } catch (err) {
        this.logger.warn(`Failed to revoke Supabase session for ${user.email}: ${String(err)}`);
      }
    }

    this.emitter.emit('audit.log', {
      tenantId: actor.tenantId ?? CLARBIT_TENANT_ID,
      actorId: actor.sub,
      action: 'USER_REMOVED',
      resource: 'user',
      resourceId: userId,
      metadata: { email: user.email, tenantId },
    });

    return { message: `User ${user.email} deactivated` };
  }

  // ── License expiry dashboard ─────────────────────────────────────────────────

  async getExpiringLicenses(days: number) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 86400_000);

    return this.db.tenant.findMany({
      where: {
        id: { not: CLARBIT_TENANT_ID },
        isActive: true,
        licenseExpiresAt: { gte: now, lte: cutoff },
      },
      orderBy: { licenseExpiresAt: 'asc' },
      select: {
        id: true,
        name: true,
        plan: true,
        licenseExpiresAt: true,
        maxUsers: true,
        _count: { select: { users: { where: { isActive: true, deletedAt: null } } } },
      },
    });
  }

  // ── Manual tenant creation ────────────────────────────────────────────────────

  async createTenant(dto: CreateTenantDto, actor: JwtPayload) {
    const existingUser = await this.db.user.findFirst({ where: { email: dto.contactEmail } });
    if (existingUser) throw new ConflictException('A user with this email already exists');

    const baseSlug = dto.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    let slug = baseSlug;
    let counter = 1;
    while (await this.db.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const firstName = dto.contactName.split(' ')[0] ?? dto.contactName;
    const lastName = dto.contactName.split(' ').slice(1).join(' ') || '-';
    const tenantId = crypto.randomUUID();

    const [, user] = await this.db.$transaction([
      this.db.tenant.create({
        data: {
          id: tenantId,
          name: dto.companyName,
          slug,
          plan: dto.planType,
          tenantType: dto.tenantType ?? 'STANDARD',
          maxUsers: dto.maxUsers,
          maxSubTenants: dto.maxSubTenants ?? null,
          licenseModules: dto.licenseModules,
          licenseExpiresAt: dto.licenseExpiresAt ? new Date(dto.licenseExpiresAt) : null,
          isActive: true,
        },
      }),
      this.db.user.create({
        data: {
          tenantId,
          email: dto.contactEmail,
          firstName,
          lastName,
          role: 'OWNER',
          emailVerified: false,
        },
      }),
    ]);

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const supabaseUid = await this.supabase.inviteUser({
      email: dto.contactEmail,
      redirectTo: `${frontendUrl}/auth/set-password`,
      userMetadata: { first_name: firstName, last_name: lastName },
      appMetadata: {
        user_id: user.id,
        tenant_id: tenantId,
        app_role: 'OWNER',
        tenant_type: dto.tenantType ?? 'STANDARD',
      },
    });

    if (supabaseUid) {
      await this.db.user.update({ where: { id: user.id }, data: { supabaseUid } });
    }

    this.emitter.emit('audit.log', {
      tenantId: actor.tenantId ?? CLARBIT_TENANT_ID,
      actorId: actor.sub,
      action: 'TENANT_CREATED',
      resource: 'tenant',
      resourceId: tenantId,
      metadata: {
        company: dto.companyName,
        email: dto.contactEmail,
        type: dto.tenantType ?? 'STANDARD',
        plan: dto.planType,
      },
    });

    this.logger.log(`Tenant "${dto.companyName}" manually created by ${actor.email}`);
    return { tenantId, slug, message: `Tenant created. Invite sent to ${dto.contactEmail}` };
  }

  // ── Leads (tenant requests) ───────────────────────────────────────────────────

  async listLeads(status?: string) {
    return this.tenantRequestsSvc.findAll(status);
  }

  async getLead(id: string) {
    return this.tenantRequestsSvc.findOne(id);
  }

  async provisionLead(id: string, dto: ApproveTenantRequestDto, actor: JwtPayload) {
    return this.tenantRequestsSvc.approve(id, dto, actor);
  }

  async declineLead(id: string, dto: RejectTenantRequestDto, actor: JwtPayload) {
    return this.tenantRequestsSvc.reject(id, dto, actor);
  }

  // ── Support Cases ─────────────────────────────────────────────────────────────

  async listSupportCases(filters: {
    status?: SupportCaseStatus;
    priority?: SupportCasePriority;
    tenantId?: string;
  }) {
    const where: Prisma.SupportCaseWhereInput = {
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.tenantId && { tenantId: filters.tenantId }),
    };

    return this.db.supportCase.findMany({
      where,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async createSupportCase(dto: CreateSupportCaseDto, actor: JwtPayload) {
    const tenant = await this.db.tenant.findUnique({ where: { id: dto.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const sc = await this.db.supportCase.create({
      data: {
        tenantId: dto.tenantId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'MEDIUM',
        submittedByEmail: dto.submittedByEmail,
        submittedByName: dto.submittedByName,
      },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });

    this.emitter.emit('audit.log', {
      tenantId: actor.tenantId ?? CLARBIT_TENANT_ID,
      actorId: actor.sub,
      action: 'RESOURCE_CREATED',
      resource: 'support_case',
      resourceId: sc.id,
      metadata: { tenantId: dto.tenantId, title: dto.title },
    });

    return sc;
  }

  async updateSupportCase(id: string, dto: UpdateSupportCaseDto, actor: JwtPayload) {
    const sc = await this.db.supportCase.findUnique({ where: { id } });
    if (!sc) throw new NotFoundException('Support case not found');

    const resolvedAt =
      dto.status === 'RESOLVED' || dto.status === 'CLOSED'
        ? (sc.resolvedAt ?? new Date())
        : sc.resolvedAt;

    const updated = await this.db.supportCase.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.assignedToEmail !== undefined && { assignedToEmail: dto.assignedToEmail }),
        ...(dto.internalNotes !== undefined && { internalNotes: dto.internalNotes }),
        ...(dto.resolutionNotes !== undefined && { resolutionNotes: dto.resolutionNotes }),
        resolvedAt,
      },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });

    this.emitter.emit('audit.log', {
      tenantId: actor.tenantId ?? CLARBIT_TENANT_ID,
      actorId: actor.sub,
      action: 'RESOURCE_UPDATED',
      resource: 'support_case',
      resourceId: id,
      metadata: { changes: dto },
    });

    this.logger.log(`Support case ${id} updated by ${actor.email}`);
    return updated;
  }
}
