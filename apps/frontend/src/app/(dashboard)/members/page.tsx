'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Search, Shield, User, UserCheck, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils';
import { listMembers, type TenantMember, type UserRole } from '@/lib/auth.api';
import { useCurrentUser } from '@/store/auth.store';

const ROLE_CONFIG: Record<UserRole, { label: string; className: string; icon: React.ElementType }> =
  {
    SUPER_ADMIN: {
      label: 'Super Admin',
      className:
        'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/25',
      icon: Shield,
    },
    OWNER: {
      label: 'Owner',
      className:
        'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/25',
      icon: Shield,
    },
    ADMIN: {
      label: 'Admin',
      className:
        'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25',
      icon: Shield,
    },
    MEMBER: {
      label: 'Member',
      className:
        'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25',
      icon: UserCheck,
    },
    GUEST: {
      label: 'Guest',
      className:
        'text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10',
      icon: User,
    },
  };

const AVATAR_COLORS = [
  'bg-amber-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-blue-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-orange-600',
  'bg-teal-600',
];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtRelative(s: string | null) {
  if (!s) return 'Never';
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDate(s);
}

export default function MembersPage() {
  const currentUser = useCurrentUser();
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMembers();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      !q ||
      m.firstName.toLowerCase().includes(q) ||
      m.lastName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  });

  const total = members.length;
  const admins = members.filter((m) => m.role === 'ADMIN' || m.role === 'OWNER').length;
  const inactive = members.filter((m) => !m.isActive).length;
  const mfaEnabled = members.filter((m) => m.mfaEnabled).length;

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="My Team" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* KPI bar */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total members', value: loading ? '—' : String(total) },
            { label: 'Admins / Owners', value: loading ? '—' : String(admins) },
            { label: 'MFA enabled', value: loading ? '—' : String(mfaEnabled) },
            { label: 'Inactive', value: loading ? '—' : String(inactive) },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 shadow-sm dark:shadow-lg"
            >
              <p className="text-xs text-slate-500 dark:text-zinc-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-3 py-2 max-w-xs">
          <Search className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 outline-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-slate-400 dark:text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading team…</span>
          </div>
        ) : (
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20">
                  {['Member', 'Role', 'Status', 'MFA', 'Last login', 'Joined'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-slate-400 dark:text-zinc-500"
                    >
                      {search ? 'No members match your search.' : 'No team members found.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => {
                    const role = ROLE_CONFIG[m.role] ?? ROLE_CONFIG.MEMBER;
                    const RoleIcon = role.icon;
                    const isMe = m.id === currentUser?.id;
                    return (
                      <tr
                        key={m.id}
                        className={cn(
                          'hover:bg-black/5 dark:hover:bg-white/5 transition-colors',
                          isMe && 'bg-amber-50/40 dark:bg-amber-500/5',
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                                avatarColor(m.id),
                              )}
                            >
                              {getInitials(m.firstName, m.lastName)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">
                                {m.firstName} {m.lastName}
                                {isMe && (
                                  <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                    (you)
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-zinc-400">{m.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
                              role.className,
                            )}
                          >
                            <RoleIcon className="h-3 w-3" /> {role.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border',
                              m.isActive
                                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25'
                                : 'text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                m.isActive ? 'bg-emerald-500' : 'bg-slate-400',
                              )}
                            />
                            {m.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-[11px] font-medium',
                              m.mfaEnabled
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400 dark:text-zinc-500',
                            )}
                          >
                            {m.mfaEnabled ? '✓ On' : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-400">
                          {fmtRelative(m.lastLoginAt)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-400">
                          {fmtDate(m.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
