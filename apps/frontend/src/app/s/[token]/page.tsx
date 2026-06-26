'use client';

import { useEffect, useState, use } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Flame,
} from 'lucide-react';
import { peekSecret, viewSecret } from '@/lib/secrets.api';

type State =
  | { phase: 'loading' }
  | { phase: 'burned'; reason: string }
  | { phase: 'passphrase' }
  | { phase: 'ready'; label: string | null; expiresAt: string; hasPassphrase: boolean }
  | { phase: 'revealed'; content: string; label: string | null; creatorName: string | null }
  | { phase: 'error'; message: string };

export default function ViewSecretPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [passphrase, setPassphrase] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const peek = await peekSecret(token);
        if (peek.burned) {
          const msgs: Record<string, string> = {
            viewed: 'This secret has already been viewed and burned.',
            revoked: 'This secret was revoked by the sender.',
            expired: 'This secret has expired.',
          };
          setState({
            phase: 'burned',
            reason: msgs[peek.burnReason ?? ''] ?? 'This secret is no longer available.',
          });
          return;
        }
        if (peek.hasPassphrase) {
          setState({ phase: 'passphrase' });
        } else {
          setState({
            phase: 'ready',
            label: peek.label,
            expiresAt: peek.expiresAt,
            hasPassphrase: false,
          });
        }
      } catch {
        setState({
          phase: 'burned',
          reason: 'This secret does not exist or has already been used.',
        });
      }
    })();
  }, [token]);

  async function reveal(pp?: string) {
    setRevealing(true);
    try {
      const res = await viewSecret(token, pp);
      setState({
        phase: 'revealed',
        content: res.content,
        label: res.label,
        creatorName: res.creatorName,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to decrypt secret.';
      if (state.phase === 'passphrase') {
        setState({ phase: 'error', message: 'Incorrect passphrase. Try again.' });
        setTimeout(() => setState({ phase: 'passphrase' }), 2000);
      } else {
        setState({ phase: 'error', message: msg });
      }
    } finally {
      setRevealing(false);
    }
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-lg shadow-lg shadow-blue-500/30 mb-3">
            M
          </div>
          <p className="text-xs text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
            OneMDR · Secret Vault
          </p>
        </div>

        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
          {/* Loading */}
          {state.phase === 'loading' && (
            <div className="p-8 text-center">
              <div className="mx-auto h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-3" />
              <p className="text-sm text-slate-500 dark:text-zinc-400">Verifying secret…</p>
            </div>
          )}

          {/* Burned */}
          {(state.phase === 'burned' || state.phase === 'error') && (
            <div className="p-8 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800">
                <Flame className="h-7 w-7 text-slate-400 dark:text-zinc-500" />
              </div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                Secret Burned
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                {state.phase === 'burned' ? state.reason : state.message}
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 pt-2">
                One-time secrets are destroyed after viewing for your security.
              </p>
            </div>
          )}

          {/* Passphrase required */}
          {state.phase === 'passphrase' && (
            <div className="p-6 space-y-4">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
                  <Lock className="h-6 w-6 text-blue-500" />
                </div>
                <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                  Passphrase Required
                </h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  The sender has protected this secret with a passphrase.
                </p>
              </div>
              <input
                type={showPass ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && passphrase) void reveal(passphrase);
                }}
                placeholder="Enter passphrase"
                autoFocus
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void reveal(passphrase)}
                  disabled={!passphrase || revealing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {revealing ? 'Verifying…' : 'Unlock Secret'}
                </button>
                <button
                  onClick={() => setShowPass((v) => !v)}
                  className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Ready to reveal */}
          {state.phase === 'ready' && (
            <div className="p-6 space-y-4">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
                  <ShieldCheck className="h-6 w-6 text-emerald-500" />
                </div>
                <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                  {state.label ?? 'One-Time Secret'}
                </h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  This secret will be permanently destroyed after you view it.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Only click reveal if you are ready. The secret cannot be viewed again.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500">
                <Clock className="h-3.5 w-3.5" />
                <span>Expires {new Date(state.expiresAt).toLocaleString()}</span>
              </div>

              <button
                onClick={() => void reveal()}
                disabled={revealing}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Eye className="h-4 w-4" />
                {revealing ? 'Decrypting…' : 'Reveal & Burn Secret'}
              </button>
            </div>
          )}

          {/* Revealed */}
          {state.phase === 'revealed' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {state.label ?? 'Secret Revealed'}
                  </h1>
                  {state.creatorName && (
                    <p className="text-xs text-slate-400 dark:text-zinc-500">
                      Shared by {state.creatorName}
                    </p>
                  )}
                </div>
              </div>

              <div className="relative rounded-lg bg-slate-50 dark:bg-white/5 border border-black/10 dark:border-white/10 p-4">
                <pre className="whitespace-pre-wrap break-all text-sm font-mono text-slate-800 dark:text-zinc-100 pr-8">
                  {state.content}
                </pre>
                <button
                  onClick={() => copy(state.content)}
                  className="absolute right-2 top-2 rounded-md p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  title="Copy"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-3">
                <Flame className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-300">
                  This secret has been permanently destroyed. Save it now — this page cannot be
                  reloaded to retrieve it again.
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-zinc-600">
          Encrypted end-to-end with AES-256-GCM · Powered by OneMDR
        </p>
      </div>
    </div>
  );
}
