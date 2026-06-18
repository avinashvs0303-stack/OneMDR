'use client';

import { Header } from '@/components/layout/header';
import { FileText, Download, AlertTriangle, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const REPORTS = [
  {
    id: 'RPT-0006',
    title: 'Detection Brief — Week of 9 Jun 2026',
    period: '9 Jun – 13 Jun 2026',
    added: 2,
    retired: 0,
    updated: 3,
    avgFpDelta: -1.2,
    coverageDelta: +0.8,
    highlights: [
      'DET-0011 (Registry Run Key) deployed to Splunk — FP rate 9%, within SLA',
      'DET-0003 (Azure AD new country) KQL updated to include RiskLevelAggregated field',
      'Kerberoasting hunt (HNT-0006) initiated — 2 findings in progress',
      'Chronicle sync degraded — reconnection in progress',
    ],
    ttpTrends: [
      'Kerberoasting activity elevated vs sector baseline',
      'Increased DNS-over-HTTPS C2 observed in telemetry',
    ],
  },
  {
    id: 'RPT-0005',
    title: 'Detection Brief — Week of 2 Jun 2026',
    period: '2 Jun – 6 Jun 2026',
    added: 1,
    retired: 0,
    updated: 2,
    avgFpDelta: -0.5,
    coverageDelta: +0.4,
    highlights: [
      'DET-0012 (Direct-IP HTTPS C2) drafted in Chronicle YARA-L — validation pending',
      'DET-0001 (PowerShell Encoded) base64 decode logic improved — FP rate reduced from 15% to 12%',
      'LOLBin hunt (HNT-0005) completed — 1 finding, 2 new detections fed to library',
    ],
    ttpTrends: [
      'LOLBin abuse (certutil, mshta) elevated in threat intel feeds',
      'Supply chain TTP signals emerging in FS-ISAC',
    ],
  },
  {
    id: 'RPT-0004',
    title: 'Detection Brief — Week of 26 May 2026',
    period: '26 May – 30 May 2026',
    added: 0,
    retired: 1,
    updated: 4,
    avgFpDelta: +0.3,
    coverageDelta: 0,
    highlights: [
      'DET-0009 (Scheduled Task EQL) moved to Testing — FP rate elevated, tuning in progress',
      'Ransomware pre-deployment hunt (HNT-0004) completed — no live findings in environment',
      'Elastic integration upgraded to v8.13 — all rules revalidated',
    ],
    ttpTrends: [
      'Ransomware groups pivoting to cloud backup deletion before encryption',
      'BEC campaign via OAuth phishing observed in sector',
    ],
  },
  {
    id: 'RPT-0003',
    title: 'Monthly Coverage Review — May 2026',
    period: 'May 2026',
    added: 3,
    retired: 1,
    updated: 7,
    avgFpDelta: -2.8,
    coverageDelta: +2.1,
    highlights: [
      'ATT&CK coverage improved from 61% → 63.2% (+2.1%) for the month',
      'Average FP rate improved from 10.8% to 8.0% across active detections',
      'Microsoft Sentinel integration added — 3 KQL detections deployed',
      'MTTD improved from 2.4h to 1.9h average across all active rules',
    ],
    ttpTrends: [
      'Identity-based attacks dominate threat landscape — prioritise Credential Access coverage',
      'Cloud-native attacks growing: initial access via OAuth, persistence via app grants',
    ],
  },
];

export default function ReportsPage() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Executive Bulletins" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <div className="rounded-xl border border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 backdrop-blur-md p-5">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Weekly Detection Briefs
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Every week, your OneMDR detection engineers publish a brief covering new detections
                deployed, rules retired, performance improvements, and TTP trends relevant to your
                sector. Monthly reports include full ATT&CK coverage deltas and MTTD benchmarks.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {REPORTS.map((report) => (
            <div
              key={report.id}
              className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg overflow-hidden hover:border-black/20 dark:hover:border-white/20 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {report.title}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                      <Calendar className="h-3 w-3" /> {report.period}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Download className="h-3 w-3" /> PDF
                  </button>
                  <ChevronRight className="h-4 w-4 text-slate-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div className="flex items-center gap-8">
                  <Metric
                    label="Added"
                    value={`+${report.added}`}
                    color={
                      report.added > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 dark:text-zinc-500'
                    }
                  />
                  <Metric
                    label="Retired"
                    value={report.retired > 0 ? `-${report.retired}` : '0'}
                    color={
                      report.retired > 0
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-slate-400 dark:text-zinc-500'
                    }
                  />
                  <Metric
                    label="Updated"
                    value={String(report.updated)}
                    color="text-blue-600 dark:text-blue-400"
                  />
                  <Metric
                    label="FP Δ"
                    value={`${report.avgFpDelta > 0 ? '+' : ''}${report.avgFpDelta}%`}
                    color={
                      report.avgFpDelta <= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-500 dark:text-red-400'
                    }
                  />
                  <Metric
                    label="Coverage Δ"
                    value={`${report.coverageDelta > 0 ? '+' : ''}${report.coverageDelta}%`}
                    color={
                      report.coverageDelta >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-500 dark:text-red-400'
                    }
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500 mb-2">
                    Highlights
                  </p>
                  <ul className="space-y-1">
                    {report.highlights.map((h, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-slate-500 dark:text-zinc-400"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300 dark:bg-zinc-600" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-500/20 px-4 py-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                    TTP Trends This Period
                  </p>
                  {report.ttpTrends.map((t, i) => (
                    <p
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-zinc-400"
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      {t}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className={cn('text-base font-bold', color)}>{value}</p>
      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{label}</p>
    </div>
  );
}
