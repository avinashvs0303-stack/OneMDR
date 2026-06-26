'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Send,
  Hash,
  Bell,
  AlertCircle,
  Shield,
  Lock,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import {
  listChannels,
  createChannel,
  getMessages,
  sendMessage,
  deleteMessage,
} from '@/lib/soc.api';
import type { SocChannel, SocMessage } from '@/lib/soc.api';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  hash: Hash,
  bell: Bell,
  'alert-circle': AlertCircle,
  shield: Shield,
};

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  MEMBER: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  ANALYST: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-green-500',
    'bg-amber-500',
    'bg-red-500',
    'bg-teal-500',
    'bg-pink-500',
  ];
  return colors[Math.abs(hash) % colors.length];
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

function groupMessages(msgs: SocMessage[]): Array<{ date: string; messages: SocMessage[] }> {
  const groups: Record<string, SocMessage[]> = {};
  for (const m of msgs) {
    const date = new Date(m.createdAt).toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(m);
  }
  return Object.entries(groups).map(([date, messages]) => ({ date, messages }));
}

export default function CollabPage() {
  const [channels, setChannels] = useState<SocChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<SocChannel | null>(null);
  const [messages, setMessages] = useState<SocMessage[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChName, setNewChName] = useState('');
  const [newChDesc, setNewChDesc] = useState('');
  const [creatingCh, setCreatingCh] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChannels = async () => {
    try {
      const chs = await listChannels();
      setChannels(chs);
      if (!activeChannel && chs.length > 0) setActiveChannel(chs[0]);
    } catch {
      setError('Failed to load channels');
    } finally {
      setLoadingChannels(false);
    }
  };

  const loadMessages = useCallback(async (channelId: string) => {
    try {
      const msgs = await getMessages(channelId);
      setMessages(msgs);
    } catch {
      /* silent on poll errors */
    }
  }, []);

  useEffect(() => {
    void loadChannels();
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    const id = activeChannel.id;
    setLoadingMsgs(true);
    void loadMessages(id).then(() => setLoadingMsgs(false));

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      void loadMessages(id);
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeChannel?.id, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || !activeChannel || sending) return;
    const content = draft.trim();
    setDraft('');
    setSending(true);
    try {
      await sendMessage(activeChannel.id, content);
      await loadMessages(activeChannel.id);
    } catch {
      setError('Failed to send message');
      setDraft(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleDelete = async (channelId: string, messageId: string) => {
    try {
      await deleteMessage(channelId, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      setError('Failed to delete message');
    }
  };

  const handleCreateChannel = async () => {
    if (!newChName.trim()) return;
    setCreatingCh(true);
    try {
      await createChannel({ name: newChName, description: newChDesc });
      setNewChannelOpen(false);
      setNewChName('');
      setNewChDesc('');
      await loadChannels();
    } catch {
      setError('Failed to create channel');
    } finally {
      setCreatingCh(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const grouped = groupMessages(messages);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r border-black/10 dark:border-white/10 flex flex-col bg-slate-50/50 dark:bg-zinc-900/50">
        <div className="px-3 py-3 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Channels
            </span>
            <button
              type="button"
              onClick={() => setNewChannelOpen(true)}
              className="rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            >
              <Plus className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
          {loadingChannels ? (
            <div className="text-[11px] text-slate-400 px-2 py-4">Loading…</div>
          ) : channels.length === 0 ? (
            <div className="text-[11px] text-slate-400 px-2 py-4">No channels yet</div>
          ) : (
            channels.map((ch) => {
              const Icon = ICON_MAP[ch.icon] ?? Hash;
              const active = activeChannel?.id === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveChannel(ch)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                    active
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 font-semibold'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5',
                  )}
                >
                  {ch.isPrivate ? (
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{ch.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeChannel ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <MessageSquare className="h-12 w-12 text-slate-300 dark:text-zinc-600" />
            <p className="text-sm text-slate-400">Select a channel to start chatting</p>
          </div>
        ) : (
          <>
            {/* Channel header */}
            <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 px-4 py-3 shrink-0">
              {(() => {
                const Icon = ICON_MAP[activeChannel.icon] ?? Hash;
                return <Icon className="h-4 w-4 text-slate-500" />;
              })()}
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {activeChannel.name}
              </h2>
              {activeChannel.description && (
                <span className="text-[11px] text-slate-400 dark:text-zinc-500 border-l border-black/10 dark:border-white/10 pl-2">
                  {activeChannel.description}
                </span>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {loadingMsgs && messages.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                  Loading messages…
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <Hash className="h-8 w-8 text-slate-300 dark:text-zinc-600" />
                  <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
                    Welcome to #{activeChannel.name}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">
                    Send the first message!
                  </p>
                </div>
              ) : (
                grouped.map(({ date, messages: grpMsgs }) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-black/5 dark:bg-white/10" />
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 px-2">
                        {new Date(date).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <div className="flex-1 h-px bg-black/5 dark:bg-white/10" />
                    </div>
                    {grpMsgs.map((msg, i) => {
                      const prevMsg = grpMsgs[i - 1];
                      const sameAuthor =
                        prevMsg?.authorId === msg.authorId &&
                        new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() <
                          5 * 60 * 1000;
                      const initials = msg.authorName.slice(0, 2).toUpperCase();
                      const avatarColor = getAvatarColor(msg.authorId);
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'group flex items-start gap-2.5 hover:bg-black/2 dark:hover:bg-white/2 rounded-lg px-2 py-0.5',
                            sameAuthor ? 'mt-0.5' : 'mt-2',
                          )}
                          onMouseEnter={() => setHoveredMsg(msg.id)}
                          onMouseLeave={() => setHoveredMsg(null)}
                        >
                          <div className="w-7 shrink-0 flex justify-center mt-0.5">
                            {!sameAuthor ? (
                              <div
                                className={cn(
                                  'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white',
                                  avatarColor,
                                )}
                              >
                                {initials}
                              </div>
                            ) : (
                              <span
                                className={cn(
                                  'text-[9px] text-slate-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 self-center',
                                  hoveredMsg === msg.id && 'opacity-100',
                                )}
                              >
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {!sameAuthor && (
                              <div className="flex items-baseline gap-1.5 mb-0.5">
                                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                  {msg.authorName}
                                </span>
                                <span
                                  className={cn(
                                    'rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                                    ROLE_BADGE[msg.authorRole] ?? ROLE_BADGE['MEMBER'],
                                  )}
                                >
                                  {msg.authorRole}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                                  {fmtTime(msg.createdAt)}
                                </span>
                              </div>
                            )}
                            <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                          {hoveredMsg === msg.id && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(activeChannel.id, msg.id)}
                              className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 transition-opacity"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-black/10 dark:border-white/10 px-4 py-3 shrink-0">
              {error && <div className="mb-2 text-xs text-red-500">{error}</div>}
              <div className="flex items-end gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${activeChannel.name}`}
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none min-h-[24px] max-h-32"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!draft.trim() || sending}
                  className="shrink-0 rounded-lg bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-600 mt-1">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        )}
      </div>

      {/* New channel modal */}
      {newChannelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 p-6 w-80 shadow-xl">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">New Channel</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  Channel Name *
                </label>
                <input
                  value={newChName}
                  onChange={(e) => setNewChName(e.target.value)}
                  placeholder="e.g. threat-intel"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  Description
                </label>
                <input
                  value={newChDesc}
                  onChange={(e) => setNewChDesc(e.target.value)}
                  placeholder="What's this channel for?"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setNewChannelOpen(false)}
                className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateChannel()}
                disabled={creatingCh || !newChName.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creatingCh ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
