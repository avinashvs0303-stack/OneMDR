'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Users } from 'lucide-react';
import { getRosterShifts, upsertShift, clearShift } from '@/lib/soc.api';
import type { SocRosterShift } from '@/lib/soc.api';
import { cn } from '@/lib/utils';

const SHIFT_CONFIG = [
  {
    type: 'MORNING',
    label: 'Morning',
    time: '06:00–14:00',
    color: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    type: 'AFTERNOON',
    label: 'Afternoon',
    time: '14:00–22:00',
    color: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  {
    type: 'NIGHT',
    label: 'Night',
    time: '22:00–06:00',
    color: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  {
    type: 'GENERAL',
    label: 'General',
    time: '09:00–17:00',
    color: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function fmtDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function addWeeks(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(d.getDate() + n * 7);
  return next;
}

interface AssignModal {
  shiftType: string;
  dayOfWeek: number;
  existing: SocRosterShift | null;
}

export default function RosterPage() {
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [shifts, setShifts] = useState<SocRosterShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<AssignModal | null>(null);
  const [analystName, setAnalystName] = useState('');
  const [isOncall, setIsOncall] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await getRosterShifts(fmtDate(weekStart));
      setShifts(data);
    } catch {
      setError('Failed to load roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [weekStart]);

  const getShift = (shiftType: string, day: number) =>
    shifts.find((s) => s.shiftType === shiftType && s.dayOfWeek === day) ?? null;

  const openModal = (shiftType: string, dayOfWeek: number) => {
    const existing = getShift(shiftType, dayOfWeek);
    setModal({ shiftType, dayOfWeek, existing });
    setAnalystName(existing?.analystName ?? '');
    setIsOncall(existing?.isOncall ?? false);
    setNotes(existing?.notes ?? '');
  };

  const handleSave = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      await upsertShift({
        weekStart: fmtDate(weekStart),
        shiftType: modal.shiftType,
        dayOfWeek: modal.dayOfWeek,
        analystName: analystName.trim() || undefined,
        isOncall,
        notes: notes.trim() || undefined,
      });
      setModal(null);
      await load();
    } catch {
      setError('Failed to save shift');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!modal?.existing) return;
    setSaving(true);
    try {
      await clearShift(modal.existing.id);
      setModal(null);
      await load();
    } catch {
      setError('Failed to clear shift');
    } finally {
      setSaving(false);
    }
  };

  const weekDays = DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const totalCovered = shifts.filter((s) => s.analystName).length;
  const totalSlots = 4 * 7;
  const coveragePct = Math.round((totalCovered / totalSlots) * 100);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            SOC Roster — 24×7 Coverage
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Week of{' '}
            {weekStart.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}{' '}
            · {coveragePct}% coverage assigned ({totalCovered}/{totalSlots} shifts)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(addWeeks(weekStart, -1))}
            className="rounded-lg border border-black/10 dark:border-white/10 p-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            className="rounded-lg border border-black/10 dark:border-white/10 p-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Coverage bar */}
      <div className="px-6 py-3 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 w-20">Coverage</span>
          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                coveragePct >= 80
                  ? 'bg-green-500'
                  : coveragePct >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500',
              )}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
            {coveragePct}%
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Loading roster…
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 pr-4 text-[11px] font-semibold text-slate-500 dark:text-zinc-400 w-32">
                  Shift
                </th>
                {weekDays.map((d, i) => {
                  const isToday = fmtDate(d) === fmtDate(new Date());
                  return (
                    <th
                      key={i}
                      className={cn(
                        'text-center py-2 px-2 text-[11px] font-semibold w-[calc((100%-8rem)/7)]',
                        isToday
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-500 dark:text-zinc-400',
                      )}
                    >
                      <div>{DAYS[i]}</div>
                      <div
                        className={cn(
                          'text-[10px] font-normal',
                          isToday ? 'text-blue-500' : 'text-slate-400 dark:text-zinc-500',
                        )}
                      >
                        {d.getDate()}/{d.getMonth() + 1}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {SHIFT_CONFIG.map((sc) => (
                <tr key={sc.type}>
                  <td className="py-2 pr-4 align-top">
                    <div className={cn('rounded-lg border px-2.5 py-1.5 text-center', sc.color)}>
                      <div className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                        {sc.label}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400">{sc.time}</div>
                    </div>
                  </td>
                  {DAYS.map((_, dayIdx) => {
                    const shift = getShift(sc.type, dayIdx + 1);
                    const isToday = fmtDate(weekDays[dayIdx]) === fmtDate(new Date());
                    return (
                      <td
                        key={dayIdx}
                        className={cn(
                          'py-2 px-2 align-top',
                          isToday && 'bg-blue-50/50 dark:bg-blue-900/10',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => openModal(sc.type, dayIdx + 1)}
                          className={cn(
                            'w-full rounded-lg border p-2 text-left transition-all min-h-[64px]',
                            shift?.analystName
                              ? `${sc.color} hover:opacity-90`
                              : 'border-dashed border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 bg-transparent',
                          )}
                        >
                          {shift?.analystName ? (
                            <div>
                              <div className="flex items-center gap-1 mb-0.5">
                                <Users className="h-3 w-3 text-slate-500 dark:text-zinc-400" />
                                <span className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200 truncate">
                                  {shift.analystName}
                                </span>
                              </div>
                              {shift.isOncall && (
                                <span
                                  className={cn(
                                    'rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                                    sc.badge,
                                  )}
                                >
                                  ON-CALL
                                </span>
                              )}
                              {shift.notes && (
                                <p className="text-[9px] text-slate-400 dark:text-zinc-500 mt-0.5 line-clamp-1">
                                  {shift.notes}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-10">
                              <Plus className="h-4 w-4 text-slate-300 dark:text-zinc-600" />
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 p-6 w-96 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {SHIFT_CONFIG.find((s) => s.type === modal.shiftType)?.label} Shift —{' '}
                {DAYS[modal.dayOfWeek - 1]}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  Analyst Name
                </label>
                <input
                  value={analystName}
                  onChange={(e) => setAnalystName(e.target.value)}
                  placeholder="Enter analyst name"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="oncall"
                  checked={isOncall}
                  onChange={(e) => setIsOncall(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="oncall" className="text-xs text-slate-700 dark:text-zinc-300">
                  Mark as On-Call for this shift
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                  rows={2}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-between mt-5">
              <div>
                {modal.existing && (
                  <button
                    type="button"
                    onClick={() => void handleClear()}
                    disabled={saving}
                    className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
