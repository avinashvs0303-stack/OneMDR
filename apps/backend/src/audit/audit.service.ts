import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';
import { AuditAction, Prisma } from '@onemdr/database';

export interface AuditEventPayload {
  tenantId: string;
  actorId?: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('audit.log', { async: true })
  async handleAuditEvent(payload: AuditEventPayload): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: payload.tenantId,
          actorId: payload.actorId,
          action: payload.action,
          resource: payload.resource,
          resourceId: payload.resourceId,
          metadata: (payload.metadata ?? {}) as Prisma.InputJsonValue,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
        },
      });
    } catch (err) {
      // Audit failures must never break the request — log and continue
      this.logger.error('Failed to write audit log', err);
    }
  }

  /** Direct write — use when you need to await the log entry. */
  async log(payload: AuditEventPayload): Promise<void> {
    await this.handleAuditEvent(payload);
  }
}
