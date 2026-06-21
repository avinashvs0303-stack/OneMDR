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
      const integration = await this.db.integration.create({
        data: {
          tenantId,
          platform: dto.platform as Integration['platform'],
          name: dto.name,
          host: dto.host,
          config: (dto.config ?? {}) as object,
          isEnabled: dto.isEnabled ?? true,
        },
      });
      this.writeLog(
        tenantId,
        integration.id,
        'CREATE',
        'INFO',
        `Integration created: ${integration.name} (${integration.platform})`,
      );
      return integration;
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
    const updated = await this.db.integration.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.host !== undefined ? { host: dto.host } : {}),
        ...(dto.config !== undefined ? { config: dto.config as object } : {}),
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
      },
    });
    this.writeLog(tenantId, id, 'UPDATE', 'INFO', `Integration updated: ${updated.name}`);
    return updated;
  }

  async remove(actor: JwtPayload, id: string) {
    const tenantId = actor.tenantId!;
    const integration = await this.db.integration.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, platform: true },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    this.writeLog(
      tenantId,
      id,
      'DELETE',
      'INFO',
      `Integration removed: ${integration.name} (${integration.platform})`,
    );
    await this.db.integration.delete({ where: { id } });
  }

  // ── Test connection ───────────────────────────────────────────────────────────

  async testConnection(actor: JwtPayload, id: string) {
    const tenantId = actor.tenantId!;
    const integration = await this.db.integration.findFirst({ where: { id, tenantId } });
    if (!integration) throw new NotFoundException('Integration not found');

    const t0 = Date.now();
    const result = await this.pingPlatform(integration);
    const durationMs = Date.now() - t0;

    await this.db.integration.update({
      where: { id },
      data: {
        status: result.success ? 'CONNECTED' : 'ERROR',
        lastTestedAt: new Date(),
        errorMessage: result.error ?? null,
      },
    });

    if (result.success) {
      this.writeLog(
        tenantId,
        id,
        'TEST_CONNECTION',
        'INFO',
        `Connection test passed (${durationMs}ms)`,
        { durationMs },
        durationMs,
      );
    } else {
      this.writeLog(
        tenantId,
        id,
        'TEST_CONNECTION',
        'ERROR',
        `Connection test failed: ${result.error ?? 'unknown error'}`,
        { error: result.error, durationMs },
        durationMs,
      );
    }

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

    const t0 = Date.now();
    try {
      const deployResult = await this.pushToSiem(integration, detection);
      remoteId = deployResult.remoteId ?? null;
      this.writeLog(
        tenantId,
        integrationId,
        'DEPLOY',
        'INFO',
        `Detection deployed: ${detection.ruleId} — ${detection.name}`,
        { detectionId, remoteId, durationMs: Date.now() - t0 },
      );
    } catch (err: unknown) {
      status = 'error';
      errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Deploy to ${integration.platform} failed: ${errorMessage}`);
      this.writeLog(tenantId, integrationId, 'DEPLOY', 'ERROR', `Deploy failed: ${errorMessage}`, {
        detectionId,
        error: errorMessage,
        durationMs: Date.now() - t0,
      });
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
        this.writeLog(
          tenantId,
          integrationId,
          'UNDEPLOY',
          'INFO',
          `Detection undeployed (remoteId: ${dep.remoteId})`,
          { detectionId },
        );
      } catch (err: unknown) {
        const msg = String(err);
        this.logger.warn(`Undeploy from ${integration.platform} failed: ${msg}`);
        this.writeLog(
          tenantId,
          integrationId,
          'UNDEPLOY',
          'WARN',
          `Undeploy error (ignored): ${msg}`,
          { detectionId, error: msg },
        );
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
          const base = this.splunkBase(host, cfg);
          const parsed = new URL(base);
          const isPort443 = !parsed.port || parsed.port === '443';
          // Tokens created in Splunk Settings → Tokens use Bearer scheme.
          // Session keys (obtained via /services/auth/login) use Splunk scheme.
          // Use authentication/current-context so the test verifies the token works.
          const authPath = isPort443
            ? `${base}/en-US/splunkd/__raw/services/authentication/current-context?output_mode=json`
            : `${base}/services/authentication/current-context?output_mode=json`;
          const res = await fetch(authPath, {
            headers: { Authorization: `Bearer ${cfg['apiToken'] ?? ''}` },
            signal: AbortSignal.timeout(12000),
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
        const splunkBase = this.splunkBase(host, cfg);
        const splunkParsed = new URL(splunkBase);
        const splunkOn443 = !splunkParsed.port || splunkParsed.port === '443';
        const savedSearchesPath = splunkOn443
          ? `${splunkBase}/en-US/splunkd/__raw/services/saved/searches?output_mode=json`
          : `${splunkBase}/services/saved/searches?output_mode=json`;

        // Severity → Splunk alert.severity (1=INFO 2=LOW 3=MEDIUM 4=HIGH 5=CRITICAL)
        const splunkSeverity: Record<string, string> = {
          CRITICAL: '5',
          HIGH: '4',
          MEDIUM: '3',
          LOW: '2',
          INFO: '1',
        };

        const body = new URLSearchParams({
          name: `${detection.ruleId} - ${detection.name}`,
          search: detection.query,
          description: detection.description,
          // Deploy as a scheduled alert — runs every 5 min, fires when results > 0
          is_scheduled: '1',
          cron_schedule: '*/5 * * * *',
          'dispatch.earliest_time': '-5m',
          'dispatch.latest_time': 'now',
          'alert.track': '1',
          alert_type: 'number of events',
          alert_comparator: 'greater than',
          alert_threshold: '0',
          'alert.severity': splunkSeverity[detection.severity] ?? '3',
          'alert.suppress': '1',
          'alert.suppress.period': '5m',
        });

        // Tokens created in Settings → Tokens use Bearer scheme
        const res = await fetch(savedSearchesPath, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg['apiToken'] ?? ''}`,
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
        const splunkDelBase = this.splunkBase(host, cfg);
        const splunkDelParsed = new URL(splunkDelBase);
        const splunkDelOn443 = !splunkDelParsed.port || splunkDelParsed.port === '443';
        const deletePath = splunkDelOn443
          ? `${splunkDelBase}/en-US/splunkd/__raw/services/saved/searches/${encodeURIComponent(remoteId)}`
          : `${splunkDelBase}/services/saved/searches/${encodeURIComponent(remoteId)}`;
        await fetch(deletePath, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${cfg['apiToken'] ?? ''}` },
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

  // ── Logs ─────────────────────────────────────────────────────────────────────

  async getLogs(actor: JwtPayload, integrationId?: string, limit = 200) {
    const tenantId = actor.tenantId!;
    return this.db.integrationLog.findMany({
      where: {
        tenantId,
        ...(integrationId ? { integrationId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        integration: { select: { id: true, name: true, platform: true } },
      },
    });
  }

  private writeLog(
    tenantId: string,
    integrationId: string,
    event: string,
    level: 'INFO' | 'WARN' | 'ERROR',
    message: string,
    meta?: Record<string, unknown>,
    durationMs?: number,
  ): void {
    void this.db.integrationLog
      .create({
        data: { tenantId, integrationId, event, level, message, meta: meta as object, durationMs },
      })
      .catch((err: unknown) => {
        this.logger.warn(`Failed to write integration log: ${String(err)}`);
      });
  }

  // ── Utility ───────────────────────────────────────────────────────────────────

  /**
   * Returns the Splunk base URL.
   * Priority: port already in host > cfg.port > omit (HTTPS defaults to 443).
   * Clearing the Management Port field lets Splunk Cloud trial work on 443.
   */
  private splunkBase(host: string, cfg: Record<string, string>): string {
    try {
      const parsed = new URL(host);
      if (parsed.port) return host;
      if (cfg['port']) return `${host}:${cfg['port']}`;
      return host;
    } catch {
      return cfg['port'] ? `${host}:${cfg['port']}` : host;
    }
  }

  private async assertOwnership(tenantId: string, id: string) {
    const exists = await this.db.integration.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Integration not found');
  }
}
