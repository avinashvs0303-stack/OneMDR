'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import {
  Plus,
  RefreshCw,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Plug,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ScrollText,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  integrationsApi,
  PLATFORM_INFO,
  STATUS_BADGE,
  type IntegrationRow,
  type CreateIntegrationPayload,
  type IntegrationLog,
  type LogLevel,
} from '@/lib/integrations.api';
import type { DetectionPlatform } from '@/lib/detections.api';

const SUPPORTED_PLATFORMS: DetectionPlatform[] = [
  'SPLUNK',
  'QRADAR',
  'SENTINEL',
  'DEFENDER',
  'CHRONICLE',
  'ELASTIC',
  'CUSTOM',
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationRow | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilterId, setLogFilterId] = useState<string>('');
  const [logFilterLevel, setLogFilterLevel] = useState<LogLevel | ''>('');

  const load = useCallback(async () => {
    try {
      const data = await integrationsApi.list();
      setIntegrations(data);
    } catch (err) {
      console.error('Failed to load integrations', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await integrationsApi.getLogs(logFilterId || undefined);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load integration logs', err);
    } finally {
      setLogsLoading(false);
    }
  }, [logFilterId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await integrationsApi.test(id);
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: result.success ? 'CONNECTED' : 'ERROR',
                errorMessage: result.error ?? null,
                lastTestedAt: new Date().toISOString(),
              }
            : i,
        ),
      );
      void loadLogs();
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this integration? Existing deployment records will be deleted.')) return;
    setDeletingId(id);
    try {
      await integrationsApi.remove(id);
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
      void loadLogs();
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (integration: IntegrationRow) => {
    const updated = await integrationsApi.update(integration.id, {
      isEnabled: !integration.isEnabled,
    });
    setIntegrations((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
  };

  const handleCreated = (integration: IntegrationRow) => {
    setIntegrations((prev) => [...prev, integration]);
    setShowAddModal(false);
  };

  const handleUpdated = (integration: IntegrationRow) => {
    setIntegrations((prev) => prev.map((i) => (i.id === integration.id ? integration : i)));
    setEditingIntegration(null);
  };

  const connected = integrations.filter((i) => i.status === 'CONNECTED').length;
  const errors = integrations.filter((i) => i.status === 'ERROR').length;

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Integrations" />

      <main className="flex-1 overflow-auto">
        {/* Stats bar */}
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 backdrop-blur-md px-6 py-3 gap-4 shrink-0">
          <div className="flex items-center gap-6">
            <Stat
              label="Total"
              value={loading ? '—' : String(integrations.length)}
              color="text-slate-900 dark:text-white"
            />
            <Stat
              label="Connected"
              value={loading ? '—' : String(connected)}
              color="text-emerald-600 dark:text-emerald-400"
            />
            <Stat
              label="Errors"
              value={loading ? '—' : String(errors)}
              color={
                errors > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-zinc-500'
              }
            />
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Add Integration
          </button>
        </div>

        {/* Info banner */}
        <div className="flex items-center gap-2 px-6 py-2 bg-blue-500/10 border-b border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300">
          <Plug className="h-3.5 w-3.5 shrink-0" />
          <span>
            Connect your SIEM platforms to deploy detection rules directly from the Detection
            Library. All credentials are stored encrypted and never transmitted to third parties.
          </span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-zinc-500" />
            </div>
          ) : integrations.length === 0 ? (
            <EmptyState onAdd={() => setShowAddModal(true)} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {integrations.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  isExpanded={expandedId === integration.id}
                  isTesting={testingId === integration.id}
                  isDeleting={deletingId === integration.id}
                  onExpand={() =>
                    setExpandedId(expandedId === integration.id ? null : integration.id)
                  }
                  onTest={() => void handleTest(integration.id)}
                  onDelete={() => void handleDelete(integration.id)}
                  onToggle={() => void handleToggle(integration)}
                  onEdit={() => setEditingIntegration(integration)}
                />
              ))}
            </div>
          )}

          {/* Activity Log */}
          <ActivityLog
            logs={logs}
            loading={logsLoading}
            integrations={integrations}
            filterIntegrationId={logFilterId}
            filterLevel={logFilterLevel}
            onFilterIntegration={setLogFilterId}
            onFilterLevel={setLogFilterLevel}
            onRefresh={() => void loadLogs()}
          />
        </div>
      </main>

      {showAddModal && (
        <IntegrationModal onClose={() => setShowAddModal(false)} onSaved={handleCreated} />
      )}
      {editingIntegration && (
        <IntegrationModal
          existing={editingIntegration}
          onClose={() => setEditingIntegration(null)}
          onSaved={handleUpdated}
        />
      )}
    </div>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  isExpanded,
  isTesting,
  isDeleting,
  onExpand,
  onTest,
  onDelete,
  onToggle,
  onEdit,
}: {
  integration: IntegrationRow;
  isExpanded: boolean;
  isTesting: boolean;
  isDeleting: boolean;
  onExpand: () => void;
  onTest: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const info = PLATFORM_INFO[integration.platform];
  const badge = STATUS_BADGE[integration.status];

  return (
    <div
      className={cn(
        'rounded-xl border bg-white dark:bg-black/30 overflow-hidden transition-all',
        integration.isEnabled
          ? 'border-black/10 dark:border-white/10'
          : 'border-black/5 dark:border-white/5 opacity-60',
      )}
    >
      {/* Card header */}
      <div
        className={cn(
          'px-4 py-3 border-b',
          info.bg.split(' ').slice(0, 2).join(' '),
          'border-transparent',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn('text-xs font-bold truncate', info.color)}>{info.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white truncate">
              {integration.name}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              badge.className,
            )}
          >
            {badge.label}
          </span>
        </div>

        {integration.host && (
          <p className="mt-1 text-[10px] text-slate-400 dark:text-zinc-500 truncate font-mono">
            {integration.host}
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-black/5 dark:border-white/5">
        <div className="text-center">
          <p className="text-base font-bold text-slate-900 dark:text-white">
            {integration.deployedCount}
          </p>
          <p className="text-[9px] text-slate-400 dark:text-zinc-500">Deployed</p>
        </div>
        {integration.lastTestedAt && (
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 ml-2">
            Tested {new Date(integration.lastTestedAt).toLocaleDateString()}
          </p>
        )}
        {integration.errorMessage && (
          <p className="text-[10px] text-red-500 dark:text-red-400 truncate flex-1">
            {integration.errorMessage}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-2">
        <button
          type="button"
          onClick={onTest}
          disabled={isTesting}
          className="flex items-center gap-1 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
        >
          {isTesting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : integration.status === 'CONNECTED' ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Test
        </button>

        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
            integration.isEnabled
              ? 'border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
          )}
        >
          {integration.isEnabled ? (
            <>
              <EyeOff className="h-3 w-3" /> Disable
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" /> Enable
            </>
          )}
        </button>

        <div className="flex-1" />

        {/* Edit */}
        <button
          type="button"
          onClick={onEdit}
          title="Edit integration"
          className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <Pencil className="h-3 w-3" />
        </button>

        {/* Expand */}
        <button
          type="button"
          onClick={onExpand}
          className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded-lg border border-red-500/20 bg-red-500/5 p-1.5 text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {isDeleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1 border-t border-black/5 dark:border-white/5 space-y-1">
          {PLATFORM_INFO[integration.platform].fields.map((field) => (
            <div key={field.key} className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">{field.label}</span>
              <span className="text-[10px] font-medium text-slate-600 dark:text-zinc-300 font-mono">
                {integration.config[field.key]
                  ? field.type === 'password'
                    ? '••••••••'
                    : integration.config[field.key]
                  : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Integration Modal (create + edit) ─────────────────────────────────────────

function IntegrationModal({
  existing,
  onClose,
  onSaved,
}: {
  existing?: IntegrationRow;
  onClose: () => void;
  onSaved: (integration: IntegrationRow) => void;
}) {
  const isEdit = !!existing;

  const [step, setStep] = useState<'pick' | 'configure'>(isEdit ? 'configure' : 'pick');
  const [selectedPlatform, setSelectedPlatform] = useState<DetectionPlatform | null>(
    existing?.platform ?? null,
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [host, setHost] = useState(existing?.host ?? '');
  const [configValues, setConfigValues] = useState<Record<string, string>>(
    (existing?.config as Record<string, string>) ?? {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const handleSelectPlatform = (platform: DetectionPlatform) => {
    setSelectedPlatform(platform);
    const info = PLATFORM_INFO[platform];
    setHost(info.defaultHost);
    setName(info.label);
    setConfigValues({});
    setStep('configure');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlatform) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && existing) {
        const updated = await integrationsApi.update(existing.id, {
          name: name.trim(),
          host: host.trim(),
          config: configValues,
        });
        onSaved({ ...existing, ...updated });
      } else {
        const payload: CreateIntegrationPayload = {
          platform: selectedPlatform,
          name: name.trim(),
          host: host.trim(),
          config: configValues,
        };
        const created = await integrationsApi.create(payload);
        onSaved(created);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${isEdit ? 'update' : 'create'} integration`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {isEdit
              ? `Edit Integration`
              : step === 'pick'
                ? 'Select Platform'
                : 'Configure Integration'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'pick' ? (
          <div className="p-5 grid grid-cols-2 gap-3">
            {SUPPORTED_PLATFORMS.map((platform) => {
              const info = PLATFORM_INFO[platform];
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => handleSelectPlatform(platform)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-all hover:scale-[1.02]',
                    info.bg,
                  )}
                >
                  <p className={cn('text-xs font-bold', info.color)}>{info.label}</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{platform}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
            {selectedPlatform && (
              <div className={cn('rounded-lg border p-3', PLATFORM_INFO[selectedPlatform].bg)}>
                <p className={cn('text-xs font-bold', PLATFORM_INFO[selectedPlatform].color)}>
                  {PLATFORM_INFO[selectedPlatform].label}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Field label="Integration Name" required>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Production Splunk"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </Field>

              {selectedPlatform && PLATFORM_INFO[selectedPlatform].defaultHost && (
                <Field label="Host URL" required>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    required
                    placeholder={PLATFORM_INFO[selectedPlatform].defaultHost}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </Field>
              )}

              {selectedPlatform &&
                PLATFORM_INFO[selectedPlatform].fields.map((field) => (
                  <Field key={field.key} label={field.label} required={field.required}>
                    <div className="relative">
                      <input
                        type={
                          field.type === 'password' && !showPasswords[field.key]
                            ? 'password'
                            : 'text'
                        }
                        value={configValues[field.key] ?? ''}
                        onChange={(e) =>
                          setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        required={field.required}
                        placeholder={field.placeholder}
                        className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 pr-8 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                      {field.type === 'password' && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords((prev) => ({
                              ...prev,
                              [field.key]: !prev[field.key],
                            }))
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
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => setStep('pick')}
                  className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Back
                </button>
              )}
              <div className="flex-1" />
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Add Integration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20">
        <Plug className="h-7 w-7 text-blue-500 dark:text-blue-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">No integrations yet</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
          Connect a SIEM platform to deploy detection rules automatically.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add Your First Integration
      </button>
    </div>
  );
}

// ── Activity Log ──────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<LogLevel, { badge: string; row: string }> = {
  INFO: {
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    row: '',
  },
  WARN: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    row: 'bg-amber-500/5',
  },
  ERROR: {
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    row: 'bg-red-500/5',
  },
};

const EVENT_LABELS: Record<string, string> = {
  TEST_CONNECTION: 'Test',
  DEPLOY: 'Deploy',
  UNDEPLOY: 'Undeploy',
  CREATE: 'Create',
  UPDATE: 'Update',
  DELETE: 'Delete',
};

function ActivityLog({
  logs,
  loading,
  integrations,
  filterIntegrationId,
  filterLevel,
  onFilterIntegration,
  onFilterLevel,
  onRefresh,
}: {
  logs: IntegrationLog[];
  loading: boolean;
  integrations: IntegrationRow[];
  filterIntegrationId: string;
  filterLevel: LogLevel | '';
  onFilterIntegration: (id: string) => void;
  onFilterLevel: (level: LogLevel | '') => void;
  onRefresh: () => void;
}) {
  const visible = logs.filter((l) => !filterLevel || l.level === filterLevel);

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 backdrop-blur-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <h2 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">
            Activity Log
          </h2>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
            ({visible.length} entries)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Integration filter */}
          <select
            value={filterIntegrationId}
            onChange={(e) => onFilterIntegration(e.target.value)}
            className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1 text-[11px] text-slate-700 dark:text-zinc-300 focus:outline-none"
          >
            <option value="">All Integrations</option>
            {integrations.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          {/* Level filter */}
          <select
            value={filterLevel}
            onChange={(e) => onFilterLevel(e.target.value as LogLevel | '')}
            className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1 text-[11px] text-slate-700 dark:text-zinc-300 focus:outline-none"
          >
            <option value="">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-zinc-500" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <ScrollText className="h-7 w-7 text-slate-300 dark:text-zinc-600" />
          <p className="text-xs text-slate-400 dark:text-zinc-500">No activity logged yet</p>
          <p className="text-[11px] text-slate-300 dark:text-zinc-600">
            Events appear here after testing connections or deploying detections.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-black/5 dark:divide-white/5 max-h-96 overflow-y-auto">
          {visible.map((log) => {
            const ls = LEVEL_STYLE[log.level];
            return (
              <div key={log.id} className={cn('flex items-start gap-3 px-4 py-2.5', ls.row)}>
                {/* Level badge */}
                <span
                  className={cn(
                    'mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                    ls.badge,
                  )}
                >
                  {log.level}
                </span>

                {/* Event chip */}
                <span className="mt-0.5 shrink-0 rounded bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
                  {EVENT_LABELS[log.event] ?? log.event}
                </span>

                {/* Message + integration */}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-800 dark:text-zinc-200 leading-snug">
                    {log.message}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                    {log.integration.name}
                    {log.durationMs ? (
                      <span className="ml-2 text-slate-300 dark:text-zinc-600">
                        {log.durationMs}ms
                      </span>
                    ) : null}
                  </p>
                </div>

                {/* Timestamp */}
                <span className="shrink-0 text-[10px] text-slate-300 dark:text-zinc-600 tabular-nums whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className={cn('text-lg font-bold', color)}>{value}</p>
      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{label}</p>
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
