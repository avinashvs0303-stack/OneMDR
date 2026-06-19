import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';
import type { SubmitTenantRequestDto } from './dto/submit-tenant-request.dto';
import type {
  ApproveTenantRequestDto,
  RejectTenantRequestDto,
} from './dto/approve-tenant-request.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

const CLARBIT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class TenantRequestsService {
  private readonly logger = new Logger(TenantRequestsService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly supabase: SupabaseAdminService,
  ) {}

  // ── Public: anyone can submit a request ─────────────────────────────────────

  async submit(dto: SubmitTenantRequestDto, meta: { ip?: string; device?: string }) {
    const existing = await this.db.tenantRequest.findUnique({
      where: { contactEmail: dto.contactEmail },
    });

    if (existing) {
      if (existing.status === 'APPROVED') {
        throw new ConflictException('An account for this email already exists.');
      }
      if (existing.status === 'PENDING') {
        throw new ConflictException(
          'A request for this email is already under review. We will contact you shortly.',
        );
      }
      // REJECTED — allow re-application by deleting the old rejection
      await this.db.tenantRequest.delete({ where: { id: existing.id } });
    }

    const request = await this.db.tenantRequest.create({
      data: {
        companyName: dto.companyName,
        companySize: dto.companySize,
        industry: dto.industry,
        website: dto.website,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        useCase: dto.useCase,
      },
    });

    this.emitter.emit('audit.log', {
      tenantId: '00000000-0000-0000-0000-000000000000',
      action: 'TENANT_REQUEST_SUBMITTED',
      resource: 'tenant_request',
      resourceId: request.id,
      metadata: { email: dto.contactEmail, company: dto.companyName },
      ipAddress: meta.ip,
      userAgent: meta.device,
    });

    this.logger.log(`New tenant request submitted: ${dto.contactEmail} (${dto.companyName})`);
    return request;
  }

  // ── Super Admin: list all requests ──────────────────────────────────────────

  async findAll(status?: string) {
    return this.db.tenantRequest.findMany({
      where: status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        companyName: true,
        companySize: true,
        industry: true,
        website: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        useCase: true,
        status: true,
        planType: true,
        maxUsers: true,
        licenseModules: true,
        licenseExpiresAt: true,
        adminNotes: true,
        rejectionReason: true,
        reviewedAt: true,
        createdAt: true,
        tenantId: true,
      },
    });
  }

  async findOne(id: string) {
    const req = await this.db.tenantRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Tenant request not found');
    return req;
  }

  // ── Super Admin: approve ─────────────────────────────────────────────────────

  async approve(id: string, dto: ApproveTenantRequestDto, reviewer: JwtPayload) {
    const req = await this.findOne(id);

    if (req.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${req.status.toLowerCase()}`);
    }

    const slug = await this.ensureUniqueSlug(
      req.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50),
    );

    const firstName = req.contactName.split(' ')[0] ?? req.contactName;
    const lastName = req.contactName.split(' ').slice(1).join(' ') || '-';

    // Step 1: Atomically create tenant + users record in our DB.
    // The user record has no passwordHash — auth is handled by Supabase.
    const [, user, updatedRequest] = await this.db.$transaction([
      this.db.tenant.create({
        data: {
          id: req.id,
          name: req.companyName,
          slug,
          plan: dto.planType,
          maxUsers: dto.maxUsers,
          licenseModules: dto.licenseModules,
          licenseExpiresAt: dto.licenseExpiresAt ? new Date(dto.licenseExpiresAt) : null,
          isActive: true,
        },
      }),
      this.db.user.create({
        data: {
          tenantId: req.id,
          email: req.contactEmail,
          firstName,
          lastName,
          role: 'OWNER',
          emailVerified: false, // Supabase will set this when the user accepts the invite
        },
      }),
      this.db.tenantRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: reviewer.sub,
          reviewedAt: new Date(),
          adminNotes: dto.adminNotes,
          planType: dto.planType,
          maxUsers: dto.maxUsers,
          licenseModules: dto.licenseModules,
          licenseExpiresAt: dto.licenseExpiresAt ? new Date(dto.licenseExpiresAt) : null,
          tenantId: req.id,
        },
      }),
    ]);

    // Step 2: Invite user via Supabase — sends invite email automatically.
    // On invite acceptance, Supabase creates auth.users and the user sets their password.
    // The invite link is set to /auth/set-password so we can handle the password setup flow.
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const supabaseUid = await this.supabase.inviteUser({
      email: req.contactEmail,
      redirectTo: `${frontendUrl}/auth/set-password`,
      userMetadata: {
        first_name: firstName,
        last_name: lastName,
      },
      appMetadata: {
        user_id: user.id,
        tenant_id: req.id,
        app_role: 'OWNER',
      },
    });

    // Step 3: Store the Supabase auth user ID in our users record for future lookups.
    await this.db.user.update({
      where: { id: user.id },
      data: { supabaseUid, emailVerified: false },
    });

    this.emitter.emit('audit.log', {
      tenantId: reviewer.tenantId ?? CLARBIT_TENANT_ID,
      actorId: reviewer.sub,
      action: 'TENANT_REQUEST_APPROVED',
      resource: 'tenant_request',
      resourceId: id,
      metadata: {
        company: req.companyName,
        plan: dto.planType,
        modules: dto.licenseModules,
        inviteEmail: req.contactEmail,
      },
    });

    this.logger.log(
      `Tenant request APPROVED: ${req.contactEmail} → tenant ${slug} (${dto.planType}). Invite sent via Supabase.`,
    );

    return { request: updatedRequest };
  }

  // ── Super Admin: reject ──────────────────────────────────────────────────────

  async reject(id: string, dto: RejectTenantRequestDto, reviewer: JwtPayload) {
    const req = await this.findOne(id);

    if (req.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${req.status.toLowerCase()}`);
    }

    const updated = await this.db.tenantRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: reviewer.sub,
        reviewedAt: new Date(),
        rejectionReason: dto.rejectionReason,
        adminNotes: dto.adminNotes,
      },
    });

    this.emitter.emit('audit.log', {
      tenantId: reviewer.tenantId ?? CLARBIT_TENANT_ID,
      actorId: reviewer.sub,
      action: 'TENANT_REQUEST_REJECTED',
      resource: 'tenant_request',
      resourceId: id,
      metadata: { company: req.companyName, reason: dto.rejectionReason },
    });

    this.logger.log(`Tenant request REJECTED: ${req.contactEmail}`);
    return updated;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async ensureUniqueSlug(base: string): Promise<string> {
    let slug = base;
    let counter = 1;
    while (await this.db.tenant.findUnique({ where: { slug } })) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }
}
