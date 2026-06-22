import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../database/prisma.service';
import type {
  CreateDetectionDto,
  UpdateDetectionDto,
  BulkToggleDetectionDto,
  ImportDetectionsDto,
  ListDetectionsQueryDto,
  AddLogSourceDto,
} from './dto/create-detection.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type {
  DetectionPlatform,
  DetectionSeverity,
  QueryLanguage,
  DetectionRuleType,
  DetectionLifecycle,
  DetectionWorkflowStatus,
} from '@onemdr/database';

const VALID_PLATFORMS = [
  'SPLUNK',
  'SENTINEL',
  'CHRONICLE',
  'ELASTIC',
  'QRADAR',
  'DEFENDER',
  'SIGMA',
  'CUSTOM',
];
const VALID_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const VALID_LANGUAGES = ['SPL', 'KQL', 'YARA_L', 'EQL', 'AQL', 'SIGMA', 'CUSTOM'];

@Injectable()
export class DetectionsService {
  private readonly logger = new Logger(DetectionsService.name);

  constructor(private readonly db: PrismaService) {}

  async listDetections(actor: JwtPayload, query: ListDetectionsQueryDto) {
    const tenantId = actor.tenantId!;
    const { platform, severity, search, tactic, enabled } = query;

    const detections = await this.db.detection.findMany({
      where: {
        OR: [{ isGlobal: true }, { tenantId, isGlobal: false }],
        ...(platform ? { platform: platform as DetectionPlatform } : {}),
        ...(severity ? { severity: severity as DetectionSeverity } : {}),
        ...(tactic ? { mitreTactic: { contains: tactic, mode: 'insensitive' as const } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { ruleId: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
                { mitreAttackId: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: {
        tenantDetections: { where: { tenantId } },
        stats: { where: { tenantId }, orderBy: { date: 'desc' }, take: 30 },
        // Count active SIEM deployments for this tenant's integrations
        siemDeployments: {
          where: { status: 'deployed', integration: { tenantId } },
          select: { id: true },
        },
      },
      orderBy: [{ isGlobal: 'desc' }, { ruleId: 'asc' }],
    });

    return detections
      .map((d) => {
        const td = d.tenantDetections[0];
        const isEnabled = td?.isEnabled ?? false;

        if (enabled === 'true' && !isEnabled) return null;
        if (enabled === 'false' && isEnabled) return null;

        const triggerCount = d.stats.reduce((s, r) => s + r.triggerCount, 0);
        const truePositives = d.stats.reduce((s, r) => s + r.truePositives, 0);
        const falsePositives = d.stats.reduce((s, r) => s + r.falsePositives, 0);

        return {
          id: d.id,
          ruleId: d.ruleId,
          name: d.name,
          description: d.description,
          severity: d.severity,
          platform: d.platform,
          mitreAttackId: d.mitreAttackId,
          mitreTactic: d.mitreTactic,
          mitreTechnique: d.mitreTechnique,
          nistControls: d.nistControls,
          dataSources: d.dataSources,
          logSources: d.logSources,
          deviceTypes: d.deviceTypes,
          query: d.query,
          queryLanguage: d.queryLanguage,
          tags: d.tags,
          expectedAlertsPerDay: d.expectedAlertsPerDay ? Number(d.expectedAlertsPerDay) : null,
          expectedFpRate: d.expectedFpRate ? Number(d.expectedFpRate) : null,
          expectedMttdHours: d.expectedMttdHours ? Number(d.expectedMttdHours) : null,
          isGlobal: d.isGlobal,
          isEnabled,
          isCustom: !d.isGlobal,
          // deployedCount = number of SIEMs this detection is actively deployed to
          deployedCount: d.siemDeployments.length,
          ruleType: d.ruleType,
          lifecycleStage: d.lifecycleStage,
          workflowStatus: d.workflowStatus,
          ownerName: d.ownerName,
          stats: { triggerCount, truePositives, falsePositives },
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      })
      .filter(Boolean);
  }

  async getDetection(id: string, actor: JwtPayload) {
    const tenantId = actor.tenantId!;

    const d = await this.db.detection.findFirst({
      where: { id, OR: [{ isGlobal: true }, { tenantId }] },
      include: {
        tenantDetections: { where: { tenantId } },
        stats: { where: { tenantId }, orderBy: { date: 'asc' }, take: 90 },
      },
    });

    if (!d) throw new NotFoundException('Detection not found');

    const td = d.tenantDetections[0];
    return {
      id: d.id,
      ruleId: d.ruleId,
      name: d.name,
      description: d.description,
      severity: d.severity,
      platform: d.platform,
      mitreAttackId: d.mitreAttackId,
      mitreTactic: d.mitreTactic,
      mitreTechnique: d.mitreTechnique,
      nistControls: d.nistControls,
      dataSources: d.dataSources,
      logSources: d.logSources,
      deviceTypes: d.deviceTypes,
      query: d.query,
      queryLanguage: d.queryLanguage,
      tags: d.tags,
      expectedAlertsPerDay: d.expectedAlertsPerDay ? Number(d.expectedAlertsPerDay) : null,
      expectedFpRate: d.expectedFpRate ? Number(d.expectedFpRate) : null,
      expectedMttdHours: d.expectedMttdHours ? Number(d.expectedMttdHours) : null,
      isGlobal: d.isGlobal,
      isEnabled: td?.isEnabled ?? false,
      isCustom: !d.isGlobal,
      ruleType: d.ruleType,
      lifecycleStage: d.lifecycleStage,
      workflowStatus: d.workflowStatus,
      ownerName: d.ownerName,
      stats: d.stats.map((s) => ({
        date: s.date,
        triggerCount: s.triggerCount,
        truePositives: s.truePositives,
        falsePositives: s.falsePositives,
        mttdMinutes: s.mttdMinutes ? Number(s.mttdMinutes) : null,
      })),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  async toggleDetection(detectionId: string, enable: boolean, actor: JwtPayload) {
    const tenantId = actor.tenantId!;

    const detection = await this.db.detection.findFirst({
      where: { id: detectionId, OR: [{ isGlobal: true }, { tenantId }] },
    });
    if (!detection) throw new NotFoundException('Detection not found');

    return this.db.tenantDetection.upsert({
      where: { tenantId_detectionId: { tenantId, detectionId } },
      create: { tenantId, detectionId, isEnabled: enable, enabledById: actor.sub },
      update: { isEnabled: enable, enabledAt: new Date(), enabledById: actor.sub },
    });
  }

  async createDetection(dto: CreateDetectionDto, actor: JwtPayload) {
    const tenantId = actor.tenantId!;

    const count = await this.db.detection.count({ where: { tenantId, isGlobal: false } });
    const ruleId = `CUSTOM-${tenantId.slice(0, 8).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;

    const actorUser = await this.db.user.findFirst({
      where: { id: actor.sub },
      select: { firstName: true, lastName: true },
    });
    const ownerName = actorUser
      ? `${actorUser.firstName} ${actorUser.lastName}`.trim()
      : actor.email;

    const detection = await this.db.detection.create({
      data: {
        ruleId,
        name: dto.name,
        description: dto.description,
        severity: dto.severity,
        platform: dto.platform,
        mitreAttackId: dto.mitreAttackId ?? null,
        mitreTactic: dto.mitreTactic ?? null,
        mitreTechnique: dto.mitreTechnique ?? null,
        nistControls: dto.nistControls ?? [],
        dataSources: dto.dataSources ?? [],
        query: dto.query,
        queryLanguage: dto.queryLanguage,
        tags: dto.tags ?? [],
        expectedAlertsPerDay: dto.expectedAlertsPerDay ?? null,
        expectedFpRate: dto.expectedFpRate ?? null,
        expectedMttdHours: dto.expectedMttdHours ?? null,
        isGlobal: false,
        tenantId,
        ruleType: (dto.ruleType as DetectionRuleType) ?? null,
        lifecycleStage: (dto.lifecycleStage as DetectionLifecycle) ?? 'EXPERIMENTAL',
        workflowStatus: (dto.workflowStatus as DetectionWorkflowStatus) ?? 'PENDING',
        ownerName,
        ownerId: actor.sub,
      },
    });

    // Auto-enable newly created custom detection for this tenant
    await this.db.tenantDetection.create({
      data: { tenantId, detectionId: detection.id, isEnabled: true, enabledById: actor.sub },
    });

    return {
      ...detection,
      expectedAlertsPerDay: detection.expectedAlertsPerDay
        ? Number(detection.expectedAlertsPerDay)
        : null,
      expectedFpRate: detection.expectedFpRate ? Number(detection.expectedFpRate) : null,
      expectedMttdHours: detection.expectedMttdHours ? Number(detection.expectedMttdHours) : null,
      isEnabled: true,
      isCustom: true,
      stats: { triggerCount: 0, truePositives: 0, falsePositives: 0 },
    };
  }

  async bulkToggleDetections(dto: BulkToggleDetectionDto, actor: JwtPayload) {
    const tenantId = actor.tenantId!;
    await Promise.all(
      dto.ids.map((detectionId) =>
        this.db.tenantDetection.upsert({
          where: { tenantId_detectionId: { tenantId, detectionId } },
          create: { tenantId, detectionId, isEnabled: dto.enable, enabledById: actor.sub },
          update: { isEnabled: dto.enable, enabledAt: new Date(), enabledById: actor.sub },
        }),
      ),
    );
    return { toggled: dto.ids.length, enabled: dto.enable };
  }

  async updateDetection(id: string, dto: UpdateDetectionDto, actor: JwtPayload) {
    const tenantId = actor.tenantId!;
    const detection = await this.db.detection.findFirst({
      where: { id, tenantId, isGlobal: false },
    });
    if (!detection) throw new NotFoundException('Detection not found or is not editable');

    const updated = await this.db.detection.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(dto.platform !== undefined ? { platform: dto.platform } : {}),
        ...(dto.query !== undefined ? { query: dto.query } : {}),
        ...(dto.queryLanguage !== undefined ? { queryLanguage: dto.queryLanguage } : {}),
        ...(dto.mitreAttackId !== undefined ? { mitreAttackId: dto.mitreAttackId || null } : {}),
        ...(dto.mitreTactic !== undefined ? { mitreTactic: dto.mitreTactic || null } : {}),
        ...(dto.mitreTechnique !== undefined ? { mitreTechnique: dto.mitreTechnique || null } : {}),
        ...(dto.nistControls !== undefined ? { nistControls: dto.nistControls } : {}),
        ...(dto.dataSources !== undefined ? { dataSources: dto.dataSources } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.expectedAlertsPerDay !== undefined
          ? { expectedAlertsPerDay: dto.expectedAlertsPerDay }
          : {}),
        ...(dto.expectedFpRate !== undefined ? { expectedFpRate: dto.expectedFpRate } : {}),
        ...(dto.expectedMttdHours !== undefined
          ? { expectedMttdHours: dto.expectedMttdHours }
          : {}),
        ...(dto.ruleType !== undefined
          ? { ruleType: (dto.ruleType as DetectionRuleType) ?? null }
          : {}),
        ...(dto.lifecycleStage !== undefined
          ? { lifecycleStage: dto.lifecycleStage as DetectionLifecycle }
          : {}),
        ...(dto.workflowStatus !== undefined
          ? { workflowStatus: dto.workflowStatus as DetectionWorkflowStatus }
          : {}),
      },
      include: { tenantDetections: { where: { tenantId } } },
    });

    return {
      id: updated.id,
      ruleId: updated.ruleId,
      name: updated.name,
      description: updated.description,
      severity: updated.severity,
      platform: updated.platform,
      mitreAttackId: updated.mitreAttackId,
      mitreTactic: updated.mitreTactic,
      mitreTechnique: updated.mitreTechnique,
      nistControls: updated.nistControls,
      dataSources: updated.dataSources,
      logSources: updated.logSources,
      deviceTypes: updated.deviceTypes,
      query: updated.query,
      queryLanguage: updated.queryLanguage,
      tags: updated.tags,
      expectedAlertsPerDay: updated.expectedAlertsPerDay
        ? Number(updated.expectedAlertsPerDay)
        : null,
      expectedFpRate: updated.expectedFpRate ? Number(updated.expectedFpRate) : null,
      expectedMttdHours: updated.expectedMttdHours ? Number(updated.expectedMttdHours) : null,
      isGlobal: updated.isGlobal,
      isEnabled: updated.tenantDetections[0]?.isEnabled ?? false,
      isCustom: true,
      ruleType: updated.ruleType,
      lifecycleStage: updated.lifecycleStage,
      workflowStatus: updated.workflowStatus,
      ownerName: updated.ownerName,
      stats: { triggerCount: 0, truePositives: 0, falsePositives: 0 },
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async duplicateDetection(id: string, actor: JwtPayload) {
    const tenantId = actor.tenantId!;
    const source = await this.db.detection.findFirst({
      where: { id, OR: [{ isGlobal: true }, { tenantId }] },
    });
    if (!source) throw new NotFoundException('Detection not found');

    const count = await this.db.detection.count({ where: { tenantId, isGlobal: false } });
    const ruleId = `CUSTOM-${tenantId.slice(0, 8).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;

    const actorUser = await this.db.user.findFirst({
      where: { id: actor.sub },
      select: { firstName: true, lastName: true },
    });
    const ownerName = actorUser
      ? `${actorUser.firstName} ${actorUser.lastName}`.trim()
      : actor.email;

    const copy = await this.db.detection.create({
      data: {
        ruleId,
        name: `${source.name} (Copy)`,
        description: source.description,
        severity: source.severity,
        platform: source.platform,
        mitreAttackId: source.mitreAttackId,
        mitreTactic: source.mitreTactic,
        mitreTechnique: source.mitreTechnique,
        nistControls: source.nistControls,
        dataSources: source.dataSources,
        query: source.query,
        queryLanguage: source.queryLanguage,
        tags: source.tags,
        expectedAlertsPerDay: source.expectedAlertsPerDay,
        expectedFpRate: source.expectedFpRate,
        expectedMttdHours: source.expectedMttdHours,
        isGlobal: false,
        tenantId,
        ruleType: source.ruleType,
        lifecycleStage: source.lifecycleStage ?? 'EXPERIMENTAL',
        workflowStatus: 'PENDING',
        ownerName,
        ownerId: actor.sub,
      },
    });

    await this.db.tenantDetection.create({
      data: { tenantId, detectionId: copy.id, isEnabled: true, enabledById: actor.sub },
    });

    return {
      id: copy.id,
      ruleId: copy.ruleId,
      name: copy.name,
      description: copy.description,
      severity: copy.severity,
      platform: copy.platform,
      mitreAttackId: copy.mitreAttackId,
      mitreTactic: copy.mitreTactic,
      mitreTechnique: copy.mitreTechnique,
      nistControls: copy.nistControls,
      dataSources: copy.dataSources,
      logSources: copy.logSources,
      deviceTypes: copy.deviceTypes,
      query: copy.query,
      queryLanguage: copy.queryLanguage,
      tags: copy.tags,
      expectedAlertsPerDay: copy.expectedAlertsPerDay ? Number(copy.expectedAlertsPerDay) : null,
      expectedFpRate: copy.expectedFpRate ? Number(copy.expectedFpRate) : null,
      expectedMttdHours: copy.expectedMttdHours ? Number(copy.expectedMttdHours) : null,
      isGlobal: false,
      isEnabled: true,
      isCustom: true,
      ruleType: copy.ruleType,
      lifecycleStage: copy.lifecycleStage,
      workflowStatus: copy.workflowStatus,
      ownerName: copy.ownerName,
      stats: { triggerCount: 0, truePositives: 0, falsePositives: 0 },
      createdAt: copy.createdAt,
      updatedAt: copy.updatedAt,
    };
  }

  async importDetections(dto: ImportDetectionsDto, actor: JwtPayload) {
    const tenantId = actor.tenantId!;
    const buffer = Buffer.from(dto.data, 'base64');

    let rows: Record<string, string>[];
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    } catch {
      throw new BadRequestException('Invalid Excel file — could not parse workbook');
    }

    if (!rows.length) throw new BadRequestException('Excel file contains no data rows');
    if (rows.length > 500) throw new BadRequestException('Maximum 500 rows per import');

    const existing = await this.db.detection.count({ where: { tenantId, isGlobal: false } });
    const errors: string[] = [];
    let imported = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const missing = ['name', 'query', 'platform', 'queryLanguage', 'severity'].filter(
        (f) => !row[f],
      );
      if (missing.length) {
        errors.push(`Row ${rowNum}: missing required field(s): ${missing.join(', ')}`);
        continue;
      }

      const platform = row['platform'].toUpperCase() as DetectionPlatform;
      const severity = row['severity'].toUpperCase() as DetectionSeverity;
      const queryLanguage = row['queryLanguage'].toUpperCase().replace(/-/g, '_') as QueryLanguage;

      if (!VALID_PLATFORMS.includes(platform)) {
        errors.push(`Row ${rowNum}: invalid platform "${row['platform']}"`);
        continue;
      }
      if (!VALID_SEVERITIES.includes(severity)) {
        errors.push(`Row ${rowNum}: invalid severity "${row['severity']}"`);
        continue;
      }
      if (!VALID_LANGUAGES.includes(queryLanguage)) {
        errors.push(`Row ${rowNum}: invalid queryLanguage "${row['queryLanguage']}"`);
        continue;
      }

      try {
        const ruleId = `CUSTOM-${tenantId.slice(0, 8).toUpperCase()}-${String(existing + imported + 1).padStart(4, '0')}`;

        const detection = await this.db.detection.create({
          data: {
            ruleId,
            name: row['name'],
            description: row['description'] ?? '',
            severity,
            platform,
            mitreAttackId: row['mitreAttackId'] || null,
            mitreTactic: row['mitreTactic'] || null,
            mitreTechnique: row['mitreTechnique'] || null,
            nistControls: row['nistControls']
              ? row['nistControls']
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
            dataSources: row['dataSources']
              ? row['dataSources']
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
            query: row['query'],
            queryLanguage,
            tags: row['tags']
              ? row['tags']
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
            isGlobal: false,
            tenantId,
          },
        });

        await this.db.tenantDetection.create({
          data: { tenantId, detectionId: detection.id, isEnabled: true, enabledById: actor.sub },
        });

        imported++;
      } catch (err) {
        this.logger.error(`Import row ${rowNum} failed: ${String(err)}`);
        errors.push(`Row ${rowNum}: creation failed`);
      }
    }

    return { imported, skipped: errors.length, errors };
  }

  async getSummary(actor: JwtPayload) {
    const tenantId = actor.tenantId!;

    const detections = await this.db.detection.findMany({
      where: {
        OR: [{ isGlobal: true }, { tenantId, isGlobal: false }],
      },
      include: {
        tenantDetections: { where: { tenantId } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const withEnabled = detections.map((d) => ({
      ...d,
      isEnabled: d.tenantDetections[0]?.isEnabled ?? false,
    }));
    const enabled = withEnabled.filter((d) => d.isEnabled);

    const byPlatform: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byTactic: Record<string, number> = {};
    const techniqueCountMap: Record<string, number> = {};

    // byPlatform / bySeverity / byTactic — only count enabled detections
    for (const d of enabled) {
      byPlatform[d.platform] = (byPlatform[d.platform] ?? 0) + 1;
      bySeverity[d.severity] = (bySeverity[d.severity] ?? 0) + 1;
      if (d.mitreTactic) {
        byTactic[d.mitreTactic] = (byTactic[d.mitreTactic] ?? 0) + 1;
      }
    }

    // techniqueCountMap — global detections count only when enabled by this tenant;
    // custom (tenant-created, isGlobal=false) detections always count since the tenant owns them.
    for (const d of withEnabled) {
      if (d.mitreAttackId && (d.isEnabled || !d.isGlobal)) {
        techniqueCountMap[d.mitreAttackId] = (techniqueCountMap[d.mitreAttackId] ?? 0) + 1;
      }
    }

    const fpRates = enabled
      .filter((d) => d.expectedFpRate != null)
      .map((d) => Number(d.expectedFpRate));
    const avgFpRate =
      fpRates.length > 0 ? fpRates.reduce((a, b) => a + b, 0) / fpRates.length : null;

    const mttds = enabled
      .filter((d) => d.expectedMttdHours != null)
      .map((d) => Number(d.expectedMttdHours));
    const avgMttdHours = mttds.length > 0 ? mttds.reduce((a, b) => a + b, 0) / mttds.length : null;

    const alertRates = enabled
      .filter((d) => d.expectedAlertsPerDay != null)
      .map((d) => Number(d.expectedAlertsPerDay));
    const totalAlertsPerDay = alertRates.length > 0 ? alertRates.reduce((a, b) => a + b, 0) : null;

    // Count distinct detections that are actively deployed to at least one of this tenant's SIEMs
    const deployedRows = await this.db.siemDeployment.findMany({
      where: { status: 'deployed', integration: { tenantId } },
      select: { detectionId: true },
      distinct: ['detectionId'],
    });
    const deployedDetections = deployedRows.length;

    const recentDetections = withEnabled.slice(0, 10).map((d) => ({
      id: d.id,
      ruleId: d.ruleId,
      name: d.name,
      mitreAttackId: d.mitreAttackId,
      mitreTactic: d.mitreTactic,
      severity: d.severity,
      platform: d.platform,
      expectedFpRate: d.expectedFpRate ? Number(d.expectedFpRate) : null,
      expectedAlertsPerDay: d.expectedAlertsPerDay ? Number(d.expectedAlertsPerDay) : null,
      isEnabled: d.isEnabled,
      updatedAt: d.updatedAt,
    }));

    return {
      totalDetections: detections.length,
      enabledDetections: enabled.length,
      deployedDetections,
      byPlatform,
      bySeverity,
      byTactic,
      avgFpRate,
      avgMttdHours,
      totalAlertsPerDay,
      techniqueCountMap,
      recentDetections,
    };
  }

  async getStats(detectionId: string, actor: JwtPayload) {
    const tenantId = actor.tenantId!;

    const detection = await this.db.detection.findFirst({
      where: { id: detectionId, OR: [{ isGlobal: true }, { tenantId }] },
    });
    if (!detection) throw new NotFoundException('Detection not found');

    const stats = await this.db.detectionStat.findMany({
      where: { tenantId, detectionId },
      orderBy: { date: 'asc' },
      take: 90,
    });

    return stats.map((s) => ({
      date: s.date,
      triggerCount: s.triggerCount,
      truePositives: s.truePositives,
      falsePositives: s.falsePositives,
      mttdMinutes: s.mttdMinutes ? Number(s.mttdMinutes) : null,
    }));
  }

  // ── Log source management ─────────────────────────────────────────────────────

  async listLogSources(actor: JwtPayload) {
    const tenantId = actor.tenantId!;
    return this.db.tenantLogSource.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addLogSource(dto: AddLogSourceDto, actor: JwtPayload) {
    const tenantId = actor.tenantId!;
    try {
      return await this.db.tenantLogSource.create({
        data: {
          tenantId,
          logSource: dto.logSource,
          deviceType: dto.deviceType ?? null,
          vendor: dto.vendor ?? null,
        },
      });
    } catch (err: unknown) {
      const isUniqueViolation =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002';
      if (isUniqueViolation) {
        throw new ConflictException(`Log source "${dto.logSource}" is already registered`);
      }
      throw err;
    }
  }

  async removeLogSource(id: string, actor: JwtPayload) {
    const tenantId = actor.tenantId!;
    const existing = await this.db.tenantLogSource.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Log source not found');
    await this.db.tenantLogSource.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Smart detection proposals ─────────────────────────────────────────────────

  async getProposals(actor: JwtPayload) {
    const tenantId = actor.tenantId!;

    const tenantLogSources = await this.db.tenantLogSource.findMany({ where: { tenantId } });
    if (!tenantLogSources.length) {
      return { proposals: [], totalLogSources: 0, message: 'No log sources registered' };
    }

    const registeredSources = tenantLogSources.map((ls) => ls.logSource);

    // Fetch detections whose logSources array overlaps with the tenant's registered sources
    const candidates = await this.db.detection.findMany({
      where: {
        OR: [{ isGlobal: true }, { tenantId, isGlobal: false }],
        logSources: { hasSome: registeredSources },
      },
      include: { tenantDetections: { where: { tenantId } } },
      orderBy: [{ severity: 'asc' }, { ruleId: 'asc' }],
      take: 200,
    });

    // Filter out already-enabled detections
    const proposals = candidates
      .filter((d) => !(d.tenantDetections[0]?.isEnabled ?? false))
      .map((d) => ({
        id: d.id,
        ruleId: d.ruleId,
        name: d.name,
        description: d.description,
        severity: d.severity,
        platform: d.platform,
        mitreAttackId: d.mitreAttackId,
        mitreTactic: d.mitreTactic,
        logSources: d.logSources,
        deviceTypes: d.deviceTypes,
        matchedSources: d.logSources.filter((ls) => registeredSources.includes(ls)),
      }));

    return {
      proposals,
      totalLogSources: tenantLogSources.length,
      registeredSources,
    };
  }
}
