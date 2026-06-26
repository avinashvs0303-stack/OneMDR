'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Pin,
  PinOff,
  Search,
  Tag,
  X,
  Save,
  FileText,
  Upload,
  ChevronRight,
} from 'lucide-react';
import { listDocuments, createDocument, updateDocument, deleteDocument } from '@/lib/soc.api';
import type { SocDocument } from '@/lib/soc.api';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  'General',
  'Incident Response',
  'Escalation',
  'Hunt Workflow',
  'Compliance',
  'Runbooks',
];

const CATEGORY_COLOR: Record<string, string> = {
  General: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  'Incident Response': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Escalation: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Hunt Workflow': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Compliance: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Runbooks: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

interface EditorState {
  title: string;
  content: string;
  category: string;
  tags: string[];
  tagInput: string;
}

const emptyEditor = (): EditorState => ({
  title: '',
  content: '',
  category: 'General',
  tags: [],
  tagInput: '',
});

export default function DocsPage() {
  const [docs, setDocs] = useState<SocDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<SocDocument | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await listDocuments(filterCat || undefined);
      setDocs(data);
    } catch {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filterCat]);

  const openNew = () => {
    setEditingId(null);
    setEditor(emptyEditor());
    setEditorOpen(true);
    setSelectedDoc(null);
  };
  const openEdit = (doc: SocDocument) => {
    setEditingId(doc.id);
    setEditor({
      title: doc.title,
      content: doc.content,
      category: doc.category,
      tags: [...doc.tags],
      tagInput: '',
    });
    setEditorOpen(true);
    setSelectedDoc(null);
  };

  const handleSave = async () => {
    if (!editor.title.trim() || !editor.content.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateDocument(editingId, {
          title: editor.title,
          content: editor.content,
          category: editor.category,
          tags: editor.tags,
        });
      } else {
        await createDocument({
          title: editor.title,
          content: editor.content,
          category: editor.category,
          tags: editor.tags,
        });
      }
      setEditorOpen(false);
      setEditingId(null);
      await load();
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (doc: SocDocument) => {
    try {
      await updateDocument(doc.id, { isPinned: !doc.isPinned });
      await load();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id);
      setDeleteConfirm(null);
      if (selectedDoc?.id === id) setSelectedDoc(null);
      await load();
    } catch {
      setError('Failed to delete');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setEditor((p) => ({
        ...p,
        title: p.title || file.name.replace(/\.[^.]+$/, ''),
        content: text,
      }));
    };
    reader.readAsText(file);
  };

  const addTag = () => {
    const t = editor.tagInput.trim();
    if (t && !editor.tags.includes(t))
      setEditor((p) => ({ ...p, tags: [...p.tags, t], tagInput: '' }));
    else setEditor((p) => ({ ...p, tagInput: '' }));
  };

  const filtered = docs.filter((d) => {
    const q = search.toLowerCase();
    return (
      !q ||
      d.title.toLowerCase().includes(q) ||
      d.content.toLowerCase().includes(q) ||
      d.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  // ── Editor view ─────────────────────────────────────────────────────────────
  if (editorOpen) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            {editingId ? 'Edit Document' : 'New Document'}
          </h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.log"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => {
                setEditorOpen(false);
                setEditingId(null);
              }}
              className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !editor.title.trim() || !editor.content.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
              Title *
            </label>
            <input
              value={editor.title}
              onChange={(e) => setEditor((p) => ({ ...p, title: e.target.value }))}
              placeholder="Document title"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                Category
              </label>
              <select
                value={editor.category}
                onChange={(e) => setEditor((p) => ({ ...p, category: e.target.value }))}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                Tags
              </label>
              <div className="flex gap-1">
                <input
                  value={editor.tagInput}
                  onChange={(e) => setEditor((p) => ({ ...p, tagInput: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Tag + Enter"
                  className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Add
                </button>
              </div>
              {editor.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {editor.tags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[11px] text-blue-700 dark:text-blue-300"
                    >
                      {t}{' '}
                      <button
                        type="button"
                        onClick={() =>
                          setEditor((p) => ({ ...p, tags: p.tags.filter((x) => x !== t) }))
                        }
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
              Content *
            </label>
            <textarea
              value={editor.content}
              onChange={(e) => setEditor((p) => ({ ...p, content: e.target.value }))}
              placeholder="Write your document content here…"
              rows={24}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Document detail view ─────────────────────────────────────────────────────
  if (selectedDoc) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedDoc(null)}
              className="rounded-lg border border-black/10 dark:border-white/10 p-1.5 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <ChevronRight className="h-4 w-4 rotate-180 text-slate-500" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                {selectedDoc.title}
              </h1>
              <p className="text-[11px] text-slate-400">
                {selectedDoc.category} · Updated{' '}
                {new Date(selectedDoc.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleTogglePin(selectedDoc)}
              className="rounded-lg border border-black/10 dark:border-white/10 p-1.5 hover:bg-black/5 dark:hover:bg-white/5"
            >
              {selectedDoc.isPinned ? (
                <PinOff className="h-4 w-4 text-blue-500" />
              ) : (
                <Pin className="h-4 w-4 text-slate-500" />
              )}
            </button>
            <button
              type="button"
              onClick={() => openEdit(selectedDoc)}
              className="flex items-center gap-1.5 rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirm(selectedDoc.id)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {selectedDoc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {selectedDoc.tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300"
                >
                  <Tag className="h-2.5 w-2.5" /> {t}
                </span>
              ))}
            </div>
          )}
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
            {selectedDoc.content}
          </pre>
        </div>
        {deleteConfirm && (
          <DeleteModal
            onCancel={() => setDeleteConfirm(null)}
            onConfirm={() => void handleDelete(deleteConfirm)}
          />
        )}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  const pinned = filtered.filter((d) => d.isPinned);
  const unpinned = filtered.filter((d) => !d.isPinned);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">SOC Documentation</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            {docs.length} documents · Knowledge base
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Document
        </button>
      </div>

      <div className="flex items-center gap-3 border-b border-black/10 dark:border-white/10 px-6 py-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {['', ...CATEGORIES].map((c) => (
            <button
              key={c || 'all'}
              type="button"
              onClick={() => setFilterCat(c)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors',
                filterCat === c
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-black/10 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5',
              )}
            >
              {c || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText className="h-12 w-12 text-slate-300 dark:text-zinc-600" />
            <p className="text-sm text-slate-500 dark:text-zinc-400">No documents found</p>
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Create your first document
            </button>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <section>
                <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
                  Pinned
                </h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {pinned.map((doc) => (
                    <DocCard
                      key={doc.id}
                      doc={doc}
                      onOpen={setSelectedDoc}
                      onEdit={openEdit}
                      onPin={() => void handleTogglePin(doc)}
                      onDelete={() => setDeleteConfirm(doc.id)}
                    />
                  ))}
                </div>
              </section>
            )}
            {unpinned.length > 0 && (
              <section>
                {pinned.length > 0 && (
                  <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
                    All Documents
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {unpinned.map((doc) => (
                    <DocCard
                      key={doc.id}
                      doc={doc}
                      onOpen={setSelectedDoc}
                      onEdit={openEdit}
                      onPin={() => void handleTogglePin(doc)}
                      onDelete={() => setDeleteConfirm(doc.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {deleteConfirm && (
        <DeleteModal
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => void handleDelete(deleteConfirm)}
        />
      )}
    </div>
  );
}

function DocCard({
  doc,
  onOpen,
  onEdit,
  onPin,
  onDelete,
}: {
  doc: SocDocument;
  onOpen: (d: SocDocument) => void;
  onEdit: (d: SocDocument) => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={() => onOpen(doc)} className="text-left flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
              {doc.title}
            </h3>
          </button>
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={onPin}
              className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/5"
            >
              {doc.isPinned ? (
                <PinOff className="h-3.5 w-3.5 text-blue-500" />
              ) : (
                <Pin className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onEdit(doc)}
              className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Edit2 className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium',
              CATEGORY_COLOR[doc.category] ?? CATEGORY_COLOR['General'],
            )}
          >
            {doc.category}
          </span>
          <span className="text-[10px] text-slate-400">
            {new Date(doc.updatedAt).toLocaleDateString()}
          </span>
        </div>
        {doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {doc.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400"
              >
                {t}
              </span>
            ))}
            {doc.tags.length > 3 && (
              <span className="text-[10px] text-slate-400">+{doc.tags.length - 3}</span>
            )}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-400 dark:text-zinc-500 line-clamp-2">
          {doc.content.slice(0, 120)}
        </p>
      </div>
    </div>
  );
}

function DeleteModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 p-6 w-80 shadow-xl">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Delete document?</h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
