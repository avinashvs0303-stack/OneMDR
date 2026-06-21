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

        let splunkPostHeaders: Record<string, string>;
        if (splunkOn443) {
          // Splunk Cloud (port 443): the __raw proxy requires browser-style web session
          // cookies + CSRF token — Bearer and Basic auth are rejected for write operations.
          const webSession = await this.getSplunkWebSession(splunkBase, cfg);
          if (!webSession) {
            throw new Error(
              'Splunk Cloud: add Username and Password to the integration config to deploy',
            );
          }
          splunkPostHeaders = {
            Cookie: webSession.cookies,
            'X-Splunk-Form-Key': webSession.csrfToken,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
          };
        } else {
          // Splunk On-Prem (port 8089): direct management REST API accepts Bearer token.
          if (!cfg['apiToken']) {
            throw new Error(
              'Splunk On-Prem: add an API Token to the integration config to deploy via port 8089',
            );
          }
          splunkPostHeaders = {
            Authorization: `Bearer ${cfg['apiToken']}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          };
        }

        const res = await fetch(savedSearchesPath, {
          method: 'POST',
          headers: splunkPostHeaders,
          body: body.toString(),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Splunk ${res.status}: ${text.slice(0, 200)}`);
        }
        const ct = res.headers.get('content-type') ?? '';
        if (!ct.includes('json')) {
          const preview = (await res.text()).slice(0, 120);
          throw new Error(`Splunk returned non-JSON — auth may still be blocked: ${preview}`);
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
        const splunkDelHeaders: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
        if (splunkDelOn443) {
          const delWebSession = await this.getSplunkWebSession(splunkDelBase, cfg);
          if (delWebSession) {
            splunkDelHeaders['Cookie'] = delWebSession.cookies;
            splunkDelHeaders['X-Splunk-Form-Key'] = delWebSession.csrfToken;
          }
        } else if (cfg['apiToken']) {
          splunkDelHeaders['Authorization'] = `Bearer ${cfg['apiToken']}`;
        }
        await fetch(deletePath, {
          method: 'DELETE',
          headers: splunkDelHeaders,
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
   * Simulates browser login to get web session cookies + authenticated cval.
   *
   * The pre-login cval is invalidated after login (Splunk rotates it per session).
   * Step 3 fetches /en-US/ with the session cookies to get the post-login cval
   * that the __raw proxy will accept in X-Splunk-Form-Key.
   */
  private async getSplunkWebSession(
    base: string,
    cfg: Record<string, string>,
  ): Promise<{ cookies: string; csrfToken: string } | null> {
    if (!cfg['username'] || !cfg['password']) return null;

    const getSetCookies = (res: Response): string[] => {
      const h = res.headers as unknown as { getSetCookie?: () => string[] };
      return (h.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? '']).filter(Boolean);
    };

    const parseCookies = (raw: string[]): string[] =>
      raw.map((c) => c.split(';')[0]!.trim()).filter(Boolean);

    const mergeCookies = (...batches: string[][]): string => {
      const m = new Map<string, string>();
      batches.flat().forEach((c) => {
        const key = c.split('=')[0]!.trim();
        m.set(key, c);
      });
      return Array.from(m.values()).join('; ');
    };

    // Splunk Cloud uses splunkweb_csrf_token_{port} for CSRF, not cval.
    // The value of this cookie must match X-Splunk-Form-Key exactly.
    const extractCval = (cookies: string[]): string =>
      (
        cookies.find((c) => /^splunkweb_csrf_token_/.test(c)) ??
        cookies.find((c) => c.startsWith('cval='))
      )
        ?.split('=')
        .slice(1)
        .join('=') ?? '';

    try {
      // Step 1: GET login page → initial cval cookie (pre-login, for form submission)
      const pageRes = await fetch(`${base}/en-US/account/login`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,*/*' },
        signal: AbortSignal.timeout(10000),
      });
      const pageCookies = parseCookies(getSetCookies(pageRes));
      const preCval = extractCval(pageCookies);

      // Step 2: POST credentials; redirect:'manual' lets Node.js 22 expose 302 headers
      const loginRes = await fetch(`${base}/en-US/account/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: pageCookies.join('; '),
          'User-Agent': 'Mozilla/5.0',
          Referer: `${base}/en-US/account/login`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: new URLSearchParams({
          username: cfg['username'],
          password: cfg['password'],
          cval: preCval,
          return_to: '/en-US/',
          set_has_js: '1',
        }).toString(),
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      });
      const loginCookies302 = parseCookies(getSetCookies(loginRes));
      const sessionStr = mergeCookies(pageCookies, loginCookies302);

      this.logger.log(
        `Splunk login 302 cookies: ${loginCookies302.map((c) => c.split('=')[0]).join(', ')}`,
      );

      // Step 3: GET /en-US/ with session cookies → post-login cval for the authenticated session
      const dashRes = await fetch(`${base}/en-US/`, {
        headers: { Cookie: sessionStr, 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      const dashCookies = parseCookies(getSetCookies(dashRes));

      const authCval = extractCval(dashCookies) || extractCval(loginCookies302) || preCval;
      const finalCookies = mergeCookies(pageCookies, loginCookies302, dashCookies);

      this.logger.log(
        `Splunk web session: authCval=${authCval}, keys=${finalCookies
          .split('; ')
          .map((c) => c.split('=')[0])
          .join(',')}`,
      );

      return { cookies: finalCookies, csrfToken: authCval };
    } catch (err: unknown) {
      this.logger.warn(`Splunk web session error: ${String(err)}`);
      return null;
    }
  }

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

  async fetchSplunkHistory(
    actor: JwtPayload,
    integrationId: string,
    detectionId: string,
  ): Promise<{ runs: SplunkJobRun[]; totalRuns: number; triggeredRuns: number }> {
    const tenantId = actor.tenantId!;
    const integration = await this.db.integration.findFirst({
      where: { id: integrationId, tenantId },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    if (integration.platform !== 'SPLUNK')
      throw new BadRequestException('Only Splunk integrations support history sync');

    const dep = await this.db.siemDeployment.findUnique({
      where: { integrationId_detectionId: { integrationId, detectionId } },
    });
    if (!dep?.remoteId)
      throw new NotFoundException('No deployed saved search found for this detection');

    const cfg = integration.config as Record<string, string>;
    const host = integration.host.replace(/\/$/, '');
    const base = this.splunkBase(host, cfg);
    const parsed = new URL(base);
    const isCloud = !parsed.port || parsed.port === '443';

    const encodedName = encodeURIComponent(dep.remoteId);
    const historyPath = isCloud
      ? `${base}/en-US/splunkd/__raw/services/saved/searches/${encodedName}/history?output_mode=json&count=50`
      : `${base}/services/saved/searches/${encodedName}/history?output_mode=json&count=50`;

    // Splunk Cloud __raw proxy requires web session cookies for GET too, not just writes
    const histHeaders: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
    if (isCloud) {
      const webSession = await this.getSplunkWebSession(base, cfg);
      if (webSession) {
        histHeaders['Cookie'] = webSession.cookies;
        histHeaders['X-Splunk-Form-Key'] = webSession.csrfToken;
      } else {
        histHeaders['Authorization'] = `Bearer ${cfg['apiToken'] ?? ''}`;
      }
    } else {
      histHeaders['Authorization'] = `Bearer ${cfg['apiToken'] ?? ''}`;
    }

    const res = await fetch(historyPath, {
      headers: histHeaders,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Splunk history ${res.status}: ${text.slice(0, 200)}`);
    }

    // `published` is a top-level entry field; content from the history endpoint is stripped
    // in Splunk Cloud's __raw proxy (only isDone/ttl/isScheduled, no eventCount/resultCount).
    // We must fetch each job individually to get the real metrics.
    const json = (await res.json()) as {
      entry?: Array<{ name: string; published?: string; content: Record<string, unknown> }>;
    };
    const entries = json.entry ?? [];

    // Individual job path for the full metrics (eventCount, resultCount, runDuration, etc.)
    const jobBasePath = isCloud
      ? `${base}/en-US/splunkd/__raw/services/search/jobs`
      : `${base}/services/search/jobs`;

    const runs: SplunkJobRun[] = await Promise.all(
      entries.map(async (e): Promise<SplunkJobRun> => {
        const sid = e.name;
        const fallback: SplunkJobRun = {
          sid,
          published: e.published ?? '',
          eventCount: 0,
          resultCount: 0,
          runDuration: 0,
          isDone: true,
          dispatchState: 'DONE',
        };
        try {
          const jobPath = `${jobBasePath}/${encodeURIComponent(sid)}?output_mode=json`;
          const jobRes = await fetch(jobPath, {
            headers: histHeaders,
            signal: AbortSignal.timeout(8000),
          });
          if (!jobRes.ok) return fallback;
          const jobJson = (await jobRes.json()) as {
            entry?: Array<{ content: Record<string, unknown> }>;
          };
          const c = jobJson.entry?.[0]?.content ?? {};
          return {
            sid,
            published: e.published ?? '',
            eventCount: Number(c['eventCount'] ?? 0),
            resultCount: Number(c['resultCount'] ?? 0),
            runDuration: Number(c['runDuration'] ?? 0),
            isDone: Boolean(c['isDone'] ?? true),
            dispatchState: String(c['dispatchState'] ?? 'DONE'),
          };
        } catch {
          return fallback;
        }
      }),
    );

    // Alert triggered = resultCount > 0 (search returned rows → alert condition met)
    const triggeredRuns = runs.filter((r) => r.resultCount > 0).length;

    // Sync trigger counts into detection_stats (grouped by calendar day)
    const dayMap = new Map<string, number>();
    for (const run of runs) {
      if (!run.published) continue;
      const day = run.published.split('T')[0];
      if (day && !Number.isNaN(new Date(day).getTime())) {
        dayMap.set(day, (dayMap.get(day) ?? 0) + (run.resultCount > 0 ? 1 : 0));
      }
    }
    await Promise.allSettled(
      [...dayMap.entries()].map(([day, count]) =>
        this.db.detectionStat.upsert({
          where: { tenantId_detectionId_date: { tenantId, detectionId, date: new Date(day) } },
          create: { tenantId, detectionId, date: new Date(day), triggerCount: count },
          update: { triggerCount: count },
        }),
      ),
    );

    return { runs, totalRuns: runs.length, triggeredRuns };
  }

  private async assertOwnership(tenantId: string, id: string) {
    const exists = await this.db.integration.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Integration not found');
  }
}

interface SplunkJobRun {
  sid: string;
  published: string;
  eventCount: number;
  resultCount: number;
  runDuration: number;
  isDone: boolean;
  dispatchState: string;
}
