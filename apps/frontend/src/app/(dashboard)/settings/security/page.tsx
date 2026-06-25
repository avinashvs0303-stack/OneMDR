'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import {
  ChevronLeft,
  Shield,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import Link from 'next/link';
import { useCurrentUser } from '@/store/auth.store';
import { setupMfa, enableMfa, disableMfa } from '@/lib/auth.api';
import { cn } from '@/lib/utils';
import Image from 'next/image';

type MFAStep = 'idle' | 'setup' | 'confirm' | 'disable';

export default function SecurityPage() {
  const user = useCurrentUser();
  const mfaOn = user?.mfaEnabled ?? false;

  const [step, setStep] = useState<MFAStep>('idle');
  const [qr, setQr] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpCode, setTotpCode] = useState('');
  const [showCodes, setShowCodes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const startSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const { qrDataUrl, backupCodes: codes } = await setupMfa();
      setQr(qrDataUrl);
      setBackupCodes(codes);
      setStep('setup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start MFA setup');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      await enableMfa(totpCode.trim());
      setStep('idle');
      setQr(null);
      setTotpCode('');
      setSuccess('MFA has been enabled on your account.');
      // Reload page to refresh user state
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code — try again');
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    setBusy(true);
    setError(null);
    try {
      await disableMfa(totpCode.trim());
      setStep('idle');
      setTotpCode('');
      setSuccess('MFA has been disabled.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code — try again');
    } finally {
      setBusy(false);
    }
  };

  const copyBackupCodes = () => {
    void navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Security" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to settings
          </Link>

          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4 shrink-0" /> {success}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* MFA card */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border',
                    mfaOn
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-zinc-500',
                  )}
                >
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Two-factor authentication
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {mfaOn
                      ? 'Active — your account is protected with TOTP.'
                      : 'Add an extra layer of security to your account.'}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-semibold border',
                  mfaOn
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25'
                    : 'text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10',
                )}
              >
                {mfaOn ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {/* Setup flow */}
            {step === 'idle' && !mfaOn && (
              <button
                type="button"
                onClick={() => void startSetup()}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60 transition-colors"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Enable MFA
              </button>
            )}

            {step === 'setup' && qr && (
              <div className="space-y-4">
                <p className="text-sm text-slate-700 dark:text-zinc-300">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.),
                  then enter the 6-digit code below.
                </p>
                <div className="flex justify-center">
                  <Image
                    src={qr}
                    alt="MFA QR code"
                    width={180}
                    height={180}
                    className="rounded-lg border border-black/10 dark:border-white/10"
                  />
                </div>

                {/* Backup codes */}
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Save your backup codes
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCodes((v) => !v)}
                        className="text-amber-600 dark:text-amber-400"
                      >
                        {showCodes ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={copyBackupCodes}
                        className="text-amber-600 dark:text-amber-400"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {copied && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          Copied!
                        </span>
                      )}
                    </div>
                  </div>
                  {showCodes ? (
                    <div className="grid grid-cols-2 gap-1">
                      {backupCodes.map((c) => (
                        <code
                          key={c}
                          className="text-xs font-mono text-amber-900 dark:text-amber-200"
                        >
                          {c}
                        </code>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 dark:text-amber-400/70">
                      Click the eye icon to reveal your backup codes. Store them somewhere safe.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                    Verification code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="block w-40 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3.5 py-2.5 text-center text-lg font-mono tracking-widest text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void confirmEnable()}
                    disabled={busy || totpCode.length !== 6}
                    className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60 transition-colors"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Verify & enable
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('idle');
                      setQr(null);
                      setTotpCode('');
                    }}
                    className="text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {step === 'idle' && mfaOn && (
              <button
                type="button"
                onClick={() => setStep('disable')}
                className="rounded-lg border border-red-200 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                Disable MFA
              </button>
            )}

            {step === 'disable' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-700 dark:text-zinc-300">
                  Enter your current 6-digit authenticator code to disable MFA.
                </p>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                    Current TOTP code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="block w-40 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3.5 py-2.5 text-center text-lg font-mono tracking-widest text-slate-900 dark:text-white focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void confirmDisable()}
                    disabled={busy || totpCode.length !== 6}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60 transition-colors"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Disable MFA
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('idle');
                      setTotpCode('');
                    }}
                    className="text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
