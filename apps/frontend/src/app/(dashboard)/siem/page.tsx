'use client';

import { Header } from '@/components/layout/header';
import { Database, AlertTriangle, RefreshCw, Plus, ExternalLink, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DETECTIONS } from '@/data/detections';

const SIEM_INTEGRATIONS = [
  {
    id: 'splunk-001', name: 'Splunk Enterprise Security', platform: 'Splunk' as const,
    version: '8.2.6', host: 'splunk.demo-corp.internal:8089', status: 'connected' as const,
    lastSync: '2 minutes ago', latency: 48,
    detectionsDeployed: DETECTIONS.filter((d) => d.siem === 'Splunk' && d.status === 'Active').length,
    alertsToday: 28,
    indexesMonitored: ['windows', 'linux', 'aws', 'network'],
    accentColor: 'text-orange-600 dark:text-orange-400', borderColor: 'border-orange-500/20', bgColor: 'bg-orange-50 dark:bg-orange-500/5',
    badgeClass: 'text-orange-600 dark:text-orange-400 bg-orange-500/15 border border-orange-500/20',
  },
  {
    id: 'sentinel-001', name: 'Microsoft Sentinel', platform: 'Microsoft Sentinel' as const,
    version: 'Cloud', host: 'demo-corp.sentinel.azure.com', status: 'connected' as const,
    lastSync: '8 minutes ago', latency: 61,
    detectionsDeployed: DETECTIONS.filter((d) => d.siem === 'Microsoft Sentinel' && d.status === 'Active').length,
    alertsToday: 14,
    indexesMonitored: ['Azure AD', 'Office 365', 'Defender', 'AWS'],
    accentColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-blue-500/20', bgColor: 'bg-blue-50 dark:bg-blue-500/5',
    badgeClass: 'text-blue-600 dark:text-blue-400 bg-blue-500/15 border border-blue-500/20',
  },
  {
    id: 'chronicle-001', name: 'Google Chronicle', platform: 'Chronicle' as const,
    version: 'Cloud', host: 'demo-corp.chronicle.security', status: 'warning' as const,
    lastSync: '41 minutes ago', latency: 0,
    detectionsDeployed: DETECTIONS.filter((d) => d.siem === 'Chronicle' && d.status === 'Active').length,
    alertsToday: 6,
    indexesMonitored: ['UDM Events', 'Network', 'EDR'],
    accentColor: 'text-amber-600 dark:text-amber-400', borderColor: 'border-amber-500/25', bgColor: 'bg-amber-50 dark:bg-amber-500/5',
    badgeClass: 'text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/20',
  },
  {
    id: 'elastic-001', name: 'Elastic Security', platform: 'Elastic' as const,
    version: '8.13', host: 'demo-corp.es.io:9243', status: 'connected' as const,
    lastSync: '5 minutes ago', latency: 33,
    detectionsDeployed: DETECTIONS.filter((d) => d.siem === 'Elastic' && d.status === 'Active').length,
    alertsToday: 9,
    indexesMonitored: ['logs-endpoint.*', 'logs-network.*', 'logs-cloud.*'],
    accentColor: 'text-cyan-600 dark:text-cyan-400', borderColor: 'border-cyan-500/20', bgColor: 'bg-cyan-50 dark:bg-cyan-500/5',
    badgeClass: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/15 border border-cyan-500/20',
  },
];

const PENDING = DETECTIONS.filter((d) => d.status === 'Testing').slice(0, 3);

export default function SiemPage() {
  const totalAlerts = SIEM_INTEGRATIONS.reduce((s, i) => s + i.alertsToday, 0);
  const totalDeployed = SIEM_INTEGRATIONS.reduce((s, i) => s + i.detectionsDeployed, 0);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="SIEM Ingest Monitors" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Connected SIEMs', value: `${SIEM_INTEGRATIONS.filter(s => s.status === 'connected').length}/4`, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Detections Deployed', value: String(totalDeployed), color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Alerts Today', value: String(totalAlerts), color: 'text-slate-900 dark:text-white' },
            { label: 'Pending Deployment', value: String(PENDING.length), color: 'text-amber-600 dark:text-amber-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 shadow-sm dark:shadow-lg">
              <p className="text-xs text-slate-400 dark:text-zinc-500">{s.label}</p>
              <p className={cn('mt-1 text-2xl font-bold', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {SIEM_INTEGRATIONS.map((integration) => (
            <div key={integration.id} className={cn('rounded-xl border backdrop-blur-md p-5 shadow-sm space-y-4', integration.borderColor, integration.bgColor)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
                    <Database className={cn('h-4 w-4', integration.accentColor)} />
                  </div>
                  <div>
                    <p className={cn('font-semibold text-sm', integration.accentColor)}>{integration.name}</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500">{integration.host}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    {integration.status === 'connected' ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </>
                    ) : (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </>
                    )}
                  </span>
                  <span className={cn('text-[11px] font-semibold', integration.status === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                    {integration.status === 'connected' ? 'Connected' : 'Degraded'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Active rules', value: integration.detectionsDeployed },
                  { label: 'Alerts today', value: integration.alertsToday },
                  { label: 'Latency', value: integration.latency > 0 ? `${integration.latency}ms` : 'Offline' },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 p-2.5">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{m.value}</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">{m.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500 mb-1.5">Monitored Sources</p>
                <div className="flex flex-wrap gap-1">
                  {integration.indexesMonitored.map((idx) => (
                    <span key={idx} className={cn('rounded px-2 py-0.5 text-[10px] font-medium', integration.badgeClass)}>
                      {idx}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500">
                  <Clock className="h-3 w-3" /> {integration.lastSync}
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" className="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors">
                    <RefreshCw className="h-3 w-3" /> Sync
                  </button>
                  <button type="button" className="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors">
                    <ExternalLink className="h-3 w-3" /> Open
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-5 flex flex-col items-center justify-center gap-3 text-center min-h-[200px]">
            <Database className="h-8 w-8 text-slate-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Connect another SIEM</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs">Supports QRadar, Sumo Logic, Datadog SIEM, Devo, Securonix, and more.</p>
            <button type="button" className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add integration
            </button>
          </div>
        </div>

        {PENDING.length > 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-50 dark:bg-amber-500/5 backdrop-blur-md p-5 shadow-sm space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> Detections Ready to Deploy
            </h3>
            <div className="space-y-2">
              {PENDING.map((det) => (
                <div key={det.id} className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{det.title}</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500">{det.techniqueId} · {det.siem} · {det.queryLanguage}</p>
                  </div>
                  <button type="button" className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
                    Deploy to {det.siem}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
