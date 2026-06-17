'use client';

import { Header } from '@/components/layout/header';
import { Plus, Clock, AlertTriangle, FileText, Target, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type HuntStatus = 'Active' | 'Planned' | 'Complete' | 'Archived';

const HUNTS = [
  {
    id: 'HNT-0006', title: 'Kerberoasting & Pass-the-Hash Campaign',
    hypothesis: 'Threat actors may be using Kerberoasting to crack service account hashes and subsequently leveraging PtH for lateral movement across the Active Directory environment.',
    status: 'Active' as HuntStatus, analyst: 'Alice Owner', tacticId: 'TA0006', tactic: 'Credential Access',
    techniques: ['T1558.003', 'T1550.002'], startDate: '2026-06-10', endDate: null,
    findings: 2, detectionsFed: 0, priority: 'Critical',
  },
  {
    id: 'HNT-0005', title: 'Living-off-the-Land Binary Abuse',
    hypothesis: 'Adversaries may be abusing signed Windows binaries (LOLBins) including certutil, mshta, and regsvr32 to proxy malicious payload execution and evade endpoint defences.',
    status: 'Complete' as HuntStatus, analyst: 'Bob Admin', tacticId: 'TA0005', tactic: 'Defense Evasion',
    techniques: ['T1218.001', 'T1218.005', 'T1218.010'], startDate: '2026-05-20', endDate: '2026-06-02',
    findings: 1, detectionsFed: 2, priority: 'High',
  },
  {
    id: 'HNT-0004', title: 'Ransomware Pre-Deployment Indicators',
    hypothesis: 'Ransomware operators typically perform recon, disable backups, and exfiltrate data 24–72h before encryption. Hunt for shadow copy deletion, volume enumeration, and large archive creation.',
    status: 'Complete' as HuntStatus, analyst: 'Carol Member', tacticId: 'TA0040', tactic: 'Impact',
    techniques: ['T1490', 'T1486', 'T1048'], startDate: '2026-05-01', endDate: '2026-05-14',
    findings: 0, detectionsFed: 1, priority: 'Critical',
  },
  {
    id: 'HNT-0003', title: 'Cloud Identity Persistence via OAuth App Grants',
    hypothesis: 'Threat actors compromise OAuth apps with excessive permissions to maintain persistence in Microsoft 365 and Azure AD tenants, surviving password resets and MFA enforcement.',
    status: 'Planned' as HuntStatus, analyst: 'Alice Owner', tacticId: 'TA0003', tactic: 'Persistence',
    techniques: ['T1098.003', 'T1550.001'], startDate: '2026-06-20', endDate: null,
    findings: 0, detectionsFed: 0, priority: 'High',
  },
  {
    id: 'HNT-0002', title: 'C2 Beaconing via Encrypted DNS',
    hypothesis: 'Threat actors increasingly use DNS-over-HTTPS (DoH) to tunnel C2 communications through encrypted DNS, bypassing traditional DNS-based detection.',
    status: 'Complete' as HuntStatus, analyst: 'Bob Admin', tacticId: 'TA0011', tactic: 'Command and Control',
    techniques: ['T1071.004', 'T1573'], startDate: '2026-04-10', endDate: '2026-04-22',
    findings: 3, detectionsFed: 1, priority: 'Medium',
  },
];

const STATUS_CONFIG: Record<HuntStatus, { dot: string; badge: string }> = {
  Active:   { dot: 'bg-emerald-500 animate-pulse', badge: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 border-emerald-500/30' },
  Planned:  { dot: 'bg-blue-500',                  badge: 'text-blue-600 dark:text-blue-400 bg-blue-500/20 border-blue-500/30' },
  Complete: { dot: 'bg-slate-400 dark:bg-zinc-500', badge: 'text-slate-500 dark:text-zinc-400 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/15' },
  Archived: { dot: 'bg-slate-300 dark:bg-zinc-600', badge: 'text-slate-400 dark:text-zinc-500 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10' },
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: 'text-red-600 dark:text-red-400 bg-red-500/20 border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.08)]',
  High: 'text-orange-600 dark:text-orange-400 bg-orange-500/20 border border-orange-500/30',
  Medium: 'text-amber-600 dark:text-amber-400 bg-amber-500/20 border border-amber-500/20',
};

export default function HuntsPage() {
  const active = HUNTS.filter((h) => h.status === 'Active').length;
  const complete = HUNTS.filter((h) => h.status === 'Complete').length;
  const totalFindings = HUNTS.reduce((s, h) => s + h.findings, 0);
  const totalFed = HUNTS.reduce((s, h) => s + h.detectionsFed, 0);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Threat Hunt Missions" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active hunts', value: String(active), color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Completed', value: String(complete), color: 'text-slate-900 dark:text-white' },
            { label: 'Total findings', value: String(totalFindings), color: 'text-red-500 dark:text-red-400' },
            { label: 'Detections created', value: String(totalFed), color: 'text-blue-600 dark:text-blue-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 shadow-sm dark:shadow-lg">
              <p className="text-xs text-slate-400 dark:text-zinc-500">{s.label}</p>
              <p className={cn('mt-1 text-2xl font-bold', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Hunt Missions</h2>
          <button type="button" className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm shadow-blue-500/20">
            <Plus className="h-3.5 w-3.5" /> New Hunt Mission
          </button>
        </div>

        <div className="space-y-3">
          {HUNTS.map((hunt) => {
            const cfg = STATUS_CONFIG[hunt.status];
            return (
              <div key={hunt.id} className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg hover:bg-white/90 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all cursor-pointer group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={cn('mt-1.5 flex h-2 w-2 shrink-0 rounded-full', cfg.dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">{hunt.title}</p>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">{hunt.id}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed line-clamp-2">{hunt.hypothesis}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 dark:text-zinc-600 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="mt-4 flex items-center gap-2.5 flex-wrap">
                  <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border', cfg.badge)}>
                    {hunt.status}
                  </span>
                  <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-bold', PRIORITY_COLORS[hunt.priority])}>
                    {hunt.priority}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500">
                    <Target className="h-3 w-3" /> {hunt.techniques.join(', ')}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">{hunt.tactic}</span>
                  <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500">
                    <Clock className="h-3 w-3" />
                    {hunt.endDate ? `${hunt.startDate} → ${hunt.endDate}` : `Started ${hunt.startDate}`}
                  </span>
                </div>

                {(hunt.findings > 0 || hunt.detectionsFed > 0) && (
                  <div className="mt-3 flex items-center gap-4 border-t border-black/10 dark:border-white/10 pt-3">
                    {hunt.findings > 0 && (
                      <span className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        {hunt.findings} finding{hunt.findings > 1 ? 's' : ''}
                      </span>
                    )}
                    {hunt.detectionsFed > 0 && (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <FileText className="h-3 w-3" />
                        {hunt.detectionsFed} detection{hunt.detectionsFed > 1 ? 's' : ''} created
                      </span>
                    )}
                    <span className="ml-auto text-xs text-slate-400 dark:text-zinc-500">Analyst: {hunt.analyst}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
