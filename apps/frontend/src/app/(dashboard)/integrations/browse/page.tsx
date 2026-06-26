'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CheckCircle2, Plus, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  integrationsApi,
  PLATFORM_INFO,
  type IntegrationRow,
  type CreateIntegrationPayload,
} from '@/lib/integrations.api';
import type { DetectionPlatform } from '@/lib/detections.api';
import { Eye, EyeOff, X, AlertCircle, Loader2 } from 'lucide-react';

// ── Catalog definition ────────────────────────────────────────────────────────

type Category = 'SIEM' | 'EDR' | 'Format' | 'Custom';

interface AppEntry {
  platform: DetectionPlatform;
  category: Category;
  description: string;
  vendor: string;
  docsUrl?: string;
}

const CATALOG: AppEntry[] = [
  {
    platform: 'SPLUNK',
    category: 'SIEM',
    vendor: 'Splunk Inc.',
    description:
      'Deploy detection rules as saved searches and correlation rules. Supports Splunk Cloud and On-Prem Enterprise.',
    docsUrl: 'https://docs.splunk.com',
  },
  {
    platform: 'QRADAR',
    category: 'SIEM',
    vendor: 'IBM',
    description:
      'IBM QRadar SIEM with rule deployment via SEC token. Enterprise-grade log management and threat detection.',
    docsUrl: 'https://www.ibm.com/qradar',
  },
  {
    platform: 'SENTINEL',
    category: 'SIEM',
    vendor: 'Microsoft',
    description:
      'Cloud-native SIEM on Azure. Deploy analytic rules directly to Microsoft Sentinel workspaces via the Management API.',
    docsUrl: 'https://learn.microsoft.com/azure/sentinel',
  },
  {
    platform: 'DEFENDER',
    category: 'EDR',
    vendor: 'Microsoft',
    description:
      'Microsoft 365 Defender endpoint detection. Push custom detection rules and hunt queries via the Security API.',
    docsUrl: 'https://learn.microsoft.com/microsoft-365/security',
  },
  {
    platform: 'CHRONICLE',
    category: 'SIEM',
    vendor: 'Google Cloud',
    description:
      'Google Chronicle SIEM backed by Google-scale infrastructure. Deploy YARA-L rules via service account authentication.',
    docsUrl: 'https://cloud.google.com/chronicle',
  },
  {
    platform: 'ELASTIC',
    category: 'SIEM',
    vendor: 'Elastic',
    description:
      'Elastic Security (formerly SIEM). Deploy detection rules to Kibana via API key or username/password.',
    docsUrl: 'https://www.elastic.co/security',
  },
  {
    platform: 'SIGMA',
    category: 'Format',
    vendor: 'SigmaHQ',
    description:
      'Generic SIGMA rule format. Convert and export detections in the universal open-source rule format for any SIEM.',
    docsUrl: 'https://sigmahq.io',
  },
  {
    platform: 'CUSTOM',
    category: 'Custom',
    vendor: 'Custom',
    description:
      'Connect any platform with a REST API. Provide a base URL and optional API token to deploy rules to your own system.',
  },
];

const CATEGORY_STYLE: Record<Category, string> = {
  SIEM: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
  EDR: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20',
  Format:
    'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20',
  Custom:
    'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20',
};

const ALL_CATEGORIES: Array<Category | 'All'> = ['All', 'SIEM', 'EDR', 'Format', 'Custom'];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrowseAppsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'All'>('All');
  const [connectingPlatform, setConnectingPlatform] = useState<DetectionPlatform | null>(null);

  useEffect(() => {
    integrationsApi.list().then(setIntegrations).catch(console.error);
  }, []);

  const activeByPlatform = integrations.reduce<
    Partial<Record<DetectionPlatform, IntegrationRow[]>>
  >((acc, i) => {
    acc[i.platform] = [...(acc[i.platform] ?? []), i];
    return acc;
  }, {});

  const filtered = CATALOG.filter((app) => {
    if (category !== 'All' && app.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        app.platform.toLowerCase().includes(q) ||
        PLATFORM_INFO[app.platform].label.toLowerCase().includes(q) ||
        app.vendor.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const connectedCount = integrations.filter((i) => i.status === 'CONNECTED').length;

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Browse Apps</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
              Connect your security tools to deploy detections, sync alerts, and automate workflows.
            </p>
          </div>
          {connectedCount > 0 && (
            <button
              onClick={() => router.push('/integrations/active')}
              className="flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 hover:underline"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {connectedCount} active connection{connectedCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Search + category filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search integrations…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          <div className="flex gap-1.5">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                  category === cat
                    ? 'bg-teal-50 border-teal-300 text-teal-700 dark:bg-teal-500/10 dark:border-teal-500/30 dark:text-teal-300'
                    : 'bg-white dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* App grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-zinc-600">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No integrations match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((app) => {
              const info = PLATFORM_INFO[app.platform];
              const active = activeByPlatform[app.platform] ?? [];
              const hasActive = active.length > 0;
              const allConnected = active.every((i) => i.status === 'CONNECTED');

              return (
                <div
                  key={app.platform}
                  className="group rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm hover:border-black/20 dark:hover:border-white/20 transition-colors"
                >
                  {/* Card header band */}
                  <div className={cn('px-4 py-3 border-b', info.bg)}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={cn('text-xs font-bold', info.color)}>{info.label}</p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                          {app.vendor}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded border text-[10px] font-medium',
                            CATEGORY_STYLE[app.category],
                          )}
                        >
                          {app.category}
                        </span>
                        {hasActive && (
                          <span
                            className={cn(
                              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold',
                              allConnected
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400',
                            )}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {active.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="px-4 py-3 flex-1">
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      {app.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="px-4 py-3 border-t border-black/5 dark:border-white/5 flex items-center gap-2">
                    {hasActive ? (
                      <>
                        <button
                          onClick={() => router.push('/integrations/active')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Manage ({active.length})
                        </button>
                        <button
                          onClick={() => setConnectingPlatform(app.platform)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 border border-black/10 dark:border-white/10 rounded-lg hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add another
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConnectingPlatform(app.platform)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Connect
                      </button>
                    )}
                    {app.docsUrl && (
                      <a
                        href={app.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-slate-300 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-400 transition-colors"
                        title="Documentation"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect modal */}
      {connectingPlatform && (
        <ConnectModal
          platform={connectingPlatform}
          onClose={() => setConnectingPlatform(null)}
          onSaved={(integration) => {
            setIntegrations((p) => [...p, integration]);
            setConnectingPlatform(null);
            router.push('/integrations/active');
          }}
        />
      )}
    </div>
  );
}

// ── Connect Modal ─────────────────────────────────────────────────────────────

function ConnectModal({
  platform,
  onClose,
  onSaved,
}: {
  platform: DetectionPlatform;
  onClose: () => void;
  onSaved: (i: IntegrationRow) => void;
}) {
  const info = PLATFORM_INFO[platform];
  const [name, setName] = useState(info.label);
  const [host, setHost] = useState(info.defaultHost);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateIntegrationPayload = {
        platform,
        name: name.trim(),
        host: host.trim(),
        config: configValues,
      };
      const created = await integrationsApi.create(payload);
      onSaved(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Connect {info.label}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          <div className={cn('rounded-lg border p-3', info.bg)}>
            <p className={cn('text-xs', info.color)}>
              {info.label} · {PLATFORM_INFO[platform].fields.length} credential field
              {PLATFORM_INFO[platform].fields.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-3">
            <Field label="Integration Name" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Production Splunk"
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </Field>

            {info.defaultHost && (
              <Field label="Host URL" required>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required
                  placeholder={info.defaultHost}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </Field>
            )}

            {info.fields.map((field) => (
              <Field key={field.key} label={field.label} required={field.required}>
                <div className="relative">
                  <input
                    type={
                      field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'
                    }
                    value={configValues[field.key] ?? ''}
                    onChange={(e) =>
                      setConfigValues((p) => ({ ...p, [field.key]: e.target.value }))
                    }
                    required={field.required}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 pr-8 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords((p) => ({ ...p, [field.key]: !p[field.key] }))
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPasswords[field.key] ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </Field>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <div className="flex-1" />
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
