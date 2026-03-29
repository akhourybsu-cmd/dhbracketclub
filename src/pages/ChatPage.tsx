import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash, Send, Plus, ChevronLeft, Pin, MessageSquare, Reply,
  X, SmilePlus, Trash2, Pencil, Search, Check
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { toast } from 'sonner';

/* ═══ TYPES ═══ */
type Channel = {
  id: string; name: string; description: string | null; icon: string | null;
  category_id: string | null; position: number; is_default: boolean;
};
type Category = { id: string; name: string; position: number };
type Message = {
  id: string; channel_id: string; user_id: string; content: string;
  parent_message_id: string | null; is_pinned: boolean;
  created_at: string; edited_at: string | null;
  profiles?: { display_name: string; avatar_url: string | null };
  reply_count?: number;
  reactions?: { emoji: string; count: number; user_reacted: boolean }[];
};
type ChannelMeta = { lastMessage?: string; lastMessageAt?: string; lastAuthor?: string; unread: boolean };

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '💀', '👀', '🎯', '💯'];

const CHANNEL_EMOJI: Record<string, string> = {
  general: '💬', announcements: '📢', sports: '🏀', 'movies-tv': '🎬',
  food: '🍕', random: '🎲', trips: '✈️', fantasy: '🏆',
};

/* ═══ AVATAR COMPONENT ═══ */
function UserAvatar({ userId, name, size = 28 }: { userId: string; name: string; size?: number }) {
  const hue1 = (userId.charCodeAt(0) * 7 + userId.charCodeAt(4) * 13) % 360;
  const hue2 = (hue1 + 40) % 360;
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.4,
        background: `linear-gradient(135deg, hsl(${hue1} 55% 48%), hsl(${hue2} 45% 38%))`,
      }}
    >
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

/* ═══ MAIN COMPONENT ═══ */
export default function ChatPage() {
  const { user } = useAuth();
  const { play } = useSoundEffect();

  // Channel state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [channelMeta, setChannelMeta] = useState<Map<string, ChannelMeta>>(new Map());
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showChannelList, setShowChannelList] = useState(true);

  // Message state
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Thread state
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadReply, setThreadReply] = useState('');

  // Pinned view
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);

  // Reaction picker
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);

  // Edit message
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // New channel
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);

  /* ═══ FETCH CHANNELS + META ═══ */
  const fetchChannels = useCallback(async () => {
    if (!user) return;
    const [{ data: cats }, { data: chs }] = await Promise.all([
      supabase.from('channel_categories').select('*').order('position'),
      supabase.from('channels').select('*').order('position'),
    ]);
    if (cats) setCategories(cats);
    if (chs) {
      setChannels(chs as Channel[]);

      // Fetch last message per channel + read states
      const chIds = chs.map((c: any) => c.id);
      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('channel_id, content, created_at, user_id, profiles:user_id(display_name)')
        .is('parent_message_id', null)
        .in('channel_id', chIds)
        .order('created_at', { ascending: false })
        .limit(200);

      // Read states via raw rpc-style query
      let readStatesMap = new Map<string, string>();
      try {
        const { data: rsData } = await (supabase as any).from('channel_read_states').select('channel_id, last_read_at').eq('user_id', user.id).in('channel_id', chIds);
        if (rsData) (rsData as any[]).forEach((rs: any) => readStatesMap.set(rs.channel_id, rs.last_read_at));
      } catch {}

      const meta = new Map<string, ChannelMeta>();
      const seenChannels = new Set<string>();
      if (lastMsgs) {
        lastMsgs.forEach((m: any) => {
          if (!seenChannels.has(m.channel_id)) {
            seenChannels.add(m.channel_id);
            const lastRead = readStatesMap.get(m.channel_id);
            const isUnread = lastRead ? new Date(m.created_at) > new Date(lastRead) : !!m.created_at;
            meta.set(m.channel_id, {
              lastMessage: m.content,
              lastMessageAt: m.created_at,
              lastAuthor: m.profiles?.display_name || '',
              unread: isUnread,
            });
          }
        });
      }
      // Channels with no messages
      chIds.forEach((id: string) => {
        if (!meta.has(id)) meta.set(id, { unread: false });
      });
      setChannelMeta(meta);

      // Auto-select default if none selected
      if (!selectedChannel) {
        const def = (chs as Channel[]).find(c => c.is_default) || chs[0];
        if (def) {
          setSelectedChannel(def as Channel);
          setShowChannelList(false);
        }
      }
    }
    setLoading(false);
  }, [user, selectedChannel]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  /* ═══ FETCH MESSAGES ═══ */
  const fetchMessages = useCallback(async () => {
    if (!selectedChannel || !user) return;
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('channel_id', selectedChannel.id)
      .is('parent_message_id', null)
      .order('created_at', { ascending: true })
      .limit(200);

    if (data) {
      const msgIds = data.map(m => m.id);
      // Parallel fetch reply counts + reactions
      const [repliesRes, rxnsRes] = await Promise.all([
        msgIds.length > 0 ? supabase.from('messages').select('parent_message_id').in('parent_message_id', msgIds) : { data: [] },
        msgIds.length > 0 ? supabase.from('message_reactions').select('*').in('message_id', msgIds) : { data: [] },
      ]);

      const replyCounts = new Map<string, number>();
      (repliesRes.data || []).forEach((r: any) => {
        replyCounts.set(r.parent_message_id, (replyCounts.get(r.parent_message_id) || 0) + 1);
      });

      const reactionsMap = new Map<string, { emoji: string; count: number; user_reacted: boolean }[]>();
      const grouped = new Map<string, Map<string, { count: number; userReacted: boolean }>>();
      (rxnsRes.data || []).forEach((r: any) => {
        if (!grouped.has(r.message_id)) grouped.set(r.message_id, new Map());
        const em = grouped.get(r.message_id)!;
        if (!em.has(r.emoji)) em.set(r.emoji, { count: 0, userReacted: false });
        const entry = em.get(r.emoji)!;
        entry.count++;
        if (r.user_id === user.id) entry.userReacted = true;
      });
      grouped.forEach((emojiMap, msgId) => {
        reactionsMap.set(msgId, Array.from(emojiMap.entries()).map(([emoji, v]) => ({
          emoji, count: v.count, user_reacted: v.userReacted,
        })));
      });

      setMessages(data.map(m => ({
        ...m,
        reply_count: replyCounts.get(m.id) || 0,
        reactions: reactionsMap.get(m.id) || [],
      })));
    }

    // Mark channel as read
    try {
      const sb = supabase as any;
      const { data: existing } = await sb.from('channel_read_states').select('id').eq('channel_id', selectedChannel.id).eq('user_id', user.id).maybeSingle();
      if (existing) {
        await sb.from('channel_read_states').update({ last_read_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await sb.from('channel_read_states').insert({ channel_id: selectedChannel.id, user_id: user.id });
      }
    } catch {}

    // Update local unread state
    setChannelMeta(prev => {
      const next = new Map(prev);
      const m = next.get(selectedChannel.id);
      if (m) next.set(selectedChannel.id, { ...m, unread: false });
      return next;
    });
  }, [selectedChannel, user]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  /* ═══ REALTIME ═══ */
  useEffect(() => {
    if (!selectedChannel || !user) return;

    const channel = supabase
      .channel(`chat-${selectedChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${selectedChannel.id}`,
      }, async (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.parent_message_id) {
          // Thread reply — update thread if open
          if (threadParent && newMsg.parent_message_id === threadParent.id) {
            const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', newMsg.user_id).single();
            setThreadMessages(prev => [...prev, { ...newMsg, profiles: profile }]);
          }
          setMessages(prev => prev.map(m =>
            m.id === newMsg.parent_message_id ? { ...m, reply_count: (m.reply_count || 0) + 1 } : m
          ));
          return;
        }
        const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', newMsg.user_id).single();
        setMessages(prev => [...prev, { ...newMsg, profiles: profile, reply_count: 0, reactions: [] }]);
        if (newMsg.user_id !== user.id) play('ping');
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        setThreadMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, () => { fetchMessages(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChannel, user?.id, threadParent, fetchMessages, play]);

  // Scroll to bottom
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [threadMessages]);

  /* ═══ ACTIONS ═══ */
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChannel || !user || sending) return;
    play('tap');
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');
    await supabase.from('messages').insert({ channel_id: selectedChannel.id, user_id: user.id, content });
    setSending(false);
    composerRef.current?.focus();
  };

  const openThread = async (msg: Message) => {
    setThreadParent(msg);
    setShowPinned(false);
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('parent_message_id', msg.id)
      .order('created_at', { ascending: true });
    setThreadMessages(data || []);
  };

  const handleThreadReply = async () => {
    if (!threadReply.trim() || !threadParent || !user || !selectedChannel) return;
    play('tap');
    const content = threadReply.trim();
    setThreadReply('');
    await supabase.from('messages').insert({
      channel_id: selectedChannel.id, user_id: user.id, content,
      parent_message_id: threadParent.id,
    });
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    play('tap');
    setReactionTarget(null);
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle();
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji });
    }
  };

  const togglePin = async (msg: Message) => {
    if (!user) return;
    play('tap');
    await supabase.from('messages').update({ is_pinned: !msg.is_pinned }).eq('id', msg.id);
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: !m.is_pinned } : m));
    toast.success(msg.is_pinned ? 'Unpinned' : 'Pinned');
  };

  const deleteMessage = async (msgId: string) => {
    await supabase.from('message_reactions').delete().eq('message_id', msgId);
    // Delete child thread replies first
    await supabase.from('messages').delete().eq('parent_message_id', msgId);
    await supabase.from('messages').delete().eq('id', msgId);
  };

  const startEditing = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editContent.trim()) return;
    play('tap');
    await supabase.from('messages').update({ content: editContent.trim(), edited_at: new Date().toISOString() }).eq('id', editingMessageId);
    setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: editContent.trim(), edited_at: new Date().toISOString() } : m));
    setEditingMessageId(null);
    setEditContent('');
    toast.success('Message edited');
  };


    if (!selectedChannel) return;
    setShowPinned(true);
    setThreadParent(null);
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('channel_id', selectedChannel.id)
      .eq('is_pinned', true)
      .order('created_at', { ascending: false });
    setPinnedMessages(data || []);
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !user) return;
    play('success');
    await supabase.from('channels').insert({
      name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
      category_id: newChannelCategory || categories[0]?.id || null,
      created_by: user.id,
      position: channels.length,
    });
    setNewChannelName('');
    setShowNewChannel(false);
    fetchChannels();
  };

  const selectChannel = (ch: Channel) => {
    setSelectedChannel(ch);
    setShowChannelList(false);
    setThreadParent(null);
    setShowPinned(false);
    play('tap');
  };

  /* ═══ HELPERS ═══ */
  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
  };

  const groupedChannels = categories.map(cat => ({
    ...cat,
    channels: channels.filter(ch => ch.category_id === cat.id),
  }));

  const pinnedCount = messages.filter(m => m.is_pinned).length;

  /* ═══════════════════════════════════ */
  /* ═══ RENDER: CHANNEL LIST ═══════ */
  /* ═══════════════════════════════════ */
  if (showChannelList) {
    return (
      <div className="pb-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Chat</h1>
              <p className="text-[10px] text-muted-foreground/40 font-medium mt-0.5">DH Club conversations</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowNewChannel(true)} className="h-8 w-8 p-0 rounded-xl">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* New channel form */}
          <AnimatePresence>
            {showNewChannel && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                <div className="glass-card p-4 space-y-3">
                  <h3 className="text-xs font-bold">New Channel</h3>
                  <Input placeholder="channel-name" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} className="h-9 text-sm" />
                  <select value={newChannelCategory} onChange={e => setNewChannelCategory(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreateChannel} disabled={!newChannelName.trim()} className="flex-1 h-8 text-xs font-bold">Create</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewChannel(false)} className="h-8 text-xs">Cancel</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Channel list with previews */}
          <div className="space-y-5">
            {groupedChannels.map(group => (
              group.channels.length > 0 && (
                <div key={group.id}>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30 mb-1.5 px-1">{group.name}</p>
                  <div className="space-y-0.5">
                    {group.channels.map((ch, i) => {
                      const meta = channelMeta.get(ch.id);
                      const emoji = CHANNEL_EMOJI[ch.name] || '#';
                      return (
                        <motion.button
                          key={ch.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.025 }}
                          onClick={() => selectChannel(ch)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150",
                            "hover:bg-muted/40 active:bg-muted/60 active:scale-[0.99]",
                            selectedChannel?.id === ch.id && "bg-primary/8",
                            meta?.unread && "bg-muted/15"
                          )}
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 transition-colors",
                            meta?.unread ? "bg-primary/12" : "bg-muted/30"
                          )}>
                            {typeof emoji === 'string' && emoji !== '#' ? emoji : <Hash className="w-4 h-4 text-muted-foreground/40" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "text-[13px] tracking-tight truncate",
                                meta?.unread ? "font-bold text-foreground" : "font-semibold text-foreground/70"
                              )}>
                                {ch.name}
                              </span>
                              {meta?.unread && (
                                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                              )}
                            </div>
                            {meta?.lastMessage ? (
                              <p className={cn(
                                "text-[11px] truncate mt-0.5",
                                meta.unread ? "text-foreground/50 font-medium" : "text-muted-foreground/35"
                              )}>
                                {meta.lastAuthor && <span className="font-semibold">{meta.lastAuthor}: </span>}
                                {meta.lastMessage}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground/25 mt-0.5 italic">{ch.description || 'No messages yet'}</p>
                            )}
                          </div>
                          {meta?.lastMessageAt && (
                            <span className="text-[9px] text-muted-foreground/25 font-medium flex-shrink-0 self-start mt-1">
                              {isToday(new Date(meta.lastMessageAt)) ? format(new Date(meta.lastMessageAt), 'h:mm a') : format(new Date(meta.lastMessageAt), 'MMM d')}
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )
            ))}
          </div>

          {channels.length === 0 && !loading && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.03))' }}>
                <Hash className="w-7 h-7 text-primary/40" />
              </div>
              <p className="text-sm text-muted-foreground/50 font-semibold">No channels yet</p>
              <p className="text-xs text-muted-foreground/30 mt-1">Create one to start chatting with the crew</p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  /* ═══════════════════════════════════ */
  /* ═══ RENDER: MESSAGE VIEW ═════════ */
  /* ═══════════════════════════════════ */
  return (
    <div className="flex flex-col -mx-4 sm:-mx-5 -mt-5 sm:-mt-6 lg:-mt-8" style={{ height: 'calc(100vh - 4.5rem)', maxHeight: 'calc(100dvh - 4.5rem)' }}>
      {/* Channel header */}
      <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-border/8 flex-shrink-0" style={{ background: 'hsl(var(--background) / 0.7)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => { setShowChannelList(true); setThreadParent(null); setShowPinned(false); }} className="p-1.5 -ml-1 rounded-lg hover:bg-muted/40 transition-colors lg:hidden">
          <ChevronLeft className="w-5 h-5 text-muted-foreground/60" />
        </button>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-sm">
          {CHANNEL_EMOJI[selectedChannel?.name || ''] || <Hash className="w-3.5 h-3.5 text-primary/60" />}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-[14px] tracking-tight">{selectedChannel?.name}</h2>
          {selectedChannel?.description && (
            <p className="text-[9px] text-muted-foreground/30 truncate">{selectedChannel.description}</p>
          )}
        </div>
        <button onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }} className={cn("p-1.5 rounded-lg transition-colors", showSearch ? "bg-primary/15 text-primary" : "hover:bg-muted/40 text-muted-foreground/40")}>
          <Search className="w-4 h-4" />
        </button>
        {pinnedCount > 0 && (
          <button onClick={showPinnedMessages} className={cn("p-1.5 rounded-lg transition-colors", showPinned ? "bg-premium-warm/15 text-premium-warm" : "hover:bg-muted/40 text-muted-foreground/40")}>
            <Pin className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-b border-border/5 flex-shrink-0">
            <div className="px-4 sm:px-5 py-2">
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="h-8 text-xs bg-muted/20 border-border/8 rounded-lg"
                autoFocus
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 min-h-0">
        {/* Main messages or pinned view */}
        <div className={cn("flex flex-col flex-1 min-w-0", (threadParent || showPinned) && "hidden lg:flex")}>
          {/* Pinned messages panel */}
          {showPinned && !threadParent ? (
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Pin className="w-3.5 h-3.5" style={{ color: 'hsl(var(--premium-warm))' }} /> Pinned Messages
                </h3>
                <button onClick={() => setShowPinned(false)} className="p-1 rounded-lg hover:bg-muted/40 lg:hidden">
                  <X className="w-4 h-4 text-muted-foreground/50" />
                </button>
              </div>
              <div className="space-y-2">
                {pinnedMessages.map(msg => (
                  <div key={msg.id} className="glass-card p-3.5">
                    <div className="flex items-center gap-2 mb-1.5 relative z-10">
                      <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} size={24} />
                      <span className="text-[11px] font-bold text-foreground/80">{msg.profiles?.display_name}</span>
                      <span className="text-[9px] text-muted-foreground/25">{format(new Date(msg.created_at), 'MMM d, h:mm a')}</span>
                    </div>
                    <p className="text-[13px] text-foreground/80 leading-relaxed pl-8 relative z-10">{msg.content}</p>
                  </div>
                ))}
                {pinnedMessages.length === 0 && (
                  <p className="text-xs text-muted-foreground/30 text-center py-8">No pinned messages</p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Messages list */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5">
                <div className="py-3 space-y-0.5">
                  {messages.length === 0 && (
                    <div className="text-center py-20">
                      <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.15))' }}>
                        <MessageSquare className="w-6 h-6 text-muted-foreground/20" />
                      </div>
                      <p className="text-sm text-muted-foreground/40 font-medium">Welcome to #{selectedChannel?.name}</p>
                      <p className="text-[11px] text-muted-foreground/25 mt-1">{selectedChannel?.description || 'Start the conversation'}</p>
                    </div>
                  )}
                  {(searchQuery ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())) : messages).map((msg, idx, filteredMsgs) => {
                    const prevMsg = idx > 0 ? filteredMsgs[idx - 1] : null;
                    const showDate = !prevMsg || getDateLabel(msg.created_at) !== getDateLabel(prevMsg.created_at);
                    const sameAuthor = prevMsg && prevMsg.user_id === msg.user_id &&
                      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 300000;
                    const isOwn = msg.user_id === user?.id;

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex items-center gap-3 py-4">
                            <div className="flex-1 h-px bg-border/8" />
                            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/25 px-2">{getDateLabel(msg.created_at)}</span>
                            <div className="flex-1 h-px bg-border/8" />
                          </div>
                        )}
                        <div className={cn(
                          "group relative px-2.5 py-1.5 -mx-2.5 rounded-xl transition-colors",
                          "hover:bg-muted/12",
                          sameAuthor ? "mt-0" : "mt-3"
                        )}>
                          {/* Author line */}
                          {!sameAuthor && (
                            <div className="flex items-center gap-2 mb-1">
                              <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} size={30} />
                              <span className="text-[12px] font-bold text-foreground/90">{msg.profiles?.display_name || 'Unknown'}</span>
                              <span className="text-[9px] text-muted-foreground/25 font-medium">{format(new Date(msg.created_at), 'h:mm a')}</span>
                              {msg.is_pinned && <Pin className="w-2.5 h-2.5" style={{ color: 'hsl(var(--premium-warm) / 0.7)' }} />}
                            </div>
                          )}

                          <div className={cn("relative", !sameAuthor && "pl-[38px]")}>
                            {/* Timestamp on same-author messages (shown on hover) */}
                            {sameAuthor && (
                              <span className="absolute -left-0.5 top-0.5 text-[8px] text-muted-foreground/0 group-hover:text-muted-foreground/25 transition-colors font-mono">
                                {format(new Date(msg.created_at), 'h:mm')}
                              </span>
                            )}
                            {editingMessageId === msg.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editContent}
                                  onChange={e => setEditContent(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') { setEditingMessageId(null); setEditContent(''); } }}
                                  className="h-8 text-[13px] bg-muted/20 border-border/8 rounded-lg flex-1"
                                  autoFocus
                                />
                                <button onClick={handleSaveEdit} className="p-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => { setEditingMessageId(null); setEditContent(''); }} className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                                  <X className="w-3.5 h-3.5 text-muted-foreground/50" />
                                </button>
                              </div>
                            ) : (
                              <p className="text-[13px] leading-[1.55] text-foreground/85 break-words">
                                {msg.content}
                                {msg.edited_at && <span className="text-[9px] text-muted-foreground/25 ml-1.5">(edited)</span>}
                              </p>
                            )}

                            {/* Reactions row */}
                            {msg.reactions && msg.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {msg.reactions.map(r => (
                                  <button
                                    key={r.emoji}
                                    onClick={() => toggleReaction(msg.id, r.emoji)}
                                    className={cn(
                                      "inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[11px] border transition-all duration-150",
                                      r.user_reacted
                                        ? "border-primary/25 bg-primary/8 text-primary scale-[1.02]"
                                        : "border-border/15 bg-muted/20 text-muted-foreground/50 hover:border-border/30 hover:bg-muted/35"
                                    )}
                                  >
                                    {r.emoji} <span className="font-bold text-[10px]">{r.count}</span>
                                  </button>
                                ))}
                                <button
                                  onClick={() => setReactionTarget(reactionTarget === msg.id ? null : msg.id)}
                                  className="w-6 h-6 rounded-md border border-border/10 bg-muted/10 flex items-center justify-center hover:bg-muted/30 transition-colors"
                                >
                                  <SmilePlus className="w-3 h-3 text-muted-foreground/30" />
                                </button>
                              </div>
                            )}

                            {/* Floating action bar */}
                            <div className="absolute -top-4 right-0 hidden group-hover:flex items-center gap-0.5 bg-surface-elevated/95 border border-border/15 rounded-lg px-0.5 py-0.5 shadow-xl backdrop-blur-sm z-10">
                              {QUICK_EMOJIS.slice(0, 4).map(emoji => (
                                <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 text-sm transition-colors">
                                  {emoji}
                                </button>
                              ))}
                              <div className="w-px h-4 bg-border/15 mx-0.5" />
                              <button onClick={() => openThread(msg)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors" title="Reply in thread">
                                <Reply className="w-3.5 h-3.5 text-muted-foreground/50" />
                              </button>
                              <button onClick={() => togglePin(msg)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors" title={msg.is_pinned ? 'Unpin' : 'Pin'}>
                                <Pin className={cn("w-3.5 h-3.5", msg.is_pinned ? "text-premium-warm" : "text-muted-foreground/40")} />
                              </button>
                              {isOwn && (
                                <button onClick={() => deleteMessage(msg.id)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors" title="Delete">
                                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground/30 hover:text-destructive" />
                                </button>
                              )}
                            </div>

                            {/* Mobile reaction picker */}
                            <AnimatePresence>
                              {reactionTarget === msg.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                                  className="flex items-center gap-0.5 mt-2 bg-surface-elevated border border-border/15 rounded-xl px-1.5 py-1.5 shadow-xl w-fit"
                                >
                                  {QUICK_EMOJIS.map(emoji => (
                                    <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 text-base transition-colors active:scale-90">
                                      {emoji}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Thread indicator */}
                            {(msg.reply_count || 0) > 0 && (
                              <button
                                onClick={() => openThread(msg)}
                                className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-primary/60 hover:text-primary transition-colors"
                              >
                                <MessageSquare className="w-3 h-3" />
                                {msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Composer */}
              <div className="px-4 sm:px-5 py-3 flex-shrink-0 border-t border-border/5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Input
                      ref={composerRef}
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder={`Message #${selectedChannel?.name || ''}`}
                      className="h-11 text-sm bg-muted/20 border-border/8 rounded-xl pl-4 pr-12 focus-visible:ring-primary/20 focus-visible:border-primary/20"
                      autoComplete="off"
                    />
                    <Button
                      size="sm"
                      onClick={handleSend}
                      disabled={!newMessage.trim() || sending}
                      className={cn(
                        "absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-lg transition-all duration-200",
                        newMessage.trim() ? "opacity-100 scale-100" : "opacity-30 scale-90"
                      )}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ═══ THREAD PANEL ═══ */}
        <AnimatePresence>
          {threadParent && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={cn(
                "flex flex-col min-h-0 bg-background",
                "w-full lg:w-[320px] lg:border-l lg:border-border/8"
              )}
            >
              {/* Thread header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/8 flex-shrink-0">
                <h3 className="text-[13px] font-bold flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary/60" /> Thread
                </h3>
                <button onClick={() => setThreadParent(null)} className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                  <X className="w-4 h-4 text-muted-foreground/50" />
                </button>
              </div>

              {/* Parent message */}
              <div className="px-4 py-3 border-b border-border/5 flex-shrink-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <UserAvatar userId={threadParent.user_id} name={threadParent.profiles?.display_name || '?'} size={26} />
                  <span className="text-[11px] font-bold text-foreground/80">{threadParent.profiles?.display_name}</span>
                  <span className="text-[9px] text-muted-foreground/25">{format(new Date(threadParent.created_at), 'h:mm a')}</span>
                </div>
                <p className="text-[13px] text-foreground/75 leading-relaxed pl-[34px]">{threadParent.content}</p>
              </div>

              {/* Thread replies */}
              <div className="flex-1 overflow-y-auto px-4">
                <div className="py-3 space-y-3">
                  {threadMessages.length === 0 && (
                    <p className="text-xs text-muted-foreground/25 text-center py-8">No replies yet</p>
                  )}
                  {threadMessages.map(msg => (
                    <div key={msg.id} className="flex gap-2.5">
                      <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} size={24} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-bold text-foreground/80">{msg.profiles?.display_name}</span>
                          <span className="text-[9px] text-muted-foreground/20">{format(new Date(msg.created_at), 'h:mm a')}</span>
                        </div>
                        <p className="text-[12px] text-foreground/75 leading-relaxed break-words">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={threadEndRef} />
                </div>
              </div>

              {/* Thread composer */}
              <div className="px-4 py-3 border-t border-border/5 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Input
                      value={threadReply}
                      onChange={e => setThreadReply(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleThreadReply()}
                      placeholder="Reply in thread..."
                      className="h-10 text-xs bg-muted/20 border-border/8 rounded-xl pl-3.5 pr-11 focus-visible:ring-primary/20"
                    />
                    <Button
                      size="sm"
                      onClick={handleThreadReply}
                      disabled={!threadReply.trim()}
                      className={cn(
                        "absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 p-0 rounded-lg transition-all",
                        threadReply.trim() ? "opacity-100" : "opacity-30"
                      )}
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
