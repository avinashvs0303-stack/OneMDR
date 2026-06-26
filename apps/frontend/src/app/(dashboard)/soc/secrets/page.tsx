'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Plus,
  Copy,
  Check,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Link2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  listSecrets,
  createSecret,
  revokeSecret,
  type SharedSecretMeta,
  type CreateSecretResult,
} from '@/lib/secrets.api';

const TTL_OPTIONS = [
  { label: '1 hour', value: 3600 },
  { label: '12 hours', value: 43200 },
  { label: '24 hours', value: 86400 },
  { label: '3 days', value: 259200 },
  { label: '7 days', value: 604800 },
];

function statusBadge(s: SharedSecretMeta) {
  if (s.isRevoked)
    return {
      label: 'Revoked',
      cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
  if (s.viewedAt)
    return {
      label: 'Viewed',
      cls: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
    };
  if (new Date() > new Date(s.expiresAt))
    return {
      label: 'Expired',
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    };
  return {
    label: 'Active',
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
}

function timeLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<SharedSecretMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [result, setResult] = useState<CreateSecretResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  // form state
  const [content, setContent] = useState('');
  const [label, setLabel] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [ttl, setTtl] = useState(86400);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setSecrets(await listSecrets());
    } catch {
      // table not yet migrated — show empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!content.trim()) return;
    setCreating(true);
    try {
      const res = await createSecret({
        content: content.trim(),
        label: label.trim() || undefined,
        passphrase: passphrase.trim() || undefined,
        ttlSeconds: ttl,
      });
      setResult(res);
      setContent('');
      setLabel('');
      setPassphrase('');
      setTtl(86400);
      void load();
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    await revokeSecret(id);
    setRevokeConfirm(null);
    void load();
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeCount = secrets.filter(
    (s) => !s.isRevoked && !s.viewedAt && new Date() < new Date(s.expiresAt),
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-500" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Secret Vault</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Share passwords, tokens, and credentials via one-time encrypted links — auto-burn on
            view.
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate(true);
            setResult(null);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Secret
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Created', value: secrets.length, icon: KeyRound, color: 'text-blue-500' },
          {
            label: 'Active Links',
            value: activeCount,
            icon: ShieldCheck,
            color: 'text-emerald-500',
          },
          {
            label: 'Burned / Expired',
            value: secrets.length - activeCount,
            icon: ShieldOff,
            color: 'text-slate-400',
          },
        ].map(({ label: lbl, value, icon: Icon, color }) => (
          <div
            key={lbl}
            className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('h-4 w-4', color)} />
              <span className="text-xs text-slate-500 dark:text-zinc-400">{lbl}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl">
            {result ? (
              /* Success state */
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Secret Created
                  </h2>
                </div>
                {result.label && (
                  <p className="text-sm text-slate-500 dark:text-zinc-400">{result.label}</p>
                )}
                <div className="rounded-lg bg-slate-50 dark:bg-white/5 border border-black/10 dark:border-white/10 p-3">
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mb-1 uppercase tracking-wide">
                    One-time link
                  </p>
                  <p className="text-xs font-mono text-slate-700 dark:text-zinc-200 break-all">
                    {result.shareUrl}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Expires {new Date(result.expiresAt).toLocaleString()}</span>
                  {result.hasPassphrase && (
                    <>
                      <span>·</span>
                      <Lock className="h-3.5 w-3.5" />
                      <span>Passphrase protected</span>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyUrl(result.shareUrl)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreate(false);
                      setResult(null);
                    }}
                    className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Form state */
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    New One-Time Secret
                  </h2>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1">
                    Secret content <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste password, API key, token, credentials…"
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1">
                    Label (optional)
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Prod DB password for John"
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1">
                      Expires in
                    </label>
                    <select
                      value={ttl}
                      onChange={(e) => setTtl(Number(e.target.value))}
                      className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TTL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1">
                      Passphrase (optional)
                    </label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="Extra protection"
                        className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 pr-9 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    The link burns immediately after the recipient views it. Save a copy of the
                    secret before sharing if you may need it again.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => void handleCreate()}
                    disabled={!content.trim() || creating}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Lock className="h-4 w-4" />
                    {creating ? 'Encrypting…' : 'Encrypt & Generate Link'}
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Secrets list */}
      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 overflow-hidden">
        <div className="border-b border-black/10 dark:border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Your Secrets</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-zinc-500">Loading…</div>
        ) : secrets.length === 0 ? (
          <div className="p-12 text-center">
            <Lock className="mx-auto h-8 w-8 text-slate-300 dark:text-zinc-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No secrets yet. Create your first one-time link.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {secrets.map((s) => {
              const { label: statusLabel, cls } = statusBadge(s);
              const isActive = statusLabel === 'Active';
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-black/2 dark:hover:bg-white/2 transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <KeyRound className="h-4 w-4 text-blue-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-zinc-100 truncate">
                      {s.label ?? 'Untitled secret'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-400 dark:text-zinc-500">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                      {isActive && (
                        <span className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeLeft(s.expiresAt)}
                        </span>
                      )}
                      {s.hasPassphrase && (
                        <span className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Passphrase
                        </span>
                      )}
                    </div>
                  </div>

                  <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', cls)}>
                    {statusLabel}
                  </span>

                  <div className="flex items-center gap-1">
                    {isActive && (
                      <>
                        <button
                          onClick={() => {
                            const token = '(regenerate from DB)';
                            void navigator.clipboard.writeText(token);
                          }}
                          title="Copy link — use New Secret to get the URL"
                          className="rounded-md p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Link2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setRevokeConfirm(s.id)}
                          title="Revoke"
                          className="rounded-md p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revoke confirm */}
      {revokeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Revoke Secret
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  The link will stop working immediately.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void handleRevoke(revokeConfirm)}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Revoke
              </button>
              <button
                onClick={() => setRevokeConfirm(null)}
                className="flex-1 rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
