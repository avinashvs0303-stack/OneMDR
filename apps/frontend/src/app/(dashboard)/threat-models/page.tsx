'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ShieldAlert,
  Server,
  Cloud,
  Building2,
  AlertTriangle,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import {
  listModels,
  createModel,
  deleteModel,
  type ThreatModelSummary,
  type Environment,
} from '@/lib/threat-models.api';

const ENV_LABELS: Record<Environment, { label: string; icon: React.ReactNode; color: string }> = {
  CLOUD: {
    label: 'Cloud',
    icon: <Cloud className="w-3.5 h-3.5" />,
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  ONPREM: {
    label: 'On-Prem',
    icon: <Building2 className="w-3.5 h-3.5" />,
    color: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  },
  HYBRID: {
    label: 'Hybrid',
    icon: <Server className="w-3.5 h-3.5" />,
    color: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
  REVIEW: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  APPROVED: 'text-green-400 bg-green-400/10 border-green-400/20',
  ARCHIVED: 'text-zinc-600 bg-zinc-600/10 border-zinc-600/20',
};

function riskColor(score: number) {
  if (score >= 15) return 'text-red-400';
  if (score >= 10) return 'text-orange-400';
  if (score >= 5) return 'text-yellow-400';
  return 'text-green-400';
}

export default function ThreatModelsPage() {
  const router = useRouter();
  const [models, setModels] = useState<ThreatModelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    environment: 'HYBRID' as Environment,
  });

  useEffect(() => {
    listModels()
      .then(setModels)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const m = await createModel({
        name: form.name,
        description: form.description,
        environment: form.environment,
      });
      setModels((p) => [m, ...p]);
      setShowCreate(false);
      setForm({ name: '', description: '', environment: 'HYBRID' });
      router.push(`/threat-models/${m.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteModel(id);
      setModels((p) => p.filter((m) => m.id !== id));
      setDeleteConfirm(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Threat Modelling</h1>
            <p className="text-sm text-zinc-400">
              STRIDE-based threat analysis for cloud, on-prem and hybrid
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Model
        </button>
      </div>

      {/* Stats bar */}
      {models.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Models', value: models.length, color: 'text-white' },
            {
              label: 'Draft',
              value: models.filter((m) => m.status === 'DRAFT').length,
              color: 'text-zinc-400',
            },
            {
              label: 'In Review',
              value: models.filter((m) => m.status === 'REVIEW').length,
              color: 'text-yellow-400',
            },
            {
              label: 'Approved',
              value: models.filter((m) => m.status === 'APPROVED').length,
              color: 'text-green-400',
            },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Model grid */}
      {loading ? (
        <div className="text-center py-20 text-zinc-500">Loading models…</div>
      ) : models.length === 0 ? (
        <div className="text-center py-20">
          <ShieldAlert className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">No threat models yet</p>
          <p className="text-sm text-zinc-600 mt-1">
            Create your first model to start your STRIDE analysis
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
          >
            New Threat Model
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {models.map((m) => {
            const env = ENV_LABELS[m.environment];
            return (
              <div
                key={m.id}
                className="group bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all cursor-pointer relative"
                onClick={() => router.push(`/threat-models/${m.id}`)}
              >
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(m.id);
                  }}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-start justify-between mb-3 pr-8">
                  <h3 className="font-medium text-white leading-tight">{m.name}</h3>
                </div>

                {m.description && (
                  <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{m.description}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${env.color}`}
                  >
                    {env.icon}
                    {env.label}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded border text-xs font-medium ${STATUS_COLORS[m.status] ?? STATUS_COLORS.DRAFT}`}
                  >
                    {m.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex gap-3">
                    <span>{m._count.components} components</span>
                    <span>{m._count.dataFlows} flows</span>
                    <span className={riskColor(0)}>{m._count.threats} threats</span>
                  </div>
                  <ChevronRight className="w-4 h-4 group-hover:text-zinc-300 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-4">New Threat Model</h2>

            <label className="block text-xs text-zinc-400 mb-1">Model Name *</label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Customer API — Production"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 mb-3 focus:outline-none focus:border-red-500"
            />

            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Scope, system overview…"
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 mb-3 focus:outline-none focus:border-red-500 resize-none"
            />

            <label className="block text-xs text-zinc-400 mb-1">Environment</label>
            <div className="flex gap-2 mb-5">
              {(['CLOUD', 'ONPREM', 'HYBRID'] as Environment[]).map((env) => {
                const e = ENV_LABELS[env];
                return (
                  <button
                    key={env}
                    onClick={() => setForm((p) => ({ ...p, environment: env }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${form.environment === env ? `${e.color} border-current` : 'text-zinc-500 bg-zinc-800 border-zinc-700 hover:border-zinc-600'}`}
                  >
                    {e.icon}
                    {e.label}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 text-sm text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={creating || !form.name.trim()}
                className="flex-1 py-2 text-sm text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg transition-colors"
              >
                {creating ? 'Creating…' : 'Create Model'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <h2 className="font-semibold text-white">Delete Threat Model?</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-5">
              All components, flows, and threats will be permanently deleted.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 text-sm text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete(deleteConfirm)}
                className="flex-1 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
