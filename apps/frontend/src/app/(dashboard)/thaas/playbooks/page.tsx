'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';
import {
  huntsApi,
  type HuntPlaybook,
  type HuntSchedule,
  type PlaybookQuery,
  type PlaybookSearchResult,
  type CreateSchedulePayload,
} from '@/lib/hunts.api';
import { integrationsApi, type IntegrationRow } from '@/lib/integrations.api';
import {
  BookOpen,
  Play,
  Plus,
  ChevronDown,
  ChevronRight,
  Clock,
  Shield,
  Loader2,
  Calendar,
  X,
  Search,
  CheckCircle,
  AlertTriangle,
  Rocket,
} from 'lucide-react';

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'text-red-700 dark:text-red-400 bg-red-500/15 border-red-500/30',
  HIGH: 'text-orange-700 dark:text-orange-400 bg-orange-500/15 border-orange-500/30',
  MEDIUM: 'text-amber-700 dark:text-amber-400 bg-amber-500/15 border-amber-500/20',
  LOW: 'text-slate-600 dark:text-zinc-400 bg-slate-500/10 border-slate-500/20',
};

const CATEGORY_COLOR: Record<string, string> = {
  Ransomware: 'text-red-600 dark:text-red-400',
  'Living Off the Land': 'text-orange-600 dark:text-orange-400',
  'Credential Access': 'text-purple-600 dark:text-purple-400',
  'Lateral Movement': 'text-blue-600 dark:text-blue-400',
  'Command and Control': 'text-cyan-600 dark:text-cyan-400',
  Persistence: 'text-amber-600 dark:text-amber-400',
  Exfiltration: 'text-emerald-600 dark:text-emerald-400',
  'Privilege Escalation': 'text-violet-600 dark:text-violet-400',
};

const COMMON_CRONS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at 6am', value: '0 6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Weekly (Mon 6am)', value: '0 6 * * 1' },
  { label: 'Weekly (Mon midnight)', value: '0 0 * * 1' },
];

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<HuntPlaybook[]>([]);
  const [schedules, setSchedules] = useState<HuntSchedule[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queries' | 'schedules'>('queries');

  // Query runner state
  const [runningQuery, setRunningQuery] = useState<string | null>(null); // "playbookId-queryIdx"
  const [queryResults, setQueryResults] = useState<Record<string, PlaybookSearchResult>>({});
  const [runIntegrationId, setRunIntegrationId] = useState('');

  // Launch mission modal
  const [launchPlaybookId, setLaunchPlaybookId] = useState<string | null>(null);
  const [launchAnalyst, setLaunchAnalyst] = useState('');
  const [launchNotes, setLaunchNotes] = useState('');
  const [launching, setLaunching] = useState(false);
  const [launchSuccess, setLaunchSuccess] = useState<string | null>(null);

  // Schedule modal
  const [schedulePlaybookId, setSchedulePlaybookId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<Partial<CreateSchedulePayload>>({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pbs, schs, ints] = await Promise.all([
        huntsApi.listPlaybooks(),
        huntsApi.listSchedules(),
        integrationsApi.list(),
      ]);
      setPlaybooks(pbs);
      setSchedules(schs);
      setIntegrations(ints.filter((i) => i.platform === 'SPLUNK' && i.status === 'CONNECTED'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const globalPlaybooks = playbooks.filter((p) => p.isGlobal);
  const customPlaybooks = playbooks.filter((p) => !p.isGlobal);

  const handleRunQuery = async (pb: HuntPlaybook, qi: number, q: PlaybookQuery) => {
    if (!runIntegrationId) return;
    const key = `${pb.id}-${qi}`;
    setRunningQuery(key);
    try {
      const result = await huntsApi.runPlaybookQuery({
        integrationId: runIntegrationId,
        query: q.query,
        earliest: q.earliest ?? '-24h',
        latest: q.latest ?? 'now',
      });
      setQueryResults((prev) => ({ ...prev, [key]: result }));
    } catch {
      setQueryResults((prev) => ({
        ...prev,
        [key]: { sid: '', resultCount: -1, fields: [], results: [] },
      }));
    } finally {
      setRunningQuery(null);
    }
  };

  const handleLaunch = async () => {
    if (!launchPlaybookId) return;
    setLaunching(true);
    try {
      const { mission } = await huntsApi.launchPlaybook(launchPlaybookId, {
        analystName: launchAnalyst,
        notes: launchNotes,
      });
      setLaunchSuccess(mission.missionRef);
      setLaunchPlaybookId(null);
      setLaunchAnalyst('');
      setLaunchNotes('');
    } catch {
      /* show inline error TODO */
    } finally {
      setLaunching(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (
      !schedulePlaybookId ||
      !scheduleForm.integrationId ||
      !scheduleForm.cronExpression ||
      !scheduleForm.name
    )
      return;
    setSavingSchedule(true);
    try {
      const s = await huntsApi.createSchedule({
        playbookId: schedulePlaybookId,
        integrationId: scheduleForm.integrationId!,
        name: scheduleForm.name!,
        cronExpression: scheduleForm.cronExpression!,
        isEnabled: true,
        autoCreateMission: true,
        minResultCount: 1,
      });
      setSchedules((prev) => [s, ...prev]);
      setSchedulePlaybookId(null);
      setScheduleForm({});
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    await huntsApi.deleteSchedule(id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setActiveTab('queries');
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <Header title="Hunt Playbooks" />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Hunt Playbooks" />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Threat Hunt Playbooks
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {globalPlaybooks.length} platform playbooks · {customPlaybooks.length} custom ·{' '}
              {schedules.length} active schedule{schedules.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setSchedulePlaybookId('new')}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New Playbook
          </button>
        </div>

        {/* Launch success banner */}
        {launchSuccess && (
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Hunt mission <strong>{launchSuccess}</strong> created successfully.
            <button onClick={() => setLaunchSuccess(null)} className="ml-auto">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Integration selector for running queries */}
        {integrations.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-2.5">
            <Search className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0" />
            <span className="text-xs text-slate-500 dark:text-zinc-400 shrink-0">
              Run queries against:
            </span>
            <select
              value={runIntegrationId}
              onChange={(e) => setRunIntegrationId(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-800 dark:text-zinc-200 outline-none"
            >
              <option value="">— select Splunk integration —</option>
              {integrations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Platform Playbooks */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            Platform Playbooks ({globalPlaybooks.length})
          </h3>
          {globalPlaybooks.map((pb) => (
            <PlaybookCard
              key={pb.id}
              pb={pb}
              expanded={expandedId === pb.id}
              activeTab={activeTab}
              onToggle={() => toggleExpand(pb.id)}
              onTabChange={setActiveTab}
              runIntegrationId={runIntegrationId}
              runningQuery={runningQuery}
              queryResults={queryResults}
              onRunQuery={(p, qi, q) => void handleRunQuery(p, qi, q)}
              onLaunch={() => setLaunchPlaybookId(pb.id)}
              onSchedule={() => {
                setSchedulePlaybookId(pb.id);
                setScheduleForm({ playbookId: pb.id });
              }}
              schedules={schedules.filter((s) => s.playbookId === pb.id)}
              onDeleteSchedule={(id) => void handleDeleteSchedule(id)}
            />
          ))}
        </section>

        {/* Custom Playbooks */}
        {customPlaybooks.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              Custom Playbooks ({customPlaybooks.length})
            </h3>
            {customPlaybooks.map((pb) => (
              <PlaybookCard
                key={pb.id}
                pb={pb}
                expanded={expandedId === pb.id}
                activeTab={activeTab}
                onToggle={() => toggleExpand(pb.id)}
                onTabChange={setActiveTab}
                runIntegrationId={runIntegrationId}
                runningQuery={runningQuery}
                queryResults={queryResults}
                onRunQuery={(p, qi, q) => void handleRunQuery(p, qi, q)}
                onLaunch={() => setLaunchPlaybookId(pb.id)}
                onSchedule={() => {
                  setSchedulePlaybookId(pb.id);
                  setScheduleForm({ playbookId: pb.id });
                }}
                schedules={schedules.filter((s) => s.playbookId === pb.id)}
                onDeleteSchedule={(id) => void handleDeleteSchedule(id)}
              />
            ))}
          </section>
        )}
      </main>

      {/* Launch Mission Modal */}
      {launchPlaybookId && launchPlaybookId !== 'new' && (
        <Modal onClose={() => setLaunchPlaybookId(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-amber-500" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Launch Hunt Mission
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              This will create an ACTIVE hunt mission from the playbook. You can run queries and
              attach evidence inside the mission.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Your name (analyst)
                </label>
                <input
                  value={launchAnalyst}
                  onChange={(e) => setLaunchAnalyst(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Initial notes (optional)
                </label>
                <textarea
                  value={launchNotes}
                  onChange={(e) => setLaunchNotes(e.target.value)}
                  rows={3}
                  placeholder="Triggered by threat intel, customer alert, etc."
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:border-amber-500/50 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setLaunchPlaybookId(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-black/10 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleLaunch()}
                disabled={launching}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {launching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Rocket className="h-3 w-3" />
                )}
                Launch Mission
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Schedule Modal */}
      {schedulePlaybookId && (
        <Modal onClose={() => setSchedulePlaybookId(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-violet-500" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Schedule Hunt
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Schedule name
                </label>
                <input
                  value={scheduleForm.name ?? ''}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Daily Ransomware Hunt"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Splunk integration
                </label>
                <select
                  value={scheduleForm.integrationId ?? ''}
                  onChange={(e) =>
                    setScheduleForm((p) => ({ ...p, integrationId: e.target.value }))
                  }
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                >
                  <option value="">— select —</option>
                  {integrations.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Frequency
                </label>
                <select
                  value={scheduleForm.cronExpression ?? ''}
                  onChange={(e) =>
                    setScheduleForm((p) => ({ ...p, cronExpression: e.target.value }))
                  }
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                >
                  <option value="">— select frequency —</option>
                  {COMMON_CRONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label} ({c.value})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                When results are found, a Hunt Mission will be created automatically with evidence
                attached.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSchedulePlaybookId(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-black/10 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateSchedule()}
                disabled={
                  savingSchedule ||
                  !scheduleForm.integrationId ||
                  !scheduleForm.cronExpression ||
                  !scheduleForm.name
                }
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {savingSchedule ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Calendar className="h-3 w-3" />
                )}
                Save Schedule
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PlaybookCard({
  pb,
  expanded,
  activeTab,
  onToggle,
  onTabChange,
  runIntegrationId,
  runningQuery,
  queryResults,
  onRunQuery,
  onLaunch,
  onSchedule,
  schedules,
  onDeleteSchedule,
}: {
  pb: HuntPlaybook;
  expanded: boolean;
  activeTab: 'queries' | 'schedules';
  onToggle: () => void;
  onTabChange: (t: 'queries' | 'schedules') => void;
  runIntegrationId: string;
  runningQuery: string | null;
  queryResults: Record<string, PlaybookSearchResult>;
  onRunQuery: (pb: HuntPlaybook, qi: number, q: PlaybookQuery) => void;
  onLaunch: () => void;
  onSchedule: () => void;
  schedules: HuntSchedule[];
  onDeleteSchedule: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors select-none"
        onClick={onToggle}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <BookOpen className="h-4.5 w-4.5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {pb.title}
            </span>
            {pb.isGlobal && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 shrink-0">
                PLATFORM
              </span>
            )}
            <span
              className={cn(
                'text-[9px] px-1.5 py-0.5 rounded border font-medium shrink-0',
                SEVERITY_BADGE[pb.severity] ?? SEVERITY_BADGE['HIGH'],
              )}
            >
              {pb.severity}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span
              className={cn(
                'text-[10px] font-medium',
                CATEGORY_COLOR[pb.category] ?? 'text-slate-500 dark:text-zinc-400',
              )}
            >
              {pb.category}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-0.5">
              <Shield className="h-2.5 w-2.5" />
              {pb.mitreTactic ?? '—'}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-0.5">
              <Search className="h-2.5 w-2.5" />
              {pb.queries.length} quer{pb.queries.length === 1 ? 'y' : 'ies'}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />~{pb.estimatedHours}h
            </span>
            {schedules.length > 0 && (
              <span className="text-[10px] text-violet-600 dark:text-violet-400 flex items-center gap-0.5">
                <Calendar className="h-2.5 w-2.5" />
                {schedules.length} scheduled
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSchedule();
            }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors"
          >
            <Calendar className="h-3 w-3" /> Schedule
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLaunch();
            }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-amber-600 text-white hover:bg-amber-500 transition-colors"
          >
            <Rocket className="h-3 w-3" /> Launch Hunt
          </button>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-black/10 dark:border-white/10">
          {/* Tabs */}
          <div className="flex border-b border-black/10 dark:border-white/10 px-4">
            {(['queries', 'schedules'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                className={cn(
                  'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors capitalize',
                  activeTab === tab
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300',
                )}
              >
                {tab} {tab === 'schedules' && schedules.length > 0 && `(${schedules.length})`}
              </button>
            ))}
          </div>

          {/* Description */}
          <div className="px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02]">
            <p className="text-xs text-slate-600 dark:text-zinc-400">{pb.description}</p>
            {pb.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {pb.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-zinc-400 border border-black/5 dark:border-white/10"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Queries tab */}
          {activeTab === 'queries' && (
            <div className="p-4 space-y-3">
              {pb.queries.map((q, qi) => {
                const key = `${pb.id}-${qi}`;
                const isRunning = runningQuery === key;
                const result = queryResults[key];
                return (
                  <div
                    key={qi}
                    className="rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {q.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                          {q.description}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                            earliest: {q.earliest}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                            latest: {q.latest}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => onRunQuery(pb, qi, q)}
                        disabled={!runIntegrationId || isRunning}
                        title={
                          !runIntegrationId ? 'Select a Splunk integration above to run' : undefined
                        }
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] rounded border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors shrink-0"
                      >
                        {isRunning ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        {isRunning ? 'Running…' : 'Run'}
                      </button>
                    </div>
                    {/* Query */}
                    <div className="border-t border-black/5 dark:border-white/5 px-3 py-2 bg-black/[0.03] dark:bg-black/20">
                      <pre className="text-[9px] text-slate-600 dark:text-zinc-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
                        {q.query}
                      </pre>
                    </div>
                    {/* Results */}
                    {result && (
                      <div className="border-t border-black/5 dark:border-white/5 px-3 py-2">
                        {result.resultCount === -1 ? (
                          <p className="text-[10px] text-red-500 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Query failed — check integration
                            or SPL syntax
                          </p>
                        ) : result.resultCount === 0 ? (
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                            No results — hunt returned clean
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              {result.resultCount} result{result.resultCount !== 1 ? 's' : ''}{' '}
                              returned
                            </p>
                            <div className="overflow-x-auto rounded border border-black/5 dark:border-white/5">
                              <table className="w-full text-[9px]">
                                <thead>
                                  <tr className="bg-black/5 dark:bg-white/5">
                                    {result.fields.slice(0, 6).map((f) => (
                                      <th
                                        key={f}
                                        className="px-2 py-1 text-left text-slate-600 dark:text-zinc-400 font-medium"
                                      >
                                        {f}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {result.results.slice(0, 5).map((row, ri) => (
                                    <tr
                                      key={ri}
                                      className="border-t border-black/5 dark:border-white/5"
                                    >
                                      {result.fields.slice(0, 6).map((f) => (
                                        <td
                                          key={f}
                                          className="px-2 py-1 text-slate-700 dark:text-zinc-300 font-mono truncate max-w-[120px]"
                                        >
                                          {row[f] ?? '—'}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {result.resultCount > 5 && (
                              <p className="text-[9px] text-slate-400 dark:text-zinc-500">
                                {result.resultCount - 5} more rows — launch a hunt mission to
                                investigate
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Schedules tab */}
          {activeTab === 'schedules' && (
            <div className="p-4 space-y-2">
              {schedules.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <p className="text-xs text-slate-400 dark:text-zinc-500">
                    No schedules yet for this playbook.
                  </p>
                  <button
                    onClick={onSchedule}
                    className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    + Add schedule
                  </button>
                </div>
              ) : (
                schedules.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-medium text-slate-800 dark:text-white">{s.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {s.cronExpression} · {s.integration?.name ?? '—'} ·{' '}
                        {s.isEnabled ? (
                          <span className="text-emerald-600 dark:text-emerald-400">enabled</span>
                        ) : (
                          <span className="text-slate-400">paused</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteSchedule(s.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-2xl p-6">
        {children}
      </div>
    </div>
  );
}
