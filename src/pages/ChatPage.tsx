import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AnimatePresence } from 'framer-motion';
import { Hash, ChevronLeft, Pin, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { toast } from 'sonner';

import { ChannelList } from '@/components/chat/ChannelList';
import { MessageList } from '@/components/chat/MessageList';
import { MessageComposer, type MessageComposerHandle } from '@/components/chat/MessageComposer';
import { ThreadPanel } from '@/components/chat/ThreadPanel';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { CHANNEL_EMOJI } from '@/components/chat/types';
import type { Channel, Category, ChannelMeta, Message } from '@/components/chat/types';

const PAGE_SIZE = 50;

export default function ChatPage() {
  const { user } = useAuth();
  const { play } = useSoundEffect();
  const composerRef = useRef<MessageComposerHandle>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [channelMeta, setChannelMeta] = useState<Map<string, ChannelMeta>>(new Map());
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showChannelList, setShowChannelList] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Pagination
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Thread
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadReply, setThreadReply] = useState('');

  // Pinned
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);

  // Edit
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);

  // Typing indicators
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcast = useRef(0);

  // Last read timestamp for unread divider
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  /* ═══ HELPERS ═══ */
  const enrichMessages = useCallback(async (rawMsgs: any[], userId: string): Promise<Message[]> => {
    if (rawMsgs.length === 0) return [];
    const msgIds = rawMsgs.map(m => m.id);
    const [repliesRes, rxnsRes] = await Promise.all([
      supabase.from('messages').select('parent_message_id').in('parent_message_id', msgIds),
      supabase.from('message_reactions').select('*').in('message_id', msgIds),
    ]);

    const replyCounts = new Map<string, number>();
    (repliesRes.data || []).forEach((r: any) => {
      replyCounts.set(r.parent_message_id, (replyCounts.get(r.parent_message_id) || 0) + 1);
    });

    const grouped = new Map<string, Map<string, { count: number; userReacted: boolean }>>();
    (rxnsRes.data || []).forEach((r: any) => {
      if (!grouped.has(r.message_id)) grouped.set(r.message_id, new Map());
      const em = grouped.get(r.message_id)!;
      if (!em.has(r.emoji)) em.set(r.emoji, { count: 0, userReacted: false });
      const entry = em.get(r.emoji)!;
      entry.count++;
      if (r.user_id === userId) entry.userReacted = true;
    });

    return rawMsgs.map(m => ({
      ...m,
      reply_count: replyCounts.get(m.id) || 0,
      reactions: grouped.has(m.id)
        ? Array.from(grouped.get(m.id)!.entries()).map(([emoji, v]) => ({ emoji, count: v.count, user_reacted: v.userReacted }))
        : [],
    }));
  }, []);

  /* ═══ FETCH CHANNELS ═══ */
  const fetchChannels = useCallback(async () => {
    if (!user) return;
    const [{ data: cats }, { data: chs }] = await Promise.all([
      supabase.from('channel_categories').select('*').order('position'),
      supabase.from('channels').select('*').order('position'),
    ]);
    if (cats) setCategories(cats);
    if (chs) {
      setChannels(chs as Channel[]);
      const chIds = chs.map((c: any) => c.id);
      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('channel_id, content, created_at, user_id, profiles:user_id(display_name)')
        .is('parent_message_id', null)
        .in('channel_id', chIds)
        .order('created_at', { ascending: false })
        .limit(200);

      let readStatesMap = new Map<string, string>();
      try {
        const { data: rsData } = await supabase.from('channel_read_states' as any).select('channel_id, last_read_at').eq('user_id', user.id).in('channel_id', chIds);
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
            meta.set(m.channel_id, { lastMessage: m.content, lastMessageAt: m.created_at, lastAuthor: m.profiles?.display_name || '', unread: isUnread });
          }
        });
      }
      chIds.forEach((id: string) => { if (!meta.has(id)) meta.set(id, { unread: false }); });
      setChannelMeta(meta);

      if (!selectedChannel) {
        const def = (chs as Channel[]).find(c => c.is_default) || chs[0];
        if (def) { setSelectedChannel(def as Channel); setShowChannelList(false); }
      }
    }
    setLoading(false);
  }, [user, selectedChannel]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  /* ═══ FETCH MESSAGES (paginated) ═══ */
  const fetchMessages = useCallback(async (before?: string) => {
    if (!selectedChannel || !user) return;
    let query = supabase
      .from('messages')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('channel_id', selectedChannel.id)
      .is('parent_message_id', null)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (before) query = query.lt('created_at', before);

    const { data } = await query;
    if (!data) return;

    const reversed = [...data].reverse();
    const enriched = await enrichMessages(reversed, user.id);

    if (before) {
      setMessages(prev => [...enriched, ...prev]);
    } else {
      setMessages(enriched);
    }
    setHasMore(data.length === PAGE_SIZE);

    if (!before) {
      // Capture lastReadAt BEFORE updating read state
      try {
        const sb = supabase as any;
        const { data: existing } = await sb.from('channel_read_states').select('id, last_read_at').eq('channel_id', selectedChannel.id).eq('user_id', user.id).maybeSingle();
        if (existing) {
          setLastReadAt(existing.last_read_at);
          await sb.from('channel_read_states').update({ last_read_at: new Date().toISOString() }).eq('id', existing.id);
        } else {
          setLastReadAt(null);
          await sb.from('channel_read_states').insert({ channel_id: selectedChannel.id, user_id: user.id });
        }
      } catch {}

      setChannelMeta(prev => {
        const next = new Map(prev);
        const m = next.get(selectedChannel.id);
        if (m) next.set(selectedChannel.id, { ...m, unread: false });
        return next;
      });
    }
  }, [selectedChannel, user, enrichMessages]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const loadOlderMessages = useCallback(() => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    fetchMessages(messages[0].created_at).finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, messages, fetchMessages]);

  /* ═══ REALTIME ═══ */
  useEffect(() => {
    if (!selectedChannel || !user) return;

    const channel = supabase
      .channel(`chat-${selectedChannel.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${selectedChannel.id}` },
        async (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.parent_message_id) {
            if (threadParent && newMsg.parent_message_id === threadParent.id) {
              // Replace optimistic thread reply or append
              const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', newMsg.user_id).single();
              setThreadMessages(prev => {
                const hasOpt = prev.some(m => m._optimistic && m.content === newMsg.content && m.user_id === newMsg.user_id);
                if (hasOpt) {
                  return prev.map(m => m._optimistic && m.content === newMsg.content ? { ...newMsg, profiles: profile || m.profiles } : m);
                }
                return [...prev, { ...newMsg, profiles: profile }];
              });
            }
            setMessages(prev => prev.map(m => m.id === newMsg.parent_message_id ? { ...m, reply_count: (m.reply_count || 0) + 1 } : m));
            return;
          }
          if (newMsg.user_id === user.id) {
            // Already replaced optimistic message on insert response — just deduplicate
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              // Fallback: replace any lingering optimistic message with matching content
              const hasOptimistic = prev.some(m => m._optimistic && m.content === newMsg.content);
              if (hasOptimistic) {
                return prev.map(m => m._optimistic && m.content === newMsg.content ? { ...newMsg, profiles: m.profiles, reply_count: 0, reactions: [] } : m);
              }
              return prev;
            });
            return;
          }
          const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', newMsg.user_id).single();
          setMessages(prev => [...prev, { ...newMsg, profiles: profile, reply_count: 0, reactions: [] }]);
          play('ping');
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${selectedChannel.id}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.parent_message_id) {
            setThreadMessages(prev => prev.map(m => m.id === updated.id ? { ...m, content: updated.content, edited_at: updated.edited_at, is_pinned: updated.is_pinned } : m));
          } else {
            setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, content: updated.content, edited_at: updated.edited_at, is_pinned: updated.is_pinned } : m));
          }
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          setThreadMessages(prev => prev.filter(m => m.id !== payload.old.id));
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const r = payload.new as any;
          setMessages(prev => prev.map(m => {
            if (m.id !== r.message_id) return m;
            const reactions = [...(m.reactions || [])];
            const existing = reactions.find(rx => rx.emoji === r.emoji);
            if (existing) {
              existing.count++;
              if (r.user_id === user.id) existing.user_reacted = true;
            } else {
              reactions.push({ emoji: r.emoji, count: 1, user_reacted: r.user_id === user.id });
            }
            return { ...m, reactions };
          }));
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const r = payload.old as any;
          setMessages(prev => prev.map(m => {
            if (m.id !== r.message_id) return m;
            let reactions = [...(m.reactions || [])];
            const existing = reactions.find(rx => rx.emoji === r.emoji);
            if (existing) {
              existing.count--;
              if (r.user_id === user.id) existing.user_reacted = false;
              if (existing.count <= 0) reactions = reactions.filter(rx => rx.emoji !== r.emoji);
            }
            return { ...m, reactions };
          }));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChannel, user?.id, threadParent, play]);

  /* ═══ TYPING PRESENCE ═══ */
  useEffect(() => {
    if (!selectedChannel || !user) return;

    const presenceChannel = supabase.channel(`typing-${selectedChannel.id}`, {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const typing: string[] = [];
        for (const [uid, presences] of Object.entries(state)) {
          if (uid === user.id) continue;
          const p = (presences as any[])?.[0];
          if (p?.typing && p?.name) typing.push(p.name);
        }
        setTypingUsers(typing);
      })
      .subscribe();

    return () => { supabase.removeChannel(presenceChannel); };
  }, [selectedChannel?.id, user?.id]);

  const broadcastTyping = useCallback(() => {
    if (!selectedChannel || !user) return;
    const now = Date.now();
    if (now - lastTypingBroadcast.current < 2000) return;
    lastTypingBroadcast.current = now;

    const presenceChannel = supabase.channel(`typing-${selectedChannel.id}`);
    presenceChannel.track({
      typing: true,
      name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Someone',
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      presenceChannel.track({ typing: false, name: '' });
    }, 3000);
  }, [selectedChannel, user]);

  /* ═══ ACTIONS ═══ */
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChannel || !user || sending) return;
    play('tap');
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      channel_id: selectedChannel.id,
      user_id: user.id,
      content,
      parent_message_id: null,
      is_pinned: false,
      created_at: new Date().toISOString(),
      edited_at: null,
      profiles: { display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'You', avatar_url: null },
      reply_count: 0,
      reactions: [],
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({ channel_id: selectedChannel.id, user_id: user.id, content })
      .select('*, profiles:user_id(display_name, avatar_url)')
      .single();

    if (error || !inserted) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      toast.error('Failed to send message');
    } else {
      // Immediately replace optimistic message with the real one
      setMessages(prev => prev.map(m => m.id === optimisticId
        ? { ...inserted, reply_count: 0, reactions: [] }
        : m
      ));
      // Fire-and-forget push notification
      supabase.functions.invoke('send-push-notification', {
        body: { record: { id: inserted.id, channel_id: inserted.channel_id, user_id: inserted.user_id, content: inserted.content } },
      }).catch(() => {});
    }
    setSending(false);
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

    const optimisticId = `opt-thread-${Date.now()}`;
    const optimisticReply: Message = {
      id: optimisticId,
      channel_id: selectedChannel.id,
      user_id: user.id,
      content,
      parent_message_id: threadParent.id,
      is_pinned: false,
      created_at: new Date().toISOString(),
      edited_at: null,
      profiles: { display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'You', avatar_url: null },
      reply_count: 0,
      reactions: [],
      _optimistic: true,
    };
    setThreadMessages(prev => [...prev, optimisticReply]);

    const { data: inserted, error } = await supabase.from('messages').insert({
      channel_id: selectedChannel.id, user_id: user.id, content,
      parent_message_id: threadParent.id,
    }).select('*, profiles:user_id(display_name, avatar_url)').single();

    if (error || !inserted) {
      setThreadMessages(prev => prev.filter(m => m.id !== optimisticId));
      toast.error('Failed to send reply');
    } else {
      setThreadMessages(prev => prev.map(m => m.id === optimisticId ? { ...inserted } : m));
      // Fire-and-forget push notification for thread replies too
      supabase.functions.invoke('send-push-notification', {
        body: { record: { id: inserted.id, channel_id: inserted.channel_id, user_id: inserted.user_id, content: inserted.content } },
      }).catch(() => {});
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    play('tap');
    const { data: existing } = await supabase
      .from('message_reactions').select('id')
      .eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji)
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
    const wasPinned = msg.is_pinned;
    await supabase.from('messages').update({ is_pinned: !wasPinned }).eq('id', msg.id);
    toast.success(wasPinned ? 'Unpinned' : 'Pinned');
    // Update pinned panel if open
    if (showPinned) {
      if (wasPinned) {
        setPinnedMessages(prev => prev.filter(m => m.id !== msg.id));
      } else {
        setPinnedMessages(prev => [msg, ...prev]);
      }
    }
  };

  const deleteMessage = async (msgId: string) => {
    await supabase.from('message_reactions').delete().eq('message_id', msgId);
    await supabase.from('messages').delete().eq('parent_message_id', msgId);
    await supabase.from('messages').delete().eq('id', msgId);
  };

  const startEditing = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const handleSaveEdit = async (msgId: string, content: string) => {
    if (!content.trim()) return;
    play('tap');
    await supabase.from('messages').update({ content: content.trim(), edited_at: new Date().toISOString() }).eq('id', msgId);
    setEditingMessageId(null);
    setEditContent('');
    toast.success('Message edited');
  };

  const loadPinnedMessages = async () => {
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

  const handleCreateChannel = async (name: string, categoryId: string) => {
    if (!user) return;
    play('success');
    await supabase.from('channels').insert({ name, category_id: categoryId || null, created_by: user.id, position: channels.length });
    fetchChannels();
  };

  const selectChannel = (ch: Channel) => {
    setSelectedChannel(ch);
    setShowChannelList(false);
    setThreadParent(null);
    setShowPinned(false);
    setLastReadAt(null);
    play('tap');
    // Focus composer after channel switch
    setTimeout(() => composerRef.current?.focus(), 200);
  };

  /* ═══ DB-SIDE SEARCH ═══ */
  useEffect(() => {
    if (!showSearch || !searchQuery.trim() || !selectedChannel) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('channel_id', selectedChannel.id)
        .is('parent_message_id', null)
        .ilike('content', `%${searchQuery}%`)
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) {
        setSearchResults(data.map(m => ({ ...m, reply_count: 0, reactions: [] })));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearch, selectedChannel]);

  const pinnedCount = messages.filter(m => m.is_pinned).length;

  /* ═══ Determine if on mobile or showing channel list ═══ */
  const hasThread = !!threadParent;
  const hasPinned = showPinned;
  const showSidePanel = hasThread || hasPinned;

  /* ═══ CHANNEL LIST VIEW (mobile only — desktop uses sidebar) ═══ */
  if (showChannelList) {
    return (
      <div className="flex overflow-hidden" style={{ height: 'calc(100dvh - 4.5rem - env(safe-area-inset-bottom, 0px))', maxHeight: 'calc(100dvh - 4.5rem - env(safe-area-inset-bottom, 0px))' }}>
        {/* Desktop: always show sidebar + placeholder */}
        <div className="w-full lg:w-[260px] lg:border-r lg:border-border/25 flex-shrink-0">
          <ChannelList
            channels={channels}
            categories={categories}
            channelMeta={channelMeta}
            selectedChannel={selectedChannel}
            loading={loading}
            onSelectChannel={selectChannel}
            onCreateChannel={handleCreateChannel}
          />
        </div>
        <div className="hidden lg:flex flex-1 items-center justify-center text-muted-foreground/50 text-sm">
          Select a channel to start chatting
        </div>
      </div>
    );
  }

  /* ═══ MESSAGE VIEW ═══ */
  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100dvh - 4.5rem - env(safe-area-inset-bottom, 0px))', maxHeight: 'calc(100dvh - 4.5rem - env(safe-area-inset-bottom, 0px))' }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-[260px] border-r border-border/25 flex-shrink-0 overflow-y-auto">
        <ChannelList
          channels={channels}
          categories={categories}
          channelMeta={channelMeta}
          selectedChannel={selectedChannel}
          loading={loading}
          onSelectChannel={selectChannel}
          onCreateChannel={handleCreateChannel}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-border/25 flex-shrink-0" style={{ background: 'hsl(var(--background) / 0.7)', backdropFilter: 'blur(12px)' }}>
          <button onClick={() => { setShowChannelList(true); setThreadParent(null); setShowPinned(false); }} className="p-1.5 -ml-1 rounded-lg hover:bg-muted/50 transition-colors lg:hidden">
            <ChevronLeft className="w-5 h-5 text-muted-foreground/60" />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-sm">
            {CHANNEL_EMOJI[selectedChannel?.name || ''] || <Hash className="w-3.5 h-3.5 text-primary/80" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-[14px] tracking-tight">{selectedChannel?.name}</h2>
            {selectedChannel?.description && <p className="text-[9px] text-muted-foreground/70 truncate">{selectedChannel.description}</p>}
          </div>
          <button onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); setSearchResults(null); }} className={cn("p-1.5 rounded-lg transition-colors", showSearch ? "bg-primary/15 text-primary" : "hover:bg-muted/50 text-muted-foreground/60")}>
            <Search className="w-4 h-4" />
          </button>
          {pinnedCount > 0 && (
            <button onClick={loadPinnedMessages} className={cn("p-1.5 rounded-lg transition-colors", showPinned ? "bg-premium-warm/15 text-premium-warm" : "hover:bg-muted/50 text-muted-foreground/60")}>
              <Pin className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="border-b border-border/5 flex-shrink-0 px-4 sm:px-5 py-2 space-y-1">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="h-8 text-xs bg-muted/20 border-border/25 rounded-lg"
              autoFocus
            />
            {searchResults && searchResults.length > 0 && (
              <p className="text-[10px] text-muted-foreground/60 font-medium px-1">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          {/* Message area — hide on mobile when thread/pinned is open */}
          <div className={cn("flex flex-col flex-1 min-w-0", showSidePanel && "hidden lg:flex")}>
            {showPinned && !threadParent ? (
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5" style={{ color: 'hsl(var(--premium-warm))' }} /> Pinned Messages
                  </h3>
                  <button onClick={() => setShowPinned(false)} className="p-1 rounded-lg hover:bg-muted/50">
                    <X className="w-4 h-4 text-muted-foreground/70" />
                  </button>
                </div>
                <div className="space-y-2">
                  {pinnedMessages.map(msg => (
                    <div key={msg.id} className="glass-card p-3.5">
                      <div className="flex items-center gap-2 mb-1.5 relative z-10">
                        <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} avatarUrl={msg.profiles?.avatar_url} size={24} />
                        <span className="text-[11px] font-bold text-foreground/80">{msg.profiles?.display_name}</span>
                        <span className="text-[9px] text-muted-foreground/70">{format(new Date(msg.created_at), 'MMM d, h:mm a')}</span>
                        <button
                          onClick={() => togglePin(msg)}
                          className="ml-auto p-1 rounded-md hover:bg-muted/50 transition-colors"
                          title="Unpin"
                        >
                          <Pin className="w-3 h-3 text-premium-warm" />
                        </button>
                      </div>
                      <p className="text-[13px] text-foreground/80 leading-relaxed pl-8 relative z-10">{msg.content}</p>
                    </div>
                  ))}
                  {pinnedMessages.length === 0 && <p className="text-xs text-muted-foreground/70 text-center py-8">No pinned messages</p>}
                </div>
              </div>
            ) : (
              <>
                <MessageList
                  messages={searchResults || messages}
                  selectedChannel={selectedChannel}
                  userId={user?.id}
                  searchQuery={searchResults ? '' : ''}
                  onToggleReaction={toggleReaction}
                  onOpenThread={openThread}
                  onTogglePin={togglePin}
                  onStartEditing={startEditing}
                  onDeleteMessage={deleteMessage}
                  onSaveEdit={handleSaveEdit}
                  editingMessageId={editingMessageId}
                  editContent={editContent}
                  onEditContentChange={setEditContent}
                  onCancelEdit={() => { setEditingMessageId(null); setEditContent(''); }}
                  onLoadMore={searchResults ? undefined : loadOlderMessages}
                  hasMore={searchResults ? false : hasMore}
                  loadingMore={loadingMore}
                  isSearchActive={!!searchResults}
                  lastReadAt={lastReadAt}
                />
                {!searchResults && (
                  <div className="flex-shrink-0 border-t border-border/5">
                    {typingUsers.length > 0 && (
                      <div className="px-4 sm:px-5 py-1">
                        <span className="text-[10px] text-muted-foreground/60 font-medium italic">
                          {typingUsers.length === 1 ? `${typingUsers[0]} is typing…` : `${typingUsers.join(', ')} are typing…`}
                        </span>
                      </div>
                    )}
                    <MessageComposer
                      ref={composerRef}
                      value={newMessage}
                      onChange={setNewMessage}
                      onSend={handleSend}
                      onTyping={broadcastTyping}
                      disabled={sending}
                      placeholder={`Message #${selectedChannel?.name || ''}`}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Thread / pinned side panel — show full-screen on mobile */}
          <AnimatePresence>
            {threadParent && (
              <div className={cn("flex flex-col min-h-0", "w-full lg:w-auto")}>
                <ThreadPanel
                  parent={threadParent}
                  replies={threadMessages}
                  replyValue={threadReply}
                  onReplyChange={setThreadReply}
                  onSendReply={handleThreadReply}
                  onClose={() => { setThreadParent(null); setTimeout(() => composerRef.current?.focus(), 100); }}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
