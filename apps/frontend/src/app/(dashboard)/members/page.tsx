'use client';

import { Header } from '@/components/layout/header';
import { Search, Plus, Mail, MoreHorizontal, Shield, User, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils';

const MEMBERS = [
  { id: '1', firstName: 'Alice', lastName: 'Owner', email: 'alice@demo-corp.com', role: 'OWNER', status: 'active', joinedAt: 'Jan 2026', avatar: 'bg-indigo-600' },
  { id: '2', firstName: 'Bob', lastName: 'Admin', email: 'bob@demo-corp.com', role: 'ADMIN', status: 'active', joinedAt: 'Feb 2026', avatar: 'bg-emerald-600' },
  { id: '3', firstName: 'Carol', lastName: 'Member', email: 'carol@demo-corp.com', role: 'MEMBER', status: 'active', joinedAt: 'Feb 2026', avatar: 'bg-violet-600' },
  { id: '4', firstName: 'Dave', lastName: 'Guest', email: 'dave@partner.com', role: 'GUEST', status: 'active', joinedAt: 'Mar 2026', avatar: 'bg-amber-600' },
  { id: '5', firstName: 'Eve', lastName: 'Smith', email: 'eve@demo-corp.com', role: 'MEMBER', status: 'invited', joinedAt: '—', avatar: 'bg-rose-600' },
];

const ROLE_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  OWNER:  { label: 'Owner',  className: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/25',  icon: Shield },
  ADMIN:  { label: 'Admin',  className: 'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25',  icon: Shield },
  MEMBER: { label: 'Member', className: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25', icon: UserCheck },
  GUEST:  { label: 'Guest',  className: 'text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10', icon: User },
};

export default function MembersPage() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Members" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total members', value: '9' },
            { label: 'Admins', value: '2' },
            { label: 'Pending invites', value: '1' },
            { label: 'Guests', value: '1' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 shadow-sm dark:shadow-lg">
              <p className="text-xs text-slate-500 dark:text-zinc-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-3 py-2 flex-1 max-w-xs">
            <Search className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
            <input
              placeholder="Search members…"
              className="flex-1 bg-transparent text-sm text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 outline-none"
            />
          </div>
          <button type="button" className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm shadow-blue-500/20">
            <Plus className="h-3.5 w-3.5" /> Invite member
          </button>
        </div>

        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20">
                {['Member', 'Role', 'Status', 'Joined', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {MEMBERS.map((m) => {
                const role = ROLE_CONFIG[m.role]!;
                const RoleIcon = role.icon;
                return (
                  <tr key={m.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white', m.avatar)}>
                          {getInitials(m.firstName, m.lastName)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{m.firstName} {m.lastName}</p>
                          <p className="text-xs text-slate-500 dark:text-zinc-400">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium', role.className)}>
                        <RoleIcon className="h-3 w-3" /> {role.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border',
                        m.status === 'active'
                          ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25'
                          : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25',
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', m.status === 'active' ? 'bg-emerald-500' : 'bg-amber-400')} />
                        {m.status === 'active' ? 'Active' : 'Invited'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-400">{m.joinedAt}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="flex h-7 w-7 items-center justify-center rounded text-slate-400 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors">
                          <Mail className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" className="flex h-7 w-7 items-center justify-center rounded text-slate-400 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
