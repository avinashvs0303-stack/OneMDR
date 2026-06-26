import { Injectable, NotFoundException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@onemdr/database';
import { PrismaService } from '../database/prisma.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type {
  CreateModelDto,
  UpdateModelStatusDto,
  CreateComponentDto,
  CreateFlowDto,
  UpdateThreatDto,
  AddThreatDto,
} from './dto/threat-models.dto';
import { COMPONENT_THREATS, FLOW_THREAT_RULES, type ComponentType } from './stride-rules';

function p2021(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2021' || e.code === 'P2010')
  );
}

function mig() {
  throw new ServiceUnavailableException(
    'Threat model tables not found. Run migration 20260626000002_threat_models in Supabase SQL Editor.',
  );
}

@Injectable()
export class ThreatModelsService {
  private readonly logger = new Logger(ThreatModelsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Ownership guard ───────────────────────────────────────────────────────

  private async assertOwner(modelId: string, tenantId: string) {
    const m = await this.prisma.threatModel.findFirst({
      where: { id: modelId, tenantId },
      select: { id: true },
    });
    if (!m) throw new NotFoundException('Threat model not found');
    return m;
  }

  // ── Models ────────────────────────────────────────────────────────────────

  async listModels(user: JwtPayload) {
    try {
      return await this.prisma.threatModel.findMany({
        where: { tenantId: user.tenantId! },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          environment: true,
          status: true,
          createdByName: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { components: true, dataFlows: true, threats: true },
          },
        },
      });
    } catch (e) {
      if (p2021(e)) mig();
      throw e;
    }
  }

  async createModel(user: JwtPayload, dto: CreateModelDto) {
    try {
      const model = await this.prisma.threatModel.create({
        data: {
          tenantId: user.tenantId!,
          name: dto.name,
          description: dto.description ?? '',
          environment: dto.environment,
          createdById: user.sub,
          createdByName: `User ${user.sub.slice(0, 6)}`,
        },
      });
      this.logger.log(
        { event: 'threat_model.created', modelId: model.id, tenantId: user.tenantId },
        'Threat model created',
      );
      return model;
    } catch (e) {
      if (p2021(e)) mig();
      throw e;
    }
  }

  async getModel(user: JwtPayload, id: string) {
    try {
      const model = await this.prisma.threatModel.findFirst({
        where: { id, tenantId: user.tenantId! },
        include: {
          components: { orderBy: { createdAt: 'asc' } },
          dataFlows: {
            orderBy: { createdAt: 'asc' },
            include: {
              source: { select: { id: true, name: true, componentType: true } },
              target: { select: { id: true, name: true, componentType: true } },
            },
          },
          threats: { orderBy: { riskScore: 'desc' } },
        },
      });
      if (!model) throw new NotFoundException('Threat model not found');
      return model;
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      if (p2021(e)) mig();
      throw e;
    }
  }

  async updateModelStatus(user: JwtPayload, id: string, dto: UpdateModelStatusDto) {
    await this.assertOwner(id, user.tenantId!);
    return this.prisma.threatModel.update({
      where: { id },
      data: { status: dto.status },
      select: { id: true, status: true },
    });
  }

  async deleteModel(user: JwtPayload, id: string) {
    await this.assertOwner(id, user.tenantId!);
    await this.prisma.threatModel.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Components ────────────────────────────────────────────────────────────

  async addComponent(user: JwtPayload, modelId: string, dto: CreateComponentDto) {
    await this.assertOwner(modelId, user.tenantId!);
    return this.prisma.tmComponent.create({
      data: {
        modelId,
        tenantId: user.tenantId!,
        name: dto.name,
        componentType: dto.componentType,
        environment: dto.environment,
        cloudProvider: dto.cloudProvider ?? null,
        serviceName: dto.serviceName ?? null,
        notes: dto.notes ?? null,
      },
    });
  }

  async deleteComponent(user: JwtPayload, modelId: string, componentId: string) {
    await this.assertOwner(modelId, user.tenantId!);
    const c = await this.prisma.tmComponent.findFirst({
      where: { id: componentId, modelId },
    });
    if (!c) throw new NotFoundException('Component not found');
    await this.prisma.tmComponent.delete({ where: { id: componentId } });
    return { deleted: true };
  }

  // ── Data Flows ────────────────────────────────────────────────────────────

  async addFlow(user: JwtPayload, modelId: string, dto: CreateFlowDto) {
    await this.assertOwner(modelId, user.tenantId!);

    // Verify source + target belong to this model
    const [src, tgt] = await Promise.all([
      this.prisma.tmComponent.findFirst({ where: { id: dto.sourceId, modelId } }),
      this.prisma.tmComponent.findFirst({ where: { id: dto.targetId, modelId } }),
    ]);
    if (!src) throw new NotFoundException('Source component not found in this model');
    if (!tgt) throw new NotFoundException('Target component not found in this model');

    return this.prisma.tmDataFlow.create({
      data: {
        modelId,
        sourceId: dto.sourceId,
        targetId: dto.targetId,
        name: dto.name,
        protocol: dto.protocol ?? 'HTTPS',
        dataClassification: dto.dataClassification ?? 'INTERNAL',
        isEncrypted: dto.isEncrypted ?? true,
        crossesTrustBoundary: dto.crossesTrustBoundary ?? false,
        notes: dto.notes ?? null,
      },
    });
  }

  async deleteFlow(user: JwtPayload, modelId: string, flowId: string) {
    await this.assertOwner(modelId, user.tenantId!);
    const f = await this.prisma.tmDataFlow.findFirst({ where: { id: flowId, modelId } });
    if (!f) throw new NotFoundException('Flow not found');
    await this.prisma.tmDataFlow.delete({ where: { id: flowId } });
    return { deleted: true };
  }

  // ── STRIDE threat generation engine ──────────────────────────────────────

  async generateThreats(user: JwtPayload, modelId: string) {
    await this.assertOwner(modelId, user.tenantId!);

    const [components, flows, existingRefs] = await Promise.all([
      this.prisma.tmComponent.findMany({ where: { modelId } }),
      this.prisma.tmDataFlow.findMany({ where: { modelId } }),
      this.prisma.tmThreat
        .findMany({ where: { modelId, isAutoGenerated: true }, select: { sourceRef: true } })
        .then((rows) => new Set(rows.map((r) => r.sourceRef).filter(Boolean) as string[])),
    ]);

    const toCreate: Prisma.TmThreatCreateManyInput[] = [];

    // Component-level threats
    for (const comp of components) {
      const templates = COMPONENT_THREATS[comp.componentType as ComponentType] ?? [];
      for (const tpl of templates) {
        const ref = `comp:${comp.id}:${tpl.stride}:${tpl.attackTechnique}`;
        if (existingRefs.has(ref)) continue;

        toCreate.push({
          modelId,
          componentId: comp.id,
          tenantId: user.tenantId!,
          sourceRef: ref,
          title: tpl.title,
          description: tpl.description,
          strideCategory: tpl.stride,
          attackTactic: tpl.attackTactic,
          attackTechnique: tpl.attackTechnique,
          likelihood: tpl.defaultLikelihood,
          impact: tpl.defaultImpact,
          riskScore: tpl.defaultLikelihood * tpl.defaultImpact,
          isAutoGenerated: true,
        });
      }
    }

    // Data flow threats
    for (const flow of flows) {
      for (const rule of FLOW_THREAT_RULES) {
        const ctx = {
          isEncrypted: flow.isEncrypted,
          crossesTrustBoundary: flow.crossesTrustBoundary,
          dataClassification: flow.dataClassification,
          protocol: flow.protocol,
        };
        if (!rule.condition(ctx)) continue;

        const ref = `flow:${flow.id}:${rule.id}`;
        if (existingRefs.has(ref)) continue;

        const tpl = rule.template;
        toCreate.push({
          modelId,
          flowId: flow.id,
          tenantId: user.tenantId!,
          sourceRef: ref,
          title: tpl.title,
          description: tpl.description.replace("${''}", flow.protocol),
          strideCategory: tpl.stride,
          attackTactic: tpl.attackTactic,
          attackTechnique: tpl.attackTechnique,
          likelihood: tpl.defaultLikelihood,
          impact: tpl.defaultImpact,
          riskScore: tpl.defaultLikelihood * tpl.defaultImpact,
          isAutoGenerated: true,
        });
      }
    }

    if (toCreate.length === 0) {
      return { generated: 0, message: 'No new threats to generate' };
    }

    const { count } = await this.prisma.tmThreat.createMany({
      data: toCreate,
      skipDuplicates: true,
    });

    this.logger.log(
      { event: 'threat_model.threats_generated', modelId, count, tenantId: user.tenantId },
      `Generated ${count} STRIDE threats`,
    );

    return { generated: count };
  }

  // ── Threat CRUD ───────────────────────────────────────────────────────────

  async listThreats(user: JwtPayload, modelId: string) {
    await this.assertOwner(modelId, user.tenantId!);
    return this.prisma.tmThreat.findMany({
      where: { modelId },
      orderBy: { riskScore: 'desc' },
      include: {
        component: { select: { id: true, name: true, componentType: true } },
        flow: { select: { id: true, name: true } },
      },
    });
  }

  async addThreat(user: JwtPayload, modelId: string, dto: AddThreatDto) {
    await this.assertOwner(modelId, user.tenantId!);
    return this.prisma.tmThreat.create({
      data: {
        modelId,
        tenantId: user.tenantId!,
        componentId: dto.componentId ?? null,
        flowId: dto.flowId ?? null,
        title: dto.title,
        description: dto.description ?? '',
        strideCategory: dto.strideCategory,
        attackTactic: dto.attackTactic ?? '',
        attackTechnique: dto.attackTechnique ?? '',
        likelihood: dto.likelihood,
        impact: dto.impact,
        riskScore: dto.likelihood * dto.impact,
        isAutoGenerated: false,
      },
    });
  }

  async updateThreat(user: JwtPayload, modelId: string, threatId: string, dto: UpdateThreatDto) {
    await this.assertOwner(modelId, user.tenantId!);
    const t = await this.prisma.tmThreat.findFirst({ where: { id: threatId, modelId } });
    if (!t) throw new NotFoundException('Threat not found');

    const likelihood = dto.likelihood ?? t.likelihood;
    const impact = dto.impact ?? t.impact;

    return this.prisma.tmThreat.update({
      where: { id: threatId },
      data: {
        status: dto.status ?? t.status,
        likelihood,
        impact,
        riskScore: likelihood * impact,
        mitigationNotes: dto.mitigationNotes ?? t.mitigationNotes,
      },
    });
  }

  async deleteThreat(user: JwtPayload, modelId: string, threatId: string) {
    await this.assertOwner(modelId, user.tenantId!);
    const t = await this.prisma.tmThreat.findFirst({ where: { id: threatId, modelId } });
    if (!t) throw new NotFoundException('Threat not found');
    await this.prisma.tmThreat.delete({ where: { id: threatId } });
    return { deleted: true };
  }

  // ── Risk summary (for dashboard stats) ───────────────────────────────────

  async getRiskSummary(user: JwtPayload, modelId: string) {
    await this.assertOwner(modelId, user.tenantId!);
    const threats = await this.prisma.tmThreat.findMany({
      where: { modelId },
      select: { riskScore: true, strideCategory: true, status: true },
    });

    const summary = {
      total: threats.length,
      open: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      byStride: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    for (const t of threats) {
      if (t.status === 'OPEN') summary.open++;
      const score = t.riskScore ?? 0;
      if (score >= 15) summary.critical++;
      else if (score >= 10) summary.high++;
      else if (score >= 5) summary.medium++;
      else summary.low++;

      summary.byStride[t.strideCategory] = (summary.byStride[t.strideCategory] ?? 0) + 1;
      summary.byStatus[t.status] = (summary.byStatus[t.status] ?? 0) + 1;
    }

    return summary;
  }
}
