'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { PhoneCall, PhoneOff, CheckCircle, X, Bell, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/store/auth.store';
import { getRosterShifts, type SocRosterShift } from '@/lib/soc.api';

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = 'P1' | 'P2' | 'P3' | 'P4';
type PageStatus = 'idle' | 'paging' | 'acknowledged' | 'escalated';

interface AlertRecord {
  id: string;
  severity: Severity;
  title: string;
  pagedAt: string;
  acknowledgedBy: string | null;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon…6=Sat
  const diff = day === 0 ? -6 : 1 - day; // days back to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0]; // YYYY-MM-DD
}

// dayOfWeek convention in roster: 0=Mon … 6=Sun (ISO, 0-indexed)
function getTodayDayOfWeek(): number {
  const day = new Date().getDay(); // 0=Sun, 1=Mon…6=Sat
  return day === 0 ? 6 : day - 1;
}

function getInitials(name: string | null): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  'bg-amber-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-blue-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-indigo-600',
];

function getAvatarColor(name: string | null): string {
  if (!name) return 'bg-zinc-600';
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Static escalation policy config (SLA/chain are policy, not DB data) ──────

const SEV_SLA: Record<Severity, string> = {
  P1: 'Respond in 15 min · Resolve in 1 hr',
  P2: 'Respond in 30 min · Resolve in 4 hr',
  P3: 'Respond in 2 hr · Resolve in 24 hr',
  P4: 'Respond in 24 hr · Resolve in 72 hr',
};

const SEV_COLOR: Record<Severity, string> = {
  P1: 'text-red-700 dark:text-red-300',
  P2: 'text-amber-700 dark:text-amber-300',
  P3: 'text-yellow-700 dark:text-yellow-300',
  P4: 'text-blue-700 dark:text-blue-300',
};

const SEV_BG: Record<Severity, string> = {
  P1: 'bg-red-600',
  P2: 'bg-amber-600',
  P3: 'bg-yellow-500',
  P4: 'bg-blue-500',
};

type EscLevel = { level: number; role: string; method: string; delayMin: number };
const ESCALATION_CHAIN: Record<Severity, EscLevel[]> = {
  P1: [
    { level: 1, role: 'Primary On-Call', method: 'Phone + SMS', delayMin: 0 },
    { level: 2, role: 'Secondary On-Call', method: 'Phone + SMS', delayMin: 5 },
    { level: 3, role: 'SOC Manager', method: 'Phone + SMS + Email', delayMin: 10 },
    { level: 4, role: 'CISO', method: 'Phone + Email', delayMin: 20 },
  ],
  P2: [
    { level: 1, role: 'Primary On-Call', method: 'SMS + Email', delayMin: 0 },
    { level: 2, role: 'Secondary On-Call', method: 'SMS + Email', delayMin: 15 },
    { level: 3, role: 'SOC Manager', method: 'Phone + Email', delayMin: 30 },
  ],
  P3: [
    { level: 1, role: 'Primary On-Call', method: 'Email', delayMin: 0 },
    { level: 2, role: 'SOC Manager', method: 'Email', delayMin: 60 },
  ],
  P4: [{ level: 1, role: 'Primary On-Call', method: 'Email', delayMin: 0 }],
};

const SEV_BADGE: Record<Severity, string> = {
  P1: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',
  P2: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25',
  P3: 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/25',
  P4: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25',
};

// ── Trigger modal ─────────────────────────────────────────────────────────────

function TriggerModal({
  onClose,
  onFire,
}: {
  onClose: () => void;
  onFire: (sev: Severity, title: string) => void;
}) {
  const [sev, setSev] = useState<Severity>('P1');
  const [title, setTitle] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-6 space-y-5 mx-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25">
            <PhoneCall className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Trigger On-Call Alert
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Pages the on-call analyst immediately
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
            Severity
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['P1', 'P2', 'P3', 'P4'] as Severity[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSev(s)}
                className={cn(
                  'rounded-lg border py-2 text-sm font-bold transition-all',
                  sev === s
                    ? SEV_BADGE[s] + ' shadow-sm'
                    : 'border-black/10 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:border-black/20',
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">{SEV_SLA[sev]}</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
            Incident title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Ransomware detected on PROD-DC-01"
            className="block w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={!title.trim()}
            onClick={() => onFire(sev, title.trim())}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-60',
              sev === 'P1' || sev === 'P2'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-amber-600 hover:bg-amber-500',
            )}
          >
            <PhoneCall className="h-4 w-4" />
            Page On-Call — {sev}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OnCallPage() {
  const user = useCurrentUser();
  const [showTrigger, setShowTrigger] = useState(false);
  const [pageStatus, setPageStatus] = useState<PageStatus>('idle');
  const [activeAlert, setActiveAlert] = useState<{ sev: Severity; title: string } | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [shifts, setShifts] = useState<SocRosterShift[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);

  const weekStart = useMemo(() => getWeekStart(), []);
  const todayDayOfWeek = useMemo(() => getTodayDayOfWeek(), []);

  useEffect(() => {
    getRosterShifts(weekStart)
      .then(setShifts)
      .catch(() => setShifts([]))
      .finally(() => setLoadingRoster(false));
  }, [weekStart]);

  // Primary on-call for today = first shift with isOncall=true for today's dayOfWeek
  const todayOncallShifts = useMemo(
    () => shifts.filter((s) => s.dayOfWeek === todayDayOfWeek && s.isOncall),
    [shifts, todayDayOfWeek],
  );
  const primaryShift = todayOncallShifts[0] ?? null;
  const secondaryShift = todayOncallShifts[1] ?? null;

  // Map of dayOfWeek → primary on-call shift for the weekly grid
  const dailyOncall = useMemo(() => {
    const map = new Map<number, SocRosterShift | null>();
    for (let d = 0; d < 7; d++) {
      map.set(d, shifts.find((s) => s.dayOfWeek === d && s.isOncall) ?? null);
    }
    return map;
  }, [shifts]);

  // Compute actual calendar date for each day of the week
  const weekDates = useMemo(() => {
    const base = new Date(weekStart + 'T00:00:00');
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.getDate();
    });
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const base = new Date(weekStart + 'T00:00:00');
    const end = new Date(base);
    end.setDate(base.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(base)} – ${fmt(end)}`;
  }, [weekStart]);

  const alertCounter = alerts.length + 1;

  const firePage = (sev: Severity, title: string) => {
    setShowTrigger(false);
    setPageStatus('paging');
    setActiveAlert({ sev, title });
    const newAlert: AlertRecord = {
      id: `ALT-${String(alertCounter).padStart(3, '0')}`,
      severity: sev,
      title,
      pagedAt: new Date().toISOString(),
      acknowledgedBy: null,
      status: 'OPEN',
    };
    setAlerts((prev) => [newAlert, ...prev]);
    setTimeout(() => {
      setPageStatus('acknowledged');
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === newAlert.id
            ? { ...a, acknowledgedBy: user?.firstName ?? 'On-Call', status: 'ACKNOWLEDGED' }
            : a,
        ),
      );
    }, 8000);
  };

  const dismissPaging = () => {
    setPageStatus('idle');
    setActiveAlert(null);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="On-Call Management" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Active paging banner */}
        {(pageStatus === 'paging' || pageStatus === 'acknowledged') && activeAlert && (
          <div
            className={cn(
              'flex items-center gap-4 rounded-xl border px-5 py-4 shadow-lg',
              pageStatus === 'paging'
                ? 'border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 animate-pulse'
                : 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20',
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                pageStatus === 'paging'
                  ? 'bg-red-100 dark:bg-red-500/20'
                  : 'bg-emerald-100 dark:bg-emerald-500/20',
              )}
            >
              {pageStatus === 'paging' ? (
                <PhoneCall className="h-5 w-5 text-red-600 dark:text-red-400" />
              ) : (
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm font-bold',
                  pageStatus === 'paging'
                    ? 'text-red-900 dark:text-red-200'
                    : 'text-emerald-900 dark:text-emerald-200',
                )}
              >
                {pageStatus === 'paging'
                  ? `PAGING ON-CALL — ${activeAlert.sev}`
                  : `ACKNOWLEDGED — ${activeAlert.sev}`}
              </p>
              <p className="text-xs text-slate-600 dark:text-zinc-400 truncate">
                {activeAlert.title}
              </p>
              {pageStatus === 'paging' && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Alerting primary on-call via phone + SMS…
                </p>
              )}
              {pageStatus === 'acknowledged' && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Acknowledged by {user?.firstName ?? 'On-Call Analyst'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={dismissPaging}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Left column */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Who's on call now */}
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">On-Call Now</h2>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>

              {loadingRoster ? (
                <div className="h-14 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
              ) : primaryShift ? (
                <>
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black text-white shadow-lg',
                        getAvatarColor(primaryShift.analystName),
                      )}
                    >
                      {getInitials(primaryShift.analystName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {primaryShift.analystName ?? 'Unassigned'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Primary On-Call · {primaryShift.shiftType} shift · {primaryShift.startTime}–
                        {primaryShift.endTime}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="rounded-full border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Available
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          Phone · SMS · Email
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowTrigger(true)}
                        className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 transition-colors shadow-sm shadow-red-500/20"
                      >
                        <PhoneCall className="h-4 w-4" />
                        Page
                      </button>
                    </div>
                  </div>

                  {secondaryShift && (
                    <div className="mt-4 flex items-center gap-3 rounded-lg border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 px-4 py-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white',
                          getAvatarColor(secondaryShift.analystName),
                        )}
                      >
                        {getInitials(secondaryShift.analystName)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                          {secondaryShift.analystName ?? 'Unassigned'}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                          Secondary On-Call · escalation after 5 min (P1) / 15 min (P2)
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <PhoneOff className="h-8 w-8 text-slate-300 dark:text-zinc-600" />
                  <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
                    No on-call analyst configured for today
                  </p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">
                    Assign a roster shift with "On-Call" enabled for today to appear here.
                  </p>
                </div>
              )}
            </div>

            {/* Weekly rotation */}
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Weekly Rotation — {weekLabel}
                </h2>
              </div>
              {loadingRoster ? (
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 animate-pulse rounded-xl bg-black/5 dark:bg-white/5"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {DAY_LABELS.map((day, i) => {
                    const shift = dailyOncall.get(i);
                    const isToday = i === todayDayOfWeek;
                    return (
                      <div
                        key={day}
                        className={cn(
                          'flex flex-col items-center gap-2 rounded-xl border p-3 text-center',
                          isToday
                            ? 'border-amber-400 dark:border-amber-500/60 bg-amber-50 dark:bg-amber-500/10'
                            : 'border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20',
                        )}
                      >
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-wider',
                            isToday
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-slate-400 dark:text-zinc-500',
                          )}
                        >
                          {day}
                        </span>
                        <span
                          className={cn(
                            'text-sm font-bold',
                            isToday
                              ? 'text-amber-900 dark:text-amber-100'
                              : 'text-slate-700 dark:text-zinc-300',
                          )}
                        >
                          {weekDates[i]}
                        </span>
                        {shift ? (
                          <>
                            <div
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-white',
                                getAvatarColor(shift.analystName),
                              )}
                            >
                              {getInitials(shift.analystName)}
                            </div>
                            <span className="text-[9px] text-slate-500 dark:text-zinc-500 leading-tight text-center hidden sm:block truncate max-w-full">
                              {shift.analystName?.split(' ')[0] ?? '—'}
                            </span>
                          </>
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 dark:bg-white/10 text-[10px] font-bold text-slate-400 dark:text-zinc-500">
                            —
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Alert history — in-session only (paging events are ephemeral) */}
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg overflow-hidden">
              <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-5 py-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Alert History</h2>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                  {alerts.filter((a) => a.status === 'OPEN').length} open this session
                </span>
              </div>
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Bell className="h-7 w-7 text-slate-300 dark:text-zinc-600" />
                  <p className="text-sm text-slate-400 dark:text-zinc-500">
                    No alerts this session
                  </p>
                  <p className="text-xs text-slate-400 dark:text-zinc-600">
                    Triggered alerts will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-black/5 dark:divide-white/5">
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0',
                          SEV_BADGE[a.severity],
                        )}
                      >
                        {a.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {a.title}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                          {new Date(a.pagedAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {a.acknowledgedBy && ` · acked by ${a.acknowledgedBy}`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          a.status === 'OPEN'
                            ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25'
                            : a.status === 'ACKNOWLEDGED'
                              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
                        )}
                      >
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column — escalation policies */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Escalation Policies
              </h2>
              {(['P1', 'P2', 'P3', 'P4'] as Severity[]).map((sev) => {
                const chain = ESCALATION_CHAIN[sev];
                return (
                  <div key={sev} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                          SEV_BADGE[sev],
                        )}
                      >
                        {sev}
                      </span>
                      <span className={cn('text-[10px]', SEV_COLOR[sev])}>{SEV_SLA[sev]}</span>
                    </div>
                    <div className="ml-2 space-y-1.5">
                      {chain.map((lvl) => (
                        <div key={lvl.level} className="flex items-start gap-2">
                          <div className="flex flex-col items-center pt-1">
                            <div
                              className={cn(
                                'h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0',
                                SEV_BG[sev],
                              )}
                            >
                              {lvl.level}
                            </div>
                            {lvl.level < chain.length && (
                              <div className="w-px flex-1 bg-black/10 dark:bg-white/10 mt-1 h-3" />
                            )}
                          </div>
                          <div className="pb-2">
                            <p className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 leading-tight">
                              {lvl.role}
                              {lvl.delayMin > 0 && (
                                <span className="ml-1 font-normal text-slate-400 dark:text-zinc-500">
                                  +{lvl.delayMin} min
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                              {lvl.method}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg space-y-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Quick Actions
              </h2>
              <button
                type="button"
                onClick={() => setShowTrigger(true)}
                className="flex w-full items-center gap-3 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-500 transition-colors shadow-sm shadow-red-500/20"
              >
                <PhoneCall className="h-4 w-4 shrink-0" />
                Trigger P1 / P2 Alert
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <PhoneOff className="h-4 w-4 shrink-0 text-slate-400" />
                Override On-Call
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <Bell className="h-4 w-4 shrink-0 text-slate-400" />
                Test Notifications
              </button>
            </div>
          </div>
        </div>
      </main>

      {showTrigger && <TriggerModal onClose={() => setShowTrigger(false)} onFire={firePage} />}
    </div>
  );
}
