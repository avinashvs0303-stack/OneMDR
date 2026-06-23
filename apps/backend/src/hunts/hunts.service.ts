import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  CreateHuntMissionDto,
  UpdateHuntMissionDto,
  CreateHuntEvidenceDto,
  CreateHuntIOCDto,
  CreatePlaybookDto,
  UpdatePlaybookDto,
  LaunchPlaybookDto,
  RunPlaybookQueryDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto/hunts.dto';

type Mission = Awaited<ReturnType<PrismaService['huntMission']['findFirst']>> & object;
type EvidenceRow = Awaited<ReturnType<PrismaService['huntEvidence']['findFirst']>> & object;
type IOCRow = Awaited<ReturnType<PrismaService['huntIOC']['findFirst']>> & object;

export interface PlaybookQuery {
  name: string;
  description: string;
  query: string;
  earliest: string;
  latest: string;
}

@Injectable()
export class HuntsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  // ── Mission ref generator ─────────────────────────────────────────────────────

  private async nextMissionRef(tenantId: string): Promise<string> {
    const last = await this.prisma.huntMission.findFirst({
      where: { tenantId },
      orderBy: { missionRef: 'desc' },
      select: { missionRef: true },
    });
    const num = last ? parseInt(last.missionRef.replace('HNT-', ''), 10) + 1 : 1;
    return `HNT-${String(num).padStart(4, '0')}`;
  }

  private async nextPlaybookRef(tenantId: string): Promise<string> {
    const last = await this.prisma.huntPlaybook.findFirst({
      where: { tenantId },
      orderBy: { playbookRef: 'desc' },
      select: { playbookRef: true },
    });
    const num = last ? parseInt(last.playbookRef.replace('PBK-', ''), 10) + 1 : 100;
    return `PBK-${String(num).padStart(4, '0')}`;
  }

  private async nextScheduleRef(tenantId: string): Promise<string> {
    const last = await this.prisma.huntSchedule.findFirst({
      where: { tenantId },
      orderBy: { scheduleRef: 'desc' },
      select: { scheduleRef: true },
    });
    const num = last ? parseInt(last.scheduleRef.replace('SCH-', ''), 10) + 1 : 1;
    return `SCH-${String(num).padStart(4, '0')}`;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  async stats(actor: JwtPayload) {
    const tenantId = actor.tenantId!;
    const [total, active, complete, planned, critical, evidenceCount, iocCount, schedulesCount] =
      await Promise.all([
        this.prisma.huntMission.count({ where: { tenantId } }),
        this.prisma.huntMission.count({ where: { tenantId, status: 'ACTIVE' } }),
        this.prisma.huntMission.count({ where: { tenantId, status: 'COMPLETE' } }),
        this.prisma.huntMission.count({ where: { tenantId, status: 'PLANNED' } }),
        this.prisma.huntMission.count({ where: { tenantId, priority: 'CRITICAL' } }),
        this.prisma.huntEvidence.count({ where: { tenantId, isFalsePositive: false } }),
        this.prisma.huntIOC.count({ where: { tenantId } }),
        this.prisma.huntSchedule.count({ where: { tenantId, isEnabled: true } }),
      ]);

    const recentMissions = await this.prisma.huntMission.findMany({
      where: { tenantId, status: { in: ['ACTIVE', 'PLANNED'] } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 5,
      include: {
        _count: { select: { evidence: { where: { isFalsePositive: false } }, iocs: true } },
      },
    });

    return {
      total,
      active,
      complete,
      planned,
      critical,
      evidenceCount,
      iocCount,
      schedulesCount,
      recentMissions,
    };
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
    const missionRef = await this.nextMissionRef(actor.tenantId!);
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
      include: { _count: { select: { evidence: true, iocs: true } } },
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

  // ── Evidence ──────────────────────────────────────────────────────────────────

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

  // ── Playbooks ─────────────────────────────────────────────────────────────────

  async listPlaybooks(actor: JwtPayload) {
    return this.prisma.huntPlaybook.findMany({
      where: {
        OR: [{ isGlobal: true }, { tenantId: actor.tenantId }],
      },
      include: { _count: { select: { schedules: { where: { tenantId: actor.tenantId } } } } },
      orderBy: [{ isGlobal: 'desc' }, { severity: 'asc' }, { title: 'asc' }],
    });
  }

  async getPlaybook(actor: JwtPayload, id: string) {
    const pb = await this.prisma.huntPlaybook.findFirst({
      where: { id, OR: [{ isGlobal: true }, { tenantId: actor.tenantId }] },
      include: {
        schedules: {
          where: { tenantId: actor.tenantId },
          include: { integration: { select: { id: true, name: true, platform: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!pb) throw new NotFoundException('Playbook not found');
    return pb;
  }

  async createPlaybook(actor: JwtPayload, dto: CreatePlaybookDto) {
    const playbookRef = await this.nextPlaybookRef(actor.tenantId!);
    return this.prisma.huntPlaybook.create({
      data: {
        tenantId: actor.tenantId!,
        playbookRef,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        mitreTacticId: dto.mitreTacticId,
        mitreTactic: dto.mitreTactic,
        mitreTechniques: dto.mitreTechniques ?? [],
        severity: dto.severity ?? 'MEDIUM',
        estimatedHours: dto.estimatedHours ? Number(dto.estimatedHours) : 4,
        tags: dto.tags ?? [],
        queries: (dto.queries ?? []) as object,
        isGlobal: false,
      },
    });
  }

  async updatePlaybook(actor: JwtPayload, id: string, dto: UpdatePlaybookDto) {
    const pb = await this.prisma.huntPlaybook.findFirst({
      where: { id, tenantId: actor.tenantId, isGlobal: false },
    });
    if (!pb) throw new NotFoundException('Playbook not found or is a global playbook');
    return this.prisma.huntPlaybook.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.mitreTacticId !== undefined && { mitreTacticId: dto.mitreTacticId }),
        ...(dto.mitreTactic !== undefined && { mitreTactic: dto.mitreTactic }),
        ...(dto.mitreTechniques !== undefined && { mitreTechniques: dto.mitreTechniques }),
        ...(dto.severity !== undefined && { severity: dto.severity }),
        ...(dto.estimatedHours !== undefined && { estimatedHours: Number(dto.estimatedHours) }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.queries !== undefined && { queries: dto.queries as object }),
      },
    });
  }

  async deletePlaybook(actor: JwtPayload, id: string) {
    const pb = await this.prisma.huntPlaybook.findFirst({
      where: { id, tenantId: actor.tenantId, isGlobal: false },
    });
    if (!pb) throw new NotFoundException('Playbook not found or is a global playbook');
    await this.prisma.huntPlaybook.delete({ where: { id } });
  }

  async launchPlaybook(actor: JwtPayload, id: string, dto: LaunchPlaybookDto) {
    const pb = await this.getPlaybook(actor, id);
    const missionRef = await this.nextMissionRef(actor.tenantId!);
    const techniques = pb.mitreTechniques ?? [];
    const mission = await this.prisma.huntMission.create({
      data: {
        tenantId: actor.tenantId!,
        missionRef,
        title: pb.title,
        hypothesis: `Systematic threat hunt based on playbook: ${pb.description}`,
        status: 'ACTIVE',
        priority:
          pb.severity === 'CRITICAL' ? 'CRITICAL' : pb.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
        tacticId: pb.mitreTacticId ?? undefined,
        tactic: pb.mitreTactic ?? undefined,
        techniques: techniques as string[],
        analystId: actor.sub,
        analystName: dto.analystName ?? actor.sub,
        startDate: new Date(),
        notes: dto.notes ?? `Launched from playbook ${pb.playbookRef}: ${pb.title}`,
      },
      include: { _count: { select: { evidence: true, iocs: true } } },
    });
    return { mission, playbook: pb };
  }

  // Run a single Splunk query from a playbook (ad-hoc, not scheduled)
  async runPlaybookQuery(actor: JwtPayload, dto: RunPlaybookQueryDto) {
    const { integrationId, query, earliest = '-24h', latest = 'now' } = dto;
    return this.integrations.runArbitraryQuery(actor, integrationId, query, earliest, latest);
  }

  // ── Schedules ─────────────────────────────────────────────────────────────────

  async listSchedules(actor: JwtPayload) {
    return this.prisma.huntSchedule.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        playbook: {
          select: { id: true, playbookRef: true, title: true, category: true, severity: true },
        },
        integration: { select: { id: true, name: true, platform: true, status: true } },
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 5,
          select: { id: true, startedAt: true, status: true, resultCount: true, missionId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSchedule(actor: JwtPayload, id: string) {
    const s = await this.prisma.huntSchedule.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        playbook: true,
        integration: { select: { id: true, name: true, platform: true, status: true } },
        runs: { orderBy: { startedAt: 'desc' }, take: 20 },
      },
    });
    if (!s) throw new NotFoundException('Schedule not found');
    return s;
  }

  async createSchedule(actor: JwtPayload, dto: CreateScheduleDto) {
    const tenantId = actor.tenantId!;
    // Validate playbook and integration belong to this tenant
    const [pb, integration] = await Promise.all([
      this.prisma.huntPlaybook.findFirst({
        where: { id: dto.playbookId, OR: [{ isGlobal: true }, { tenantId }] },
      }),
      this.prisma.integration.findFirst({
        where: { id: dto.integrationId, tenantId, platform: 'SPLUNK' },
      }),
    ]);
    if (!pb) throw new NotFoundException('Playbook not found');
    if (!integration)
      throw new BadRequestException('Integration not found or is not a Splunk integration');

    const scheduleRef = await this.nextScheduleRef(tenantId);
    const nextRunAt = this.cronNextRun(dto.cronExpression);

    return this.prisma.huntSchedule.create({
      data: {
        tenantId,
        playbookId: dto.playbookId,
        integrationId: dto.integrationId,
        scheduleRef,
        name: dto.name,
        cronExpression: dto.cronExpression,
        isEnabled: dto.isEnabled ?? true,
        nextRunAt,
        autoCreateMission: dto.autoCreateMission ?? true,
        minResultCount: dto.minResultCount ?? 1,
      },
      include: {
        playbook: { select: { id: true, title: true, category: true } },
        integration: { select: { id: true, name: true, platform: true } },
      },
    });
  }

  async updateSchedule(actor: JwtPayload, id: string, dto: UpdateScheduleDto) {
    await this.getSchedule(actor, id);
    const nextRunAt = dto.cronExpression ? this.cronNextRun(dto.cronExpression) : undefined;
    return this.prisma.huntSchedule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.cronExpression !== undefined && { cronExpression: dto.cronExpression }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.autoCreateMission !== undefined && { autoCreateMission: dto.autoCreateMission }),
        ...(dto.minResultCount !== undefined && { minResultCount: dto.minResultCount }),
        ...(nextRunAt && { nextRunAt }),
      },
      include: {
        playbook: { select: { id: true, title: true, category: true } },
        integration: { select: { id: true, name: true, platform: true } },
      },
    });
  }

  async deleteSchedule(actor: JwtPayload, id: string) {
    await this.getSchedule(actor, id);
    await this.prisma.huntSchedule.delete({ where: { id } });
  }

  // Trigger a scheduled hunt run immediately (manual trigger)
  async triggerSchedule(actor: JwtPayload, id: string) {
    const schedule = await this.getSchedule(actor, id);
    return this.executeScheduleRun(schedule as Parameters<typeof this.executeScheduleRun>[0]);
  }

  // ── Schedule execution (used by cron + manual trigger) ────────────────────────

  async executeScheduleRun(schedule: {
    id: string;
    tenantId: string;
    integrationId: string;
    autoCreateMission: boolean;
    minResultCount: number;
    playbook: {
      id: string;
      title: string;
      description: string;
      mitreTacticId: string | null;
      mitreTactic: string | null;
      mitreTechniques: string[];
      severity: string;
      queries: unknown;
    };
  }) {
    const tenantId = schedule.tenantId;

    const run = await this.prisma.huntScheduleRun.create({
      data: { scheduleId: schedule.id, tenantId, status: 'RUNNING' },
    });

    try {
      const queries = (schedule.playbook.queries as PlaybookQuery[]) ?? [];
      const queryResults: Array<{
        name: string;
        resultCount: number;
        sample: Record<string, string>[];
      }> = [];
      let totalResults = 0;

      const mockActor: JwtPayload = {
        sub: 'scheduler',
        supabaseId: 'scheduler',
        tenantId,
        role: 'ADMIN',
        email: 'scheduler@system',
      };

      for (const q of queries) {
        try {
          const result = await this.integrations.runArbitraryQuery(
            mockActor,
            schedule.integrationId,
            q.query,
            q.earliest ?? '-24h',
            q.latest ?? 'now',
          );
          queryResults.push({
            name: q.name,
            resultCount: result.resultCount,
            sample: result.results.slice(0, 3),
          });
          totalResults += result.resultCount;
        } catch {
          queryResults.push({ name: q.name, resultCount: 0, sample: [] });
        }
      }

      let missionId: string | null = null;
      if (schedule.autoCreateMission && totalResults >= schedule.minResultCount) {
        const missionRef = await this.nextMissionRef(tenantId);
        const techniques = schedule.playbook.mitreTechniques ?? [];
        const mission = await this.prisma.huntMission.create({
          data: {
            tenantId,
            missionRef,
            title: `[Auto] ${schedule.playbook.title}`,
            hypothesis: `Automated hunt detected ${totalResults} result(s). Review evidence for threat validation.`,
            status: 'ACTIVE',
            priority: schedule.playbook.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
            tacticId: schedule.playbook.mitreTacticId ?? undefined,
            tactic: schedule.playbook.mitreTactic ?? undefined,
            techniques: techniques as string[],
            analystName: 'Automated Hunt',
            startDate: new Date(),
          },
        });
        missionId = mission.id;

        // Attach query results as evidence
        for (const qr of queryResults.filter((q) => q.resultCount > 0)) {
          await this.prisma.huntEvidence.create({
            data: {
              missionId: mission.id,
              tenantId,
              type: 'FINDING',
              title: `[Splunk] ${qr.name}`,
              body: `Splunk query returned ${qr.resultCount} result(s).\n\nSample (first 3):\n${JSON.stringify(qr.sample, null, 2)}`,
              severity: schedule.playbook.severity,
              analystName: 'Automated Hunt',
              rawData: qr as unknown as Record<string, string>,
            },
          });
        }
      }

      const status = totalResults >= schedule.minResultCount ? 'SUCCESS' : 'NO_RESULTS';
      await this.prisma.huntScheduleRun.update({
        where: { id: run.id },
        data: {
          completedAt: new Date(),
          status,
          resultCount: totalResults,
          missionId: missionId ?? undefined,
          querySummary: queryResults as object,
        },
      });

      await this.prisma.huntSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: status,
          nextRunAt: this.cronNextRun(
            (await this.prisma.huntSchedule.findUnique({
              where: { id: schedule.id },
              select: { cronExpression: true },
            }))!.cronExpression,
          ),
        },
      });

      return { run: run.id, status, totalResults, missionId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await this.prisma.huntScheduleRun.update({
        where: { id: run.id },
        data: { completedAt: new Date(), status: 'FAILED', errorMessage: msg },
      });
      await this.prisma.huntSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: new Date(), lastRunStatus: 'FAILED' },
      });
      throw err;
    }
  }

  // Find all enabled schedules due to run now
  async getDueSchedules() {
    return this.prisma.huntSchedule.findMany({
      where: { isEnabled: true, nextRunAt: { lte: new Date() } },
      include: {
        playbook: true,
        integration: { select: { id: true, name: true, platform: true, status: true } },
      },
    });
  }

  // ── Cron helpers ──────────────────────────────────────────────────────────────

  private cronNextRun(expression: string): Date {
    // Simple cron-next approximations for common patterns
    const now = new Date();
    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5) return new Date(now.getTime() + 3600000);

    const [min, hour, dom, month, dow] = parts;

    // Daily at specific time: "0 6 * * *"
    if (dom === '*' && month === '*' && dow === '*' && min !== '*' && hour !== '*') {
      const next = new Date(now);
      next.setHours(Number(hour), Number(min), 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next;
    }

    // Weekly on specific day: "0 6 * * 1" (Monday)
    if (dom === '*' && month === '*' && dow !== '*' && min !== '*' && hour !== '*') {
      const targetDow = Number(dow);
      const next = new Date(now);
      next.setHours(Number(hour), Number(min), 0, 0);
      const daysAhead = (targetDow - now.getDay() + 7) % 7 || 7;
      next.setDate(now.getDate() + daysAhead);
      return next;
    }

    // Hourly: "0 * * * *"
    if (hour === '*' && dom === '*') {
      const next = new Date(now);
      next.setMinutes(Number(min) || 0, 0, 0);
      if (next <= now) next.setHours(next.getHours() + 1);
      return next;
    }

    // Default: 1 hour from now
    return new Date(now.getTime() + 3600000);
  }
}
