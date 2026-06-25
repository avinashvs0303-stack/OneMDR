'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import {
  Activity,
  LogIn,
  LogOut,
  Shield,
  Key,
  Settings,
  Users,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Zap,
  FileSearch,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActivity, type ActivityEvent } from '@/lib/auth.api';
import { getInitials } from '@/lib/utils';

// ── Action → display config ────────────────────────────────────────────────────

type ActionConfig = { label: string; icon: React.ElementType; iconClass: string };

const ACTION_MAP: Record<string, ActionConfig> = {
  AUTH_LOGIN: {
    label: 'Signed in',
    icon: LogIn,
    iconClass:
      'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  },
  AUTH_LOGOUT: {
    label: 'Signed out',
    icon: LogOut,
    iconClass:
      'text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10',
  },
  AUTH_MFA_ENABLED: {
    label: 'MFA enabled',
    icon: Shield,
    iconClass:
      'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  },
  AUTH_MFA_DISABLED: {
    label: 'MFA disabled',
    icon: Shield,
    iconClass:
      'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  },
  TENANT_INVITE_USER: {
    label: 'Team member invited',
    icon: Users,
    iconClass:
      'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
  },
  TENANT_DEACTIVATE_USER: {
    label: 'Team member deactivated',
    icon: Users,
    iconClass:
      'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
  },
  DETECTION_CREATED: {
    label: 'Detection created',
    icon: FileSearch,
    iconClass:
      'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  },
  DETECTION_UPDATED: {
    label: 'Detection updated',
    icon: FileSearch,
    iconClass:
      'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  },
  DETECTION_DEPLOYED: {
    label: 'Detection deployed',
    icon: Zap,
    iconClass:
      'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20',
  },
  INTEGRATION_CREATED: {
    label: 'Integration connected',
    icon: Server,
    iconClass:
      'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
  },
  INTEGRATION_DELETED: {
    label: 'Integration removed',
    icon: Server,
    iconClass:
      'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
  },
  API_KEY_CREATED: {
    label: 'API key created',
    icon: Key,
    iconClass:
      'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20',
  },
  SETTINGS_UPDATED: {
    label: 'Settings updated',
    icon: Settings,
    iconClass:
      'text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10',
  },
};

const DEFAULT_ACTION: ActionConfig = {
  label: 'System event',
  icon: Activity,
  iconClass:
    'text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10',
};

function fmtRelative(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const AVATAR_COLORS = [
  'bg-amber-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-blue-600',
  'bg-rose-600',
  'bg-cyan-600',
];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!;
}

export default function ActivityFeedPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getActivity(100);
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Activity Feed" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {loading ? '…' : `${events.length} events`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
              disabled={loading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-400 dark:text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading activity…</span>
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 py-16 text-center space-y-2">
              <Activity className="mx-auto h-8 w-8 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm text-slate-500 dark:text-zinc-400">No activity yet</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                Team actions like logins, detection changes, and integration updates will appear
                here.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
              {events.map((ev) => {
                const cfg = ACTION_MAP[ev.action] ?? DEFAULT_ACTION;
                const Icon = cfg.icon;
                const actor = ev.actor;
                return (
                  <div
                    key={ev.id}
                    className="flex gap-4 px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                        cfg.iconClass,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {cfg.label}
                          {ev.resource && (
                            <span className="ml-1 text-slate-500 dark:text-zinc-400 font-normal">
                              · {ev.resource}
                              {ev.resourceId && (
                                <span className="ml-1 font-mono text-[11px]">
                                  #{ev.resourceId.slice(0, 8)}
                                </span>
                              )}
                            </span>
                          )}
                        </p>
                        <span className="shrink-0 text-[11px] text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                          {fmtRelative(ev.createdAt)}
                        </span>
                      </div>
                      {actor && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white',
                              avatarColor(actor.id),
                            )}
                          >
                            {getInitials(actor.firstName, actor.lastName)}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-zinc-400">
                            {actor.firstName} {actor.lastName}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                            · {actor.role.toLowerCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
