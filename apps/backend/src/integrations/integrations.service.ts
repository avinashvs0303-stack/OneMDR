import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { CreateIntegrationDto, UpdateIntegrationDto } from './dto/integrations.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

// Infer model types from Prisma to avoid regeneration dependency
type Integration = Awaited<ReturnType<PrismaService['integration']['findFirst']>> & object;
type Detection = Awaited<ReturnType<PrismaService['detection']['findFirst']>> & object;

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private readonly db: PrismaService) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async list(actor: JwtPayload) {
    const tenantId = actor.tenantId!;
    const integrations = await this.db.integration.findMany({
      where: { tenantId },
      include: { _count: { select: { deployments: { where: { status: 'deployed' } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return integrations.map((i) => ({
      ...i,
      deployedCount: i._count.deployments,
      _count: undefined,
    }));
  }

  async findOne(actor: JwtPayload, id: string) {
    const tenantId = actor.tenantId!;
    const integration = await this.db.integration.findFirst({
      where: { id, tenantId },
      include: {
        deployments: {
          include: { detection: { select: { id: true, ruleId: true, name: true } } },
          orderBy: { deployedAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return integration;
  }

  async create(actor: JwtPayload, dto: CreateIntegrationDto) {
    const tenantId = actor.tenantId!;
    try {
      return await this.db.integration.create({
        data: {
          tenantId,
          platform: dto.platform as Integration['platform'],
          name: dto.name,
          host: dto.host,
          config: (dto.config ?? {}) as object,
          isEnabled: dto.isEnabled ?? true,
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new BadRequestException(
          `An integration named "${dto.name}" for ${dto.platform} already exists`,
        );
      }
      throw err;
    }
  }

  async update(actor: JwtPayload, id: string, dto: UpdateIntegrationDto) {
    const tenantId = actor.tenantId!;
    await this.assertOwnership(tenantId, id);
    return this.db.integration.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.host !== undefined ? { host: dto.host } : {}),
        ...(dto.config !== undefined ? { config: dto.config as object } : {}),
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
      },
    });
  }

  async remove(actor: JwtPayload, id: string) {
    const tenantId = actor.tenantId!;
    await this.assertOwnership(tenantId, id);
    await this.db.integration.delete({ where: { id } });
  }

  // ── Test connection ───────────────────────────────────────────────────────────

  async testConnection(actor: JwtPayload, id: string) {
    const tenantId = actor.tenantId!;
    const integration = await this.db.integration.findFirst({ where: { id, tenantId } });
    if (!integration) throw new NotFoundException('Integration not found');

    const result = await this.pingPlatform(integration);

    await this.db.integration.update({
      where: { id },
      data: {
        status: result.success ? 'CONNECTED' : 'ERROR',
        lastTestedAt: new Date(),
        errorMessage: result.error ?? null,
      },
    });

    return result;
  }

  // ── Deploy / undeploy ─────────────────────────────────────────────────────────

  async deploy(actor: JwtPayload, integrationId: string, detectionId: string) {
    const tenantId = actor.tenantId!;
    const [integration, detection] = await Promise.all([
      this.db.integration.findFirst({ where: { id: integrationId, tenantId } }),
      this.db.detection.findFirst({
        where: { id: detectionId, OR: [{ isGlobal: true }, { tenantId }] },
      }),
    ]);
    if (!integration) throw new NotFoundException('Integration not found');
    if (!detection) throw new NotFoundException('Detection not found');
    if (!integration.isEnabled)
      throw new BadRequestException('Integration is disabled — enable it first');

    let remoteId: string | null = null;
    let status = 'deployed';
    let errorMessage: string | null = null;

    try {
      const deployResult = await this.pushToSiem(integration, detection);
      remoteId = deployResult.remoteId ?? null;
    } catch (err: unknown) {
      status = 'error';
      errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Deploy to ${integration.platform} failed: ${errorMessage}`);
    }

    return this.db.siemDeployment.upsert({
      where: { integrationId_detectionId: { integrationId, detectionId } },
      create: { integrationId, detectionId, remoteId, status, errorMessage },
      update: { remoteId, status, errorMessage, deployedAt: new Date() },
    });
  }

  async undeploy(actor: JwtPayload, integrationId: string, detectionId: string) {
    const tenantId = actor.tenantId!;
    const integration = await this.db.integration.findFirst({
      where: { id: integrationId, tenantId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    const dep = await this.db.siemDeployment.findUnique({
      where: { integrationId_detectionId: { integrationId, detectionId } },
    });
    if (!dep) throw new NotFoundException('No deployment found');

    if (dep.remoteId) {
      try {
        await this.removeFromSiem(integration, dep.remoteId);
      } catch (err: unknown) {
        this.logger.warn(`Undeploy from ${integration.platform} failed: ${String(err)}`);
      }
    }

    return this.db.siemDeployment.update({
      where: { integrationId_detectionId: { integrationId, detectionId } },
      data: { status: 'removed' },
    });
  }

  async listDeployments(actor: JwtPayload, detectionId: string) {
    const tenantId = actor.tenantId!;
    return this.db.siemDeployment.findMany({
      where: {
        detectionId,
        integration: { tenantId },
      },
      include: {
        integration: {
          select: { id: true, name: true, platform: true, isEnabled: true, status: true },
        },
      },
      orderBy: { deployedAt: 'desc' },
    });
  }

  // ── Private: platform adapters ────────────────────────────────────────────────

  private async pingPlatform(
    integration: Integration,
  ): Promise<{ success: boolean; error?: string }> {
    const cfg = integration.config as Record<string, string>;
    const host = integration.host.replace(/\/$/, '');

    try {
      switch (integration.platform) {
        case 'SPLUNK': {
          const port = cfg['port'] ?? '8089';
          const url = `${host}:${port}/services/server/info?output_mode=json`;
          const res = await fetch(url, {
            headers: { Authorization: `Splunk ${cfg['apiToken'] ?? ''}` },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return { success: false, error: `HTTP ${res.status} from Splunk` };
          return { success: true };
        }

        case 'QRADAR': {
          const res = await fetch(`${host}/api/system/information`, {
            headers: { SEC: cfg['apiToken'] ?? '', 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return { success: false, error: `HTTP ${res.status} from QRadar` };
          return { success: true };
        }

        case 'SENTINEL': {
          const token = await this.getAzureToken(cfg);
          if (!token) return { success: false, error: 'Azure token request failed' };
          const url = `https://management.azure.com/subscriptions/${cfg['subscriptionId']}/resourceGroups/${cfg['resourceGroup']}/providers/Microsoft.OperationalInsights/workspaces/${cfg['workspaceName']}?api-version=2021-06-01`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) return { success: false, error: `HTTP ${res.status} from Sentinel` };
          return { success: true };
        }

        case 'DEFENDER': {
          const token = await this.getDefenderToken(cfg);
          if (!token) return { success: false, error: 'Microsoft token request failed' };
          const res = await fetch('https://api.security.microsoft.com/api/machines?$top=1', {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) return { success: false, error: `HTTP ${res.status} from Defender` };
          return { success: true };
        }

        case 'ELASTIC': {
          const res = await fetch(`${host}/_cluster/health`, {
            headers: {
              Authorization: cfg['apiKey']
                ? `ApiKey ${cfg['apiKey']}`
                : `Basic ${Buffer.from(`${cfg['username'] ?? ''}:${cfg['password'] ?? ''}`).toString('base64')}`,
            },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return { success: false, error: `HTTP ${res.status} from Elastic` };
          return { success: true };
        }

        case 'CHRONICLE': {
          // Chronicle uses Google OAuth2 — basic connectivity test via DNS
          const url = new URL(host || 'https://backstory.googleapis.com');
          const res = await fetch(`${url.origin}/`, { signal: AbortSignal.timeout(8000) });
          if (res.status === 404 || res.ok) return { success: true }; // 404 = reachable but no index
          return { success: false, error: `HTTP ${res.status} from Chronicle` };
        }

        default:
          return { success: true }; // SIGMA/CUSTOM — no remote endpoint
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  private async pushToSiem(
    integration: Integration,
    detection: Detection,
  ): Promise<{ remoteId?: string }> {
    const cfg = integration.config as Record<string, string>;
    const host = integration.host.replace(/\/$/, '');

    switch (integration.platform) {
      case 'SPLUNK': {
        const port = cfg['port'] ?? '8089';
        const body = new URLSearchParams({
          name: `${detection.ruleId} - ${detection.name}`,
          search: detection.query,
          description: detection.description,
        });
        const res = await fetch(`${host}:${port}/services/saved/searches?output_mode=json`, {
          method: 'POST',
          headers: {
            Authorization: `Splunk ${cfg['apiToken'] ?? ''}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Splunk ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = (await res.json()) as { entry?: Array<{ name?: string }> };
        return { remoteId: json.entry?.[0]?.name };
      }

      case 'QRADAR': {
        const res = await fetch(`${host}/api/ariel/saved_searches`, {
          method: 'POST',
          headers: {
            SEC: cfg['apiToken'] ?? '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `${detection.ruleId} - ${detection.name}`,
            aql: detection.query,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`QRadar ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = (await res.json()) as { id?: number };
        return { remoteId: json.id !== undefined ? String(json.id) : undefined };
      }

      case 'SENTINEL': {
        const token = await this.getAzureToken(cfg);
        if (!token) throw new Error('Failed to obtain Azure access token');
        const ruleId = `clarbit-${detection.ruleId.toLowerCase()}`;
        const severityMap: Record<string, string> = {
          CRITICAL: 'High',
          HIGH: 'High',
          MEDIUM: 'Medium',
          LOW: 'Low',
          INFO: 'Informational',
        };
        const url = `https://management.azure.com/subscriptions/${cfg['subscriptionId']}/resourceGroups/${cfg['resourceGroup']}/providers/Microsoft.OperationalInsights/workspaces/${cfg['workspaceName']}/providers/Microsoft.SecurityInsights/alertRules/${ruleId}?api-version=2023-02-01`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'Scheduled',
            properties: {
              displayName: `${detection.ruleId} - ${detection.name}`,
              description: detection.description,
              severity: severityMap[detection.severity] ?? 'Medium',
              query: detection.query,
              queryFrequency: 'PT1H',
              queryPeriod: 'PT1H',
              triggerOperator: 'GreaterThan',
              triggerThreshold: 0,
              enabled: true,
            },
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Sentinel ${res.status}: ${text.slice(0, 200)}`);
        }
        return { remoteId: ruleId };
      }

      case 'DEFENDER': {
        const token = await this.getDefenderToken(cfg);
        if (!token) throw new Error('Failed to obtain Microsoft access token');
        const res = await fetch('https://api.security.microsoft.com/api/rules/detections', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ruleName: `${detection.ruleId} - ${detection.name}`,
            query: detection.query,
            schedule: { period: 'H1' },
            impactedAssets: [{ assetType: 'Devices', entityType: 'Machine' }],
            alertTemplate: {
              title: detection.name,
              description: detection.description,
              severity: detection.severity.charAt(0) + detection.severity.slice(1).toLowerCase(),
              category: detection.mitreTactic ?? 'General',
              recommendedActions: `Review alert for ${detection.ruleId}`,
            },
            actions: { alertsToCreate: [{}] },
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Defender ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = (await res.json()) as { id?: string };
        return { remoteId: json.id };
      }

      case 'ELASTIC': {
        const res = await fetch(`${host}/_security/detection_engine/rules`, {
          method: 'POST',
          headers: {
            Authorization: cfg['apiKey']
              ? `ApiKey ${cfg['apiKey']}`
              : `Basic ${Buffer.from(`${cfg['username'] ?? ''}:${cfg['password'] ?? ''}`).toString('base64')}`,
            'kbn-xsrf': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rule_id: detection.ruleId.toLowerCase(),
            name: `${detection.ruleId} - ${detection.name}`,
            description: detection.description,
            type: 'eql',
            query: detection.query,
            language: 'eql',
            risk_score:
              { CRITICAL: 99, HIGH: 73, MEDIUM: 47, LOW: 21, INFO: 1 }[detection.severity] ?? 47,
            severity: detection.severity.toLowerCase(),
            enabled: true,
            tags: detection.tags,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Elastic ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = (await res.json()) as { id?: string };
        return { remoteId: json.id };
      }

      case 'CHRONICLE': {
        const res = await fetch(`${host}/v1/rules`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg['serviceAccountToken'] ?? ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ruleText: detection.query }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Chronicle ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = (await res.json()) as { ruleId?: string };
        return { remoteId: json.ruleId };
      }

      default:
        return {};
    }
  }

  private async removeFromSiem(integration: Integration, remoteId: string): Promise<void> {
    const cfg = integration.config as Record<string, string>;
    const host = integration.host.replace(/\/$/, '');

    switch (integration.platform) {
      case 'SPLUNK': {
        const port = cfg['port'] ?? '8089';
        await fetch(`${host}:${port}/services/saved/searches/${encodeURIComponent(remoteId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Splunk ${cfg['apiToken'] ?? ''}` },
          signal: AbortSignal.timeout(10000),
        });
        break;
      }
      case 'QRADAR': {
        await fetch(`${host}/api/ariel/saved_searches/${encodeURIComponent(remoteId)}`, {
          method: 'DELETE',
          headers: { SEC: cfg['apiToken'] ?? '' },
          signal: AbortSignal.timeout(10000),
        });
        break;
      }
      case 'SENTINEL': {
        const token = await this.getAzureToken(cfg);
        if (token) {
          const url = `https://management.azure.com/subscriptions/${cfg['subscriptionId']}/resourceGroups/${cfg['resourceGroup']}/providers/Microsoft.OperationalInsights/workspaces/${cfg['workspaceName']}/providers/Microsoft.SecurityInsights/alertRules/${remoteId}?api-version=2023-02-01`;
          await fetch(url, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
          });
        }
        break;
      }
      case 'ELASTIC': {
        await fetch(
          `${host}/_security/detection_engine/rules?rule_id=${encodeURIComponent(remoteId)}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: cfg['apiKey']
                ? `ApiKey ${cfg['apiKey']}`
                : `Basic ${Buffer.from(`${cfg['username'] ?? ''}:${cfg['password'] ?? ''}`).toString('base64')}`,
              'kbn-xsrf': 'true',
            },
            signal: AbortSignal.timeout(10000),
          },
        );
        break;
      }
    }
  }

  // ── Auth helpers ──────────────────────────────────────────────────────────────

  private async getAzureToken(cfg: Record<string, string>): Promise<string | null> {
    try {
      const res = await fetch(
        `https://login.microsoftonline.com/${cfg['tenantAadId']}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: cfg['clientId'] ?? '',
            client_secret: cfg['clientSecret'] ?? '',
            scope: 'https://management.azure.com/.default',
          }).toString(),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { access_token?: string };
      return json.access_token ?? null;
    } catch {
      return null;
    }
  }

  private async getDefenderToken(cfg: Record<string, string>): Promise<string | null> {
    try {
      const res = await fetch(
        `https://login.microsoftonline.com/${cfg['tenantAadId']}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: cfg['clientId'] ?? '',
            client_secret: cfg['clientSecret'] ?? '',
            scope: 'https://api.security.microsoft.com/.default',
          }).toString(),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { access_token?: string };
      return json.access_token ?? null;
    } catch {
      return null;
    }
  }

  // ── Utility ───────────────────────────────────────────────────────────────────

  private async assertOwnership(tenantId: string, id: string) {
    const exists = await this.db.integration.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Integration not found');
  }
}
