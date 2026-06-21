'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Fingerprint, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { huntsApi, IOC_TYPE_LABELS, type HuntIOC, type HuntIOCType } from '@/lib/hunts.api';

const IOC_TYPES: HuntIOCType[] = [
  'IP',
  'DOMAIN',
  'HASH_MD5',
  'HASH_SHA1',
  'HASH_SHA256',
  'URL',
  'EMAIL',
  'REGISTRY_KEY',
  'FILE_PATH',
  'OTHER',
];

const CONF_COLORS: Record<string, string> = {
  HIGH: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20',
  MEDIUM: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
  LOW: 'text-slate-500 dark:text-zinc-400 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10',
};

export default function IOCTrackerPage() {
  const [iocs, setIocs] = useState<HuntIOC[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<HuntIOCType | ''>('');

  const reload = async () => {
    setLoading(true);
    try {
      const data = await huntsApi.listIOCs(filterType || undefined);
      setIocs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [filterType]);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="IOC Tracker" />

      <div className="flex items-center gap-3 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 backdrop-blur-md px-6 py-3 shrink-0">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as HuntIOCType | '')}
          className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none"
        >
          <option value="">All Types</option>
          {IOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {IOC_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400 dark:text-zinc-500">
          {loading ? '—' : `${iocs.length} indicator${iocs.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      <main className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : iocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Fingerprint className="h-8 w-8 text-slate-300 dark:text-zinc-600" />
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              No IOCs tracked yet
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              Add indicators from within a Hunt Mission&apos;s IOC tab.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {iocs.map((ioc) => (
              <div
                key={ioc.id}
                className="flex items-center gap-4 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3"
              >
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide w-24 shrink-0">
                  {IOC_TYPE_LABELS[ioc.type]}
                </span>
                <span className="font-mono text-xs text-slate-900 dark:text-white break-all flex-1">
                  {ioc.value}
                </span>
                <span
                  className={cn(
                    'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0',
                    CONF_COLORS[ioc.confidence] ?? '',
                  )}
                >
                  {ioc.confidence}
                </span>
                {ioc.mission && (
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">
                    {ioc.mission.missionRef}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
