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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  integrationsApi,
  PLATFORM_INFO,
  STATUS_BADGE,
  type IntegrationRow,
  type CreateIntegrationPayload,
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
  const [showModal, setShowModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  useEffect(() => {
    void load();
  }, [load]);

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
    setShowModal(false);
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
            onClick={() => setShowModal(true)}
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
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-zinc-500" />
            </div>
          ) : integrations.length === 0 ? (
            <EmptyState onAdd={() => setShowModal(true)} />
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
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <AddIntegrationModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
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
}: {
  integration: IntegrationRow;
  isExpanded: boolean;
  isTesting: boolean;
  isDeleting: boolean;
  onExpand: () => void;
  onTest: () => void;
  onDelete: () => void;
  onToggle: () => void;
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

        <button
          type="button"
          onClick={onExpand}
          className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

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

// ── Add Integration Modal ─────────────────────────────────────────────────────

function AddIntegrationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (integration: IntegrationRow) => void;
}) {
  const [step, setStep] = useState<'pick' | 'configure'>('pick');
  const [selectedPlatform, setSelectedPlatform] = useState<DetectionPlatform | null>(null);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
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
      const payload: CreateIntegrationPayload = {
        platform: selectedPlatform,
        name: name.trim(),
        host: host.trim(),
        config: configValues,
      };
      const created = await integrationsApi.create(payload);
      onCreated(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create integration');
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
            {step === 'pick' ? 'Select Platform' : 'Configure Integration'}
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
              <button
                type="button"
                onClick={() => setStep('pick')}
                className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Back
              </button>
              <div className="flex-1" />
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add Integration
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
