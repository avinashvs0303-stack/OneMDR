'use client';

import { Header } from '@/components/layout/header';
import { LayoutGrid, Plus, Search, Filter, Star, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const BOARDS = [
  { id: '1', name: 'Product Roadmap', description: 'Track features, milestones, and releases', color: 'bg-indigo-500', items: 34, members: 5, updatedAt: '2h ago', starred: true },
  { id: '2', name: 'Sprint Planning', description: 'Current sprint backlog and task assignments', color: 'bg-emerald-500', items: 18, members: 4, updatedAt: '5h ago', starred: true },
  { id: '3', name: 'Bug Tracker', description: 'Issues, bugs, and engineering fixes', color: 'bg-rose-500', items: 22, members: 6, updatedAt: 'Yesterday', starred: false },
  { id: '4', name: 'Marketing Q3', description: 'Campaigns, content calendar, launches', color: 'bg-amber-500', items: 10, members: 3, updatedAt: '2d ago', starred: false },
  { id: '5', name: 'Onboarding Flows', description: 'Customer success and activation steps', color: 'bg-violet-500', items: 15, members: 2, updatedAt: '3d ago', starred: false },
  { id: '6', name: 'Design System', description: 'Components, tokens, and guidelines', color: 'bg-pink-500', items: 8, members: 3, updatedAt: '1w ago', starred: false },
];

export default function BoardsPage() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Boards" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 flex-1 max-w-xs">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input placeholder="Search boards…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors">
              <Filter className="h-3.5 w-3.5" /> Filter
            </button>
            <button type="button" className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
              <Plus className="h-3.5 w-3.5" /> New board
            </button>
          </div>
        </div>

        {/* Starred */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> Starred
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {BOARDS.filter(b => b.starred).map(board => <BoardCard key={board.id} board={board} />)}
          </div>
        </section>

        {/* All boards */}
        <section className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">All boards</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {BOARDS.map(board => <BoardCard key={board.id} board={board} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

function BoardCard({ board }: { board: typeof BOARDS[0] }) {
  return (
    <div className="group cursor-pointer rounded-xl border border-border bg-background p-5 shadow-sm hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-700 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5 h-9 w-9 shrink-0 rounded-lg', board.color)} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {board.name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{board.description}</p>
          </div>
        </div>
        <Star className={cn('h-4 w-4 shrink-0 transition-colors', board.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30 group-hover:text-muted-foreground')} />
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> {board.items} items</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {board.members}</span>
        <span className="flex items-center gap-1 ml-auto"><Clock className="h-3 w-3" /> {board.updatedAt}</span>
      </div>
    </div>
  );
}
