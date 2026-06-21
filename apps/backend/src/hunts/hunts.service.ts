import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  CreateHuntMissionDto,
  UpdateHuntMissionDto,
  CreateHuntEvidenceDto,
  CreateHuntIOCDto,
} from './dto/hunts.dto';

type Mission = Awaited<ReturnType<PrismaService['huntMission']['findFirst']>> & object;
type EvidenceRow = Awaited<ReturnType<PrismaService['huntEvidence']['findFirst']>> & object;
type IOCRow = Awaited<ReturnType<PrismaService['huntIOC']['findFirst']>> & object;

@Injectable()
export class HuntsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Ref generator ────────────────────────────────────────────────────────────

  private async nextRef(tenantId: string): Promise<string> {
    const last = await this.prisma.huntMission.findFirst({
      where: { tenantId },
      orderBy: { missionRef: 'desc' },
      select: { missionRef: true },
    });
    const num = last ? parseInt(last.missionRef.replace('HNT-', ''), 10) + 1 : 1;
    return `HNT-${String(num).padStart(4, '0')}`;
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  async stats(actor: JwtPayload) {
    const [total, active, complete, planned, critical, evidenceCount, iocCount] = await Promise.all(
      [
        this.prisma.huntMission.count({ where: { tenantId: actor.tenantId } }),
        this.prisma.huntMission.count({ where: { tenantId: actor.tenantId, status: 'ACTIVE' } }),
        this.prisma.huntMission.count({ where: { tenantId: actor.tenantId, status: 'COMPLETE' } }),
        this.prisma.huntMission.count({ where: { tenantId: actor.tenantId, status: 'PLANNED' } }),
        this.prisma.huntMission.count({
          where: { tenantId: actor.tenantId, priority: 'CRITICAL' },
        }),
        this.prisma.huntEvidence.count({
          where: { tenantId: actor.tenantId, isFalsePositive: false },
        }),
        this.prisma.huntIOC.count({ where: { tenantId: actor.tenantId } }),
      ],
    );

    const recentMissions = await this.prisma.huntMission.findMany({
      where: { tenantId: actor.tenantId, status: { in: ['ACTIVE', 'PLANNED'] } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 5,
      include: {
        _count: { select: { evidence: { where: { isFalsePositive: false } }, iocs: true } },
      },
    });

    return { total, active, complete, planned, critical, evidenceCount, iocCount, recentMissions };
  }

  // ── Missions CRUD ─────────────────────────────────────────────────────────────

  async list(actor: JwtPayload, status?: string, priority?: string) {
    return this.prisma.huntMission.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(status ? { status: status as Mission['status'] } : {}),
        ...(priority ? { priority: priority as Mission['priority'] } : {}),
      },
      orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { evidence: { where: { isFalsePositive: false } }, iocs: true } },
      },
    });
  }

  async findOne(actor: JwtPayload, id: string) {
    const mission = await this.prisma.huntMission.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        evidence: { orderBy: { createdAt: 'desc' } },
        iocs: { orderBy: { createdAt: 'desc' } },
        _count: { select: { evidence: { where: { isFalsePositive: false } }, iocs: true } },
      },
    });
    if (!mission) throw new NotFoundException('Hunt mission not found');
    return mission;
  }

  async create(actor: JwtPayload, dto: CreateHuntMissionDto) {
    const missionRef = await this.nextRef(actor.tenantId!);
    return this.prisma.huntMission.create({
      data: {
        tenantId: actor.tenantId!,
        missionRef,
        title: dto.title,
        hypothesis: dto.hypothesis,
        priority: (dto.priority as Mission['priority']) ?? 'MEDIUM',
        tacticId: dto.tacticId,
        tactic: dto.tactic,
        techniques: dto.techniques ?? [],
        analystId: actor.sub,
        analystName: dto.analystName,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        notes: dto.notes,
      },
      include: {
        _count: { select: { evidence: true, iocs: true } },
      },
    });
  }

  async update(actor: JwtPayload, id: string, dto: UpdateHuntMissionDto) {
    await this.findOne(actor, id);
    return this.prisma.huntMission.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.hypothesis !== undefined && { hypothesis: dto.hypothesis }),
        ...(dto.status !== undefined && { status: dto.status as Mission['status'] }),
        ...(dto.priority !== undefined && { priority: dto.priority as Mission['priority'] }),
        ...(dto.tacticId !== undefined && { tacticId: dto.tacticId }),
        ...(dto.tactic !== undefined && { tactic: dto.tactic }),
        ...(dto.techniques !== undefined && { techniques: dto.techniques }),
        ...(dto.analystName !== undefined && { analystName: dto.analystName }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        _count: { select: { evidence: { where: { isFalsePositive: false } }, iocs: true } },
      },
    });
  }

  async remove(actor: JwtPayload, id: string) {
    await this.findOne(actor, id);
    await this.prisma.huntMission.delete({ where: { id } });
  }

  // ── Evidence ─────────────────────────────────────────────────────────────────

  async addEvidence(actor: JwtPayload, missionId: string, dto: CreateHuntEvidenceDto) {
    await this.findOne(actor, missionId);
    return this.prisma.huntEvidence.create({
      data: {
        missionId,
        tenantId: actor.tenantId!,
        type: (dto.type as EvidenceRow['type']) ?? 'FINDING',
        title: dto.title,
        body: dto.body,
        severity: dto.severity ?? 'MEDIUM',
        isFalsePositive: dto.isFalsePositive ?? false,
        analystId: actor.sub,
        analystName: dto.analystName,
      },
    });
  }

  async removeEvidence(actor: JwtPayload, missionId: string, evidenceId: string) {
    const ev = await this.prisma.huntEvidence.findFirst({
      where: { id: evidenceId, missionId, tenantId: actor.tenantId },
    });
    if (!ev) throw new NotFoundException('Evidence not found');
    await this.prisma.huntEvidence.delete({ where: { id: evidenceId } });
  }

  // ── IOCs ──────────────────────────────────────────────────────────────────────

  async addIOC(actor: JwtPayload, missionId: string, dto: CreateHuntIOCDto) {
    await this.findOne(actor, missionId);
    return this.prisma.huntIOC.create({
      data: {
        missionId,
        tenantId: actor.tenantId!,
        type: dto.type as IOCRow['type'],
        value: dto.value,
        confidence: dto.confidence ?? 'MEDIUM',
        notes: dto.notes,
      },
    });
  }

  async removeIOC(actor: JwtPayload, missionId: string, iocId: string) {
    const ioc = await this.prisma.huntIOC.findFirst({
      where: { id: iocId, missionId, tenantId: actor.tenantId },
    });
    if (!ioc) throw new NotFoundException('IOC not found');
    await this.prisma.huntIOC.delete({ where: { id: iocId } });
  }

  // ── Cross-tenant IOC list ─────────────────────────────────────────────────────

  async listIOCs(actor: JwtPayload, type?: string) {
    return this.prisma.huntIOC.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(type ? { type: type as IOCRow['type'] } : {}),
      },
      include: { mission: { select: { id: true, missionRef: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
