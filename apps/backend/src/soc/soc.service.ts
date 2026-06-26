import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@onemdr/database';
import { PrismaService } from '../database/prisma.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  CreateChangeDto,
  UpdateChangeStatusDto,
  CreateRequestDto,
  UpdateRequestStatusDto,
  UpsertShiftDto,
  CreateChannelDto,
  SendMessageDto,
} from './dto/soc.dto';

function p2021(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2021' || e.code === 'P2010')
  );
}

const DEFAULT_CHANNELS = [
  { name: 'general', description: 'General SOC discussion', icon: 'hash' },
  { name: 'alerts', description: 'Active alert notifications', icon: 'bell' },
  { name: 'incidents', description: 'Incident coordination', icon: 'alert-circle' },
  { name: 'threat-intel', description: 'Threat intelligence sharing', icon: 'shield' },
];

@Injectable()
export class SocService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Documents ───────────────────────────────────────────────────────────────

  async listDocuments(user: JwtPayload, category?: string) {
    try {
      return await this.prisma.socDocument.findMany({
        where: { tenantId: user.tenantId!, ...(category ? { category } : {}) },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      });
    } catch (e) {
      if (p2021(e))
        throw new ServiceUnavailableException(
          'SOC tables not found. Run migration 20260625000001_soc_operations.',
        );
      throw e;
    }
  }

  async getDocument(user: JwtPayload, id: string) {
    const doc = await this.prisma.socDocument.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async createDocument(user: JwtPayload, dto: CreateDocumentDto) {
    return this.prisma.socDocument.create({
      data: {
        tenantId: user.tenantId!,
        title: dto.title,
        content: dto.content,
        category: dto.category ?? 'General',
        tags: dto.tags ?? [],
        authorId: user.sub,
        authorName: `User ${user.sub.slice(0, 6)}`,
      },
    });
  }

  async updateDocument(user: JwtPayload, id: string, dto: UpdateDocumentDto) {
    await this.getDocument(user, id);
    return this.prisma.socDocument.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
      },
    });
  }

  async deleteDocument(user: JwtPayload, id: string) {
    await this.getDocument(user, id);
    await this.prisma.socDocument.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Change Management ───────────────────────────────────────────────────────

  async listChanges(user: JwtPayload, status?: string) {
    try {
      return await this.prisma.socChange.findMany({
        where: { tenantId: user.tenantId!, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      if (p2021(e))
        throw new ServiceUnavailableException(
          'SOC tables not found. Run migration 20260625000001_soc_operations.',
        );
      throw e;
    }
  }

  async createChange(user: JwtPayload, dto: CreateChangeDto) {
    const count = await this.prisma.socChange.count({ where: { tenantId: user.tenantId! } });
    const changeRef = `CHG-${String(count + 1).padStart(4, '0')}`;
    return this.prisma.socChange.create({
      data: {
        tenantId: user.tenantId!,
        changeRef,
        title: dto.title,
        description: dto.description ?? '',
        changeType: dto.changeType ?? 'STANDARD',
        priority: dto.priority ?? 'MEDIUM',
        riskLevel: dto.riskLevel ?? 'LOW',
        impact: dto.impact ?? '',
        rollbackPlan: dto.rollbackPlan ?? '',
        scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : null,
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : null,
        requesterId: user.sub,
        requesterName: `User ${user.sub.slice(0, 6)}`,
      },
    });
  }

  async updateChangeStatus(user: JwtPayload, id: string, dto: UpdateChangeStatusDto) {
    const existing = await this.prisma.socChange.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!existing) throw new NotFoundException('Change not found');
    return this.prisma.socChange.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.rejectionNote !== undefined && { rejectionNote: dto.rejectionNote }),
        ...(dto.approverName !== undefined && {
          approverName: dto.approverName,
          approverId: user.sub,
        }),
      },
    });
  }

  // ── Service Requests ────────────────────────────────────────────────────────

  async listRequests(user: JwtPayload, status?: string) {
    try {
      return await this.prisma.socServiceRequest.findMany({
        where: { tenantId: user.tenantId!, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      if (p2021(e))
        throw new ServiceUnavailableException(
          'SOC tables not found. Run migration 20260625000001_soc_operations.',
        );
      throw e;
    }
  }

  async createRequest(user: JwtPayload, dto: CreateRequestDto) {
    const count = await this.prisma.socServiceRequest.count({
      where: { tenantId: user.tenantId! },
    });
    const requestRef = `REQ-${String(count + 1).padStart(4, '0')}`;
    return this.prisma.socServiceRequest.create({
      data: {
        tenantId: user.tenantId!,
        requestRef,
        title: dto.title,
        description: dto.description ?? '',
        category: dto.category ?? 'ACCESS',
        priority: dto.priority ?? 'MEDIUM',
        requesterId: user.sub,
        requesterName: `User ${user.sub.slice(0, 6)}`,
      },
    });
  }

  async updateRequestStatus(user: JwtPayload, id: string, dto: UpdateRequestStatusDto) {
    const existing = await this.prisma.socServiceRequest.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!existing) throw new NotFoundException('Request not found');
    return this.prisma.socServiceRequest.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.assigneeName !== undefined && {
          assigneeName: dto.assigneeName,
          assigneeId: user.sub,
        }),
        ...(dto.resolutionNote !== undefined && { resolutionNote: dto.resolutionNote }),
      },
    });
  }

  // ── Roster ──────────────────────────────────────────────────────────────────

  private getShiftTimes(type: string) {
    const times: Record<string, { start: string; end: string }> = {
      MORNING: { start: '06:00', end: '14:00' },
      AFTERNOON: { start: '14:00', end: '22:00' },
      NIGHT: { start: '22:00', end: '06:00' },
      GENERAL: { start: '09:00', end: '17:00' },
    };
    return times[type] ?? { start: '09:00', end: '17:00' };
  }

  async getRosterShifts(user: JwtPayload, weekStart: string) {
    try {
      return await this.prisma.socRosterShift.findMany({
        where: { tenantId: user.tenantId!, weekStart: new Date(weekStart) },
        orderBy: [{ shiftType: 'asc' }, { dayOfWeek: 'asc' }],
      });
    } catch (e) {
      if (p2021(e))
        throw new ServiceUnavailableException(
          'SOC tables not found. Run migration 20260625000001_soc_operations.',
        );
      throw e;
    }
  }

  async upsertShift(user: JwtPayload, dto: UpsertShiftDto) {
    const times = this.getShiftTimes(dto.shiftType);
    return this.prisma.socRosterShift.upsert({
      where: {
        tenantId_weekStart_shiftType_dayOfWeek: {
          tenantId: user.tenantId!,
          weekStart: new Date(dto.weekStart),
          shiftType: dto.shiftType,
          dayOfWeek: dto.dayOfWeek,
        },
      },
      create: {
        tenantId: user.tenantId!,
        weekStart: new Date(dto.weekStart),
        shiftType: dto.shiftType,
        dayOfWeek: dto.dayOfWeek,
        analystId: dto.analystId ?? null,
        analystName: dto.analystName ?? null,
        startTime: times.start,
        endTime: times.end,
        isOncall: dto.isOncall ?? false,
        notes: dto.notes ?? null,
      },
      update: {
        analystId: dto.analystId ?? null,
        analystName: dto.analystName ?? null,
        isOncall: dto.isOncall ?? false,
        notes: dto.notes ?? null,
      },
    });
  }

  async clearShift(user: JwtPayload, id: string) {
    const shift = await this.prisma.socRosterShift.findFirst({
      where: { id, tenantId: user.tenantId! },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return this.prisma.socRosterShift.delete({ where: { id } });
  }

  // ── Channels ────────────────────────────────────────────────────────────────

  private async ensureDefaultChannels(tenantId: string) {
    const count = await this.prisma.socChannel.count({ where: { tenantId } });
    if (count === 0) {
      await this.prisma.socChannel.createMany({
        data: DEFAULT_CHANNELS.map((c) => ({ ...c, tenantId })),
        skipDuplicates: true,
      });
    }
  }

  async listChannels(user: JwtPayload) {
    try {
      await this.ensureDefaultChannels(user.tenantId!);
      return await this.prisma.socChannel.findMany({
        where: { tenantId: user.tenantId! },
        orderBy: { createdAt: 'asc' },
      });
    } catch (e) {
      if (p2021(e))
        throw new ServiceUnavailableException(
          'SOC tables not found. Run migration 20260625000001_soc_operations.',
        );
      throw e;
    }
  }

  async createChannel(user: JwtPayload, dto: CreateChannelDto) {
    return this.prisma.socChannel.create({
      data: {
        tenantId: user.tenantId!,
        name: dto.name.toLowerCase().replace(/\s+/g, '-'),
        description: dto.description ?? '',
        isPrivate: dto.isPrivate ?? false,
      },
    });
  }

  // ── Messages ────────────────────────────────────────────────────────────────

  async getMessages(user: JwtPayload, channelId: string, cursor?: string) {
    try {
      const channel = await this.prisma.socChannel.findFirst({
        where: { id: channelId, tenantId: user.tenantId! },
      });
      if (!channel) throw new NotFoundException('Channel not found');
      const messages = await this.prisma.socMessage.findMany({
        where: {
          channelId,
          isDeleted: false,
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return messages.reverse();
    } catch (e) {
      if (p2021(e))
        throw new ServiceUnavailableException(
          'SOC tables not found. Run migration 20260625000001_soc_operations.',
        );
      throw e;
    }
  }

  async sendMessage(user: JwtPayload, channelId: string, dto: SendMessageDto, authorName: string) {
    const channel = await this.prisma.socChannel.findFirst({
      where: { id: channelId, tenantId: user.tenantId! },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return this.prisma.socMessage.create({
      data: {
        channelId,
        tenantId: user.tenantId!,
        authorId: user.sub,
        authorName,
        authorRole: user.role,
        content: dto.content,
        messageType: dto.messageType ?? 'TEXT',
      },
    });
  }

  async deleteMessage(user: JwtPayload, channelId: string, messageId: string) {
    const msg = await this.prisma.socMessage.findFirst({
      where: { id: messageId, channelId, tenantId: user.tenantId! },
    });
    if (!msg) throw new NotFoundException('Message not found');
    return this.prisma.socMessage.update({
      where: { id: messageId },
      data: { isDeleted: true },
    });
  }
}
