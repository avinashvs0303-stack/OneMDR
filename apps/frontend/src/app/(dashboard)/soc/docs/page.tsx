'use client';

import { Header } from '@/components/layout/header';
import {
  Shield,
  AlertTriangle,
  Search,
  Clock,
  ChevronRight,
  Link2,
  FileText,
  Users,
  Phone,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Types / data ──────────────────────────────────────────────────────────────

const SOPS = [
  {
    id: 'sop-001',
    title: 'Incident Response Procedure',
    desc: 'End-to-end process from detection to post-incident review. Covers triage, containment, eradication, recovery, and lessons learned.',
    icon: AlertTriangle,
    iconClass:
      'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/25',
    steps: [
      'Receive alert & assess severity',
      'Assign incident commander (P1/P2)',
      'Isolate affected systems',
      'Collect forensic artifacts',
      'Notify stakeholders per escalation policy',
      'Eradicate threat & restore services',
      'Conduct post-incident review within 48h',
    ],
    updated: '2026-06-15',
    tags: ['P1', 'P2', 'Mandatory'],
  },
  {
    id: 'sop-002',
    title: 'Escalation & On-Call Runbook',
    desc: 'When and how to escalate — P1/P2 paging thresholds, who to call, and what information to provide during handoff.',
    icon: Phone,
    iconClass:
      'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25',
    steps: [
      'Determine severity using classification matrix',
      'P1: Page primary on-call immediately',
      'P2: Page within 15 min if unacknowledged',
      'Provide: affected systems, initial indicators, data source, timeline',
      'Escalate to SOC Manager after 20 min if no response',
      'Update incident ticket after each escalation',
    ],
    updated: '2026-06-10',
    tags: ['On-Call', 'Escalation'],
  },
  {
    id: 'sop-003',
    title: 'Evidence Collection & Chain of Custody',
    desc: 'Procedures for collecting, preserving, and documenting digital evidence in a manner admissible for legal proceedings.',
    icon: Search,
    iconClass:
      'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/25',
    steps: [
      'Document all actions before collecting evidence',
      'Create forensic disk image (if applicable)',
      'Capture volatile data: memory, running processes, network connections',
      'Export relevant logs to immutable storage',
      'Complete chain of custody form (SOC-CoC-001)',
      'Store evidence with SHA-256 hash verification',
    ],
    updated: '2026-05-22',
    tags: ['Forensics', 'Legal'],
  },
  {
    id: 'sop-004',
    title: 'Threat Hunt Mission Workflow',
    desc: 'How to initiate, execute, and close out a threat hunting mission — from hypothesis formulation to playbook selection and IOC documentation.',
    icon: Shield,
    iconClass:
      'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/25',
    steps: [
      'Define hypothesis based on threat intelligence or anomaly',
      'Select relevant playbook from THaaS library',
      'Execute SPL queries across target time window',
      'Document findings as evidence items',
      'Record IOCs in IOC Tracker',
      'Update mission status and write hunt summary',
    ],
    updated: '2026-06-20',
    tags: ['THaaS', 'Hunting'],
  },
  {
    id: 'sop-005',
    title: 'Detection Deployment Checklist',
    desc: 'Quality gate before deploying a new detection rule to production SIEM — coverage validation, false positive testing, and stakeholder sign-off.',
    icon: FileText,
    iconClass:
      'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25',
    steps: [
      'Validate MITRE ATT&CK mapping',
      'Run against 30-day historical data for false-positive rate',
      'Peer review SPL logic',
      'Tag detection with correct severity and data sources',
      'Deploy to staging integration first',
      'Monitor for 48h before promoting to PROD',
    ],
    updated: '2026-06-18',
    tags: ['Detections', 'DaaS'],
  },
  {
    id: 'sop-006',
    title: 'Third-Party Breach Notification',
    desc: 'Steps for notifying affected customers and regulators when a data breach involves tenant or customer data.',
    icon: Users,
    iconClass:
      'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25',
    steps: [
      'Confirm breach scope and data types',
      'Legal review within 1h of P1 confirmation',
      'Notify CISO and DPO within 2h',
      'Prepare regulatory notification (72h GDPR deadline)',
      'Draft customer communication with privacy team',
      'Publish post-mortem after resolution',
    ],
    updated: '2026-04-30',
    tags: ['Legal', 'GDPR', 'P1'],
  },
];

const QUICK_LINKS = [
  {
    label: 'MITRE ATT&CK Framework',
    href: '/coverage',
    internal: true,
    desc: 'View your coverage map',
  },
  {
    label: 'Detection Library',
    href: '/detections',
    internal: true,
    desc: 'Browse all detection rules',
  },
  { label: 'THaaS Playbooks', href: '/thaas/playbooks', internal: true, desc: 'Hunt playbooks' },
  { label: 'Hunt Missions', href: '/thaas/missions', internal: true, desc: 'Active & past hunts' },
  {
    label: 'IOC Tracker',
    href: '/thaas/iocs',
    internal: true,
    desc: 'Known indicators of compromise',
  },
  { label: 'Integrations', href: '/integrations', internal: true, desc: 'SIEM connections' },
];

const CONTACTS = [
  {
    role: 'Primary On-Call',
    name: 'Avinash VS',
    contact: 'Phone · SMS',
    initials: 'AV',
    color: 'bg-amber-600',
  },
  {
    role: 'Secondary On-Call',
    name: 'SOC Analyst 2',
    contact: 'SMS · Email',
    initials: 'S2',
    color: 'bg-violet-600',
  },
  {
    role: 'SOC Manager',
    name: 'SOC Manager',
    contact: 'Phone · Email',
    initials: 'SM',
    color: 'bg-emerald-600',
  },
  { role: 'CISO', name: 'CISO', contact: 'Phone (P1 only)', initials: 'CI', color: 'bg-blue-600' },
];

// ── Expandable SOP card ───────────────────────────────────────────────────────

function SopCard({ sop }: { sop: (typeof SOPS)[0] }) {
  const Icon = sop.icon;
  return (
    <details className="group rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg overflow-hidden">
      <summary className="flex cursor-pointer items-start gap-4 p-5 marker:content-none list-none">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
            sop.iconClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{sop.title}</p>
            <ChevronRight className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0 transition-transform group-open:rotate-90" />
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
            {sop.desc}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {sop.tags.map((t) => (
              <span
                key={t}
                className="rounded-md border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-zinc-300"
              >
                {t}
              </span>
            ))}
            <span className="ml-auto text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Updated{' '}
              {new Date(sop.updated).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </summary>
      <div className="border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 px-5 py-4">
        <p className="mb-3 text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
          Procedure Steps
        </p>
        <ol className="space-y-2">
          {sop.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600/10 dark:bg-amber-500/10 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25">
                {i + 1}
              </span>
              <span className="text-xs text-slate-700 dark:text-zinc-200 pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="SOC Documentation" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="grid grid-cols-12 gap-6">
            {/* SOPs — left/main */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <div>
                <h2 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3">
                  Standard Operating Procedures
                </h2>
                <div className="space-y-3">
                  {SOPS.map((sop) => (
                    <SopCard key={sop.id} sop={sop} />
                  ))}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="col-span-12 lg:col-span-4 space-y-5">
              {/* Quick links */}
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg space-y-3">
                <h2 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                  Quick Links
                </h2>
                <div className="space-y-1.5">
                  {QUICK_LINKS.map((l) => (
                    <Link
                      key={l.label}
                      href={l.href}
                      className="flex items-center gap-2.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 px-3.5 py-2.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors group"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                          {l.label}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">{l.desc}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-zinc-600 shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* SOC Contacts */}
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg space-y-3">
                <h2 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                  Escalation Contacts
                </h2>
                <div className="space-y-2.5">
                  {CONTACTS.map((c) => (
                    <div key={c.role} className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                          c.color,
                        )}
                      >
                        {c.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {c.name}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                          {c.role} · {c.contact}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/soc/oncall"
                  className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline mt-1"
                >
                  View On-Call schedule <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Severity reference */}
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg space-y-3">
                <h2 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                  Severity Reference
                </h2>
                <div className="space-y-2">
                  {[
                    {
                      sev: 'P1',
                      label: 'Critical',
                      desc: 'Active breach / ransomware / outage',
                      response: '15 min',
                      resolution: '1 hr',
                      cls: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',
                    },
                    {
                      sev: 'P2',
                      label: 'High',
                      desc: 'Confirmed intrusion / active movement',
                      response: '30 min',
                      resolution: '4 hr',
                      cls: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25',
                    },
                    {
                      sev: 'P3',
                      label: 'Medium',
                      desc: 'Suspicious activity / potential threat',
                      response: '2 hr',
                      resolution: '24 hr',
                      cls: 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/25',
                    },
                    {
                      sev: 'P4',
                      label: 'Low',
                      desc: 'False positive investigation / advisory',
                      response: '24 hr',
                      resolution: '72 hr',
                      cls: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25',
                    },
                  ].map(({ sev, label, desc, response, resolution, cls }) => (
                    <div key={sev} className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          'rounded-full border px-1.5 py-0.5 text-[10px] font-bold shrink-0 mt-0.5',
                          cls,
                        )}
                      >
                        {sev}
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
                          {label} — {desc}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                          Response: {response} · Resolution: {resolution}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
