'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import {
  Search,
  Shield,
  User,
  UserCheck,
  Loader2,
  AlertTriangle,
  Plus,
  X,
  Trash2,
  Users,
  Lock,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils';
import { listMembers, type TenantMember, type UserRole } from '@/lib/auth.api';
import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  type PermissionGroup,
} from '@/lib/soc.api';
import { useCurrentUser } from '@/store/auth.store';

// ── Role config ───────────────────────────────────────────────────────────────

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

// ── Permission definitions ────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  { key: 'DETECTIONS', label: 'Detection Library' },
  { key: 'HUNTS', label: 'Hunt Missions' },
  { key: 'SOC_OPS', label: 'SOC Operations' },
  { key: 'INCIDENTS', label: 'Incident Tracker' },
  { key: 'SECRETS', label: 'Secret Vault' },
  { key: 'DASHBOARDS', label: 'Dashboards' },
  { key: 'THREAT_MODELS', label: 'Threat Models' },
  { key: 'INTEGRATIONS', label: 'Integrations' },
  { key: 'LOG_SOURCES', label: 'Log Sources' },
];

const GROUP_COLORS = [
  { key: 'blue', label: 'Blue', cls: 'bg-blue-600' },
  { key: 'violet', label: 'Violet', cls: 'bg-violet-600' },
  { key: 'amber', label: 'Amber', cls: 'bg-amber-600' },
  { key: 'emerald', label: 'Emerald', cls: 'bg-emerald-600' },
  { key: 'rose', label: 'Rose', cls: 'bg-rose-600' },
  { key: 'cyan', label: 'Cyan', cls: 'bg-cyan-600' },
];

function groupColorCls(color: string) {
  return GROUP_COLORS.find((c) => c.key === color)?.cls ?? 'bg-blue-600';
}

// ── Group modal ───────────────────────────────────────────────────────────────

function GroupModal({
  existing,
  onClose,
  onSave,
}: {
  existing?: PermissionGroup;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    color: string;
    permissions: string[];
  }) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [color, setColor] = useState(existing?.color ?? 'blue');
  const [permissions, setPermissions] = useState<string[]>(existing?.permissions ?? []);
  const [saving, setSaving] = useState(false);

  const togglePerm = (key: string) =>
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), color, permissions });
      onClose();
    } finally {
      setSaving(false);
    }
  };

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
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {existing ? 'Edit Group' : 'New Permission Group'}
        </h2>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. SOC Analysts, Tier 2 Team"
            className="block w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="block w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
            Color
          </label>
          <div className="flex items-center gap-2">
            {GROUP_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setColor(c.key)}
                className={cn(
                  'h-7 w-7 rounded-full transition-all',
                  c.cls,
                  color === c.key
                    ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 ring-current scale-110'
                    : 'opacity-60 hover:opacity-100',
                )}
                title={c.label}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
            Permissions
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_PERMISSIONS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => togglePerm(p.key)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-left transition-all',
                  permissions.includes(p.key)
                    ? 'border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                    : 'border-black/10 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:border-black/20 dark:hover:border-white/20',
                )}
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                    permissions.includes(p.key)
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-slate-300 dark:border-zinc-600',
                  )}
                >
                  {permissions.includes(p.key) && <Check className="h-2.5 w-2.5" />}
                </span>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={!name.trim() || saving}
            onClick={() => void submit()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {existing ? 'Save changes' : 'Create group'}
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

// ── Add member modal ──────────────────────────────────────────────────────────

function AddMemberModal({
  group,
  members,
  onClose,
  onAdd,
}: {
  group: PermissionGroup;
  members: TenantMember[];
  onClose: () => void;
  onAdd: (userId: string) => Promise<void>;
}) {
  const existingIds = new Set(group.memberships.map((m) => m.user.id));
  const available = members.filter((m) => !existingIds.has(m.id));
  const [saving, setSaving] = useState<string | null>(null);

  const add = async (userId: string) => {
    setSaving(userId);
    try {
      await onAdd(userId);
      onClose();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-6 mx-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          Add member to &ldquo;{group.name}&rdquo;
        </h2>
        {available.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-zinc-400 text-center py-6">
            All team members are already in this group.
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {available.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => void add(m.id)}
                disabled={!!saving}
                className="w-full flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left disabled:opacity-50"
              >
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                    avatarColor(m.id),
                  )}
                >
                  {getInitials(m.firstName, m.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {m.firstName} {m.lastName}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{m.email}</p>
                </div>
                {saving === m.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState<'team' | 'groups'>('team');

  // Team members
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Groups
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState<'create' | PermissionGroup | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [addMemberGroup, setAddMemberGroup] = useState<PermissionGroup | null>(null);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<PermissionGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const canManageGroups = ['OWNER', 'ADMIN'].includes(currentUser?.role ?? '');

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    setMembersError(null);
    try {
      setMembers(await listMembers());
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Failed to load team members');
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    setGroupsError(null);
    try {
      setGroups(await listGroups());
    } catch (err) {
      setGroupsError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (tab === 'groups') void loadGroups();
  }, [tab, loadGroups]);

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

  const handleSaveGroup = async (data: {
    name: string;
    description: string;
    color: string;
    permissions: string[];
  }) => {
    if (groupModal === 'create') {
      await createGroup(data);
    } else if (groupModal && typeof groupModal === 'object') {
      await updateGroup(groupModal.id, data);
    }
    await loadGroups();
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupConfirm) return;
    setDeletingGroup(true);
    try {
      await deleteGroup(deleteGroupConfirm.id);
      setDeleteGroupConfirm(null);
      setExpandedGroup(null);
      await loadGroups();
    } finally {
      setDeletingGroup(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!addMemberGroup) return;
    await addGroupMember(addMemberGroup.id, userId);
    await loadGroups();
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    await removeGroupMember(groupId, userId);
    await loadGroups();
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="My Team" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* KPI bar */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total members', value: loadingMembers ? '—' : String(total) },
            { label: 'Admins / Owners', value: loadingMembers ? '—' : String(admins) },
            { label: 'MFA enabled', value: loadingMembers ? '—' : String(mfaEnabled) },
            { label: 'Inactive', value: loadingMembers ? '—' : String(inactive) },
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

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-black/10 dark:border-white/10">
          {(
            [
              { key: 'team', label: 'Team Members', icon: Users },
              { key: 'groups', label: 'Permission Groups', icon: Lock },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Team Members tab ── */}
        {tab === 'team' && (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-3 py-2 max-w-xs">
              <Search className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members…"
                className="flex-1 bg-transparent text-sm text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 outline-none"
              />
            </div>

            {membersError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {membersError}
              </div>
            )}

            {loadingMembers ? (
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
                                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                                    {m.email}
                                  </p>
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
          </>
        )}

        {/* ── Permission Groups tab ── */}
        {tab === 'groups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Create custom permission groups and assign team members to control access per
                tenant.
              </p>
              {canManageGroups && (
                <button
                  type="button"
                  onClick={() => setGroupModal('create')}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> New Group
                </button>
              )}
            </div>

            {groupsError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {groupsError}
              </div>
            )}

            {!canManageGroups && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                <Lock className="h-4 w-4 shrink-0" />
                Only Owners and Admins can create and manage permission groups.
              </div>
            )}

            {loadingGroups ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-400 dark:text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading groups…</span>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                  <Lock className="h-6 w-6 text-slate-400 dark:text-zinc-500" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
                  No permission groups yet
                </p>
                {canManageGroups && (
                  <button
                    type="button"
                    onClick={() => setGroupModal('create')}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Create first group
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((g) => {
                  const isExpanded = expandedGroup === g.id;
                  return (
                    <div
                      key={g.id}
                      className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg overflow-hidden"
                    >
                      {/* Group header */}
                      <div className="flex items-center gap-4 px-5 py-4">
                        <div
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-bold text-sm',
                            groupColorCls(g.color),
                          )}
                        >
                          {g.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {g.name}
                          </p>
                          {g.description && (
                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                              {g.description}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {g.permissions.length === 0 ? (
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500 italic">
                                No permissions assigned
                              </span>
                            ) : (
                              g.permissions.map((perm) => (
                                <span
                                  key={perm}
                                  className="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-zinc-300"
                                >
                                  {ALL_PERMISSIONS.find((p) => p.key === perm)?.label ?? perm}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-400 dark:text-zinc-500">
                            {g.memberships.length} member{g.memberships.length !== 1 ? 's' : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedGroup(isExpanded ? null : g.id)}
                            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            {isExpanded ? 'Hide' : 'Manage'}
                          </button>
                          {canManageGroups && (
                            <>
                              <button
                                type="button"
                                onClick={() => setGroupModal(g)}
                                className="rounded-lg border border-black/10 dark:border-white/10 p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                title="Edit group"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteGroupConfirm(g)}
                                className="rounded-lg border border-black/10 dark:border-white/10 p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                title="Delete group"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expanded members panel */}
                      {isExpanded && (
                        <div className="border-t border-black/10 dark:border-white/10 px-5 py-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                              Members
                            </p>
                            {canManageGroups && (
                              <button
                                type="button"
                                onClick={() => setAddMemberGroup(g)}
                                className="flex items-center gap-1 rounded-lg border border-black/10 dark:border-white/10 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                              >
                                <Plus className="h-3 w-3" /> Add member
                              </button>
                            )}
                          </div>
                          {g.memberships.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-zinc-500 italic">
                              No members in this group yet.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {g.memberships.map((m) => (
                                <div
                                  key={m.id}
                                  className="flex items-center gap-3 rounded-lg border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 px-3 py-2"
                                >
                                  <div
                                    className={cn(
                                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
                                      avatarColor(m.user.id),
                                    )}
                                  >
                                    {getInitials(m.user.firstName, m.user.lastName)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-900 dark:text-white">
                                      {m.user.firstName} {m.user.lastName}
                                    </p>
                                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                                      {m.user.email}
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                                    {m.user.role}
                                  </span>
                                  {canManageGroups && (
                                    <button
                                      type="button"
                                      onClick={() => void handleRemoveMember(g.id, m.user.id)}
                                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                      title="Remove from group"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {(groupModal === 'create' || (groupModal && typeof groupModal === 'object')) && (
        <GroupModal
          existing={typeof groupModal === 'object' ? groupModal : undefined}
          onClose={() => setGroupModal(null)}
          onSave={handleSaveGroup}
        />
      )}

      {addMemberGroup && (
        <AddMemberModal
          group={addMemberGroup}
          members={members}
          onClose={() => setAddMemberGroup(null)}
          onAdd={handleAddMember}
        />
      )}

      {deleteGroupConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-6 w-96 mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Delete Group</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  This will permanently delete{' '}
                  <span className="font-medium text-slate-700 dark:text-zinc-200">
                    &ldquo;{deleteGroupConfirm.name}&rdquo;
                  </span>{' '}
                  and remove all its memberships. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteGroupConfirm(null)}
                disabled={deletingGroup}
                className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteGroup()}
                disabled={deletingGroup}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingGroup ? 'Deleting…' : 'Delete group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
