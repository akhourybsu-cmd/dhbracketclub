import { useEffect, useState, useCallback, useRef } from 'react'; 
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { AnimatePresence } from 'framer-motion';
import { Hash, ChevronLeft, Pin, Search, X, Link2, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { ChannelList } from '@/components/chat/ChannelList';
import { MessageList } from '@/components/chat/MessageList';
import { MessageComposer, type MessageComposerHandle, type MentionMember } from '@/components/chat/MessageComposer';
import { ThreadPanel } from '@/components/chat/ThreadPanel';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { ChannelSettingsDialog } from '@/components/chat/ChannelSettingsDialog';
import { CHANNEL_EMOJI } from '@/components/chat/types';
import type { Channel, Category, ChannelMeta, Message } from '@/components/chat/types';

import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatRealtime, useChatTyping } from '@/hooks/useChatRealtime';
import { useChatActions } from '@/hooks/useChatActions';

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const composerRef = useRef<MessageComposerHandle>(null);

  // Dynamic viewport height to handle mobile keyboard
  const [chatHeight, setChatHeight] = useState<string>('calc(100dvh - env(safe-area-inset-top, 0px))');
  const [scrollToBottomTrigger, setScrollToBottomTrigger] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

    const update = () => {
      requestAnimationFrame(() => {
        const viewportHeight = vv.height + vv.offsetTop;
        const keyboardInset = Math.max(0, window.innerHeight - viewportHeight);
        const keyboardOpen = keyboardInset > 100;
        const mobileBottomOffset = keyboardOpen ? 0 : 72;
        const nextHeight = isDesktop()
          ? viewportHeight
          : Math.max(220, viewportHeight - mobileBottomOffset);

        setChatHeight(`${nextHeight}px`);
        setScrollToBottomTrigger(c => c + 1);
      });
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [channelMeta, setChannelMeta] = useState<Map<string, ChannelMeta>>(new Map());
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showChannelList, setShowChannelList] = useState(true);
  const [loading, setLoading] = useState(true);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Thread
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadReply, setThreadReply] = useState('');
  const threadParentRef = useRef<Message | null>(null);
  threadParentRef.current = threadParent;

  // Pinned
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);

  // Members for @mention autocomplete
  const [members, setMembers] = useState<MentionMember[]>([]);
  const [currentDisplayName, setCurrentDisplayName] = useState<string>('');

  // Last read timestamp for unread divider
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  // Channel settings dialog
  const [settingsChannel, setSettingsChannel] = useState<Channel | null>(null);

  // ═══ HOOKS ═══
  const {
    messages, setMessages, hasMore, loadingMore, fetchMessages, loadOlderMessages,
  } = useChatMessages(user?.id);

  const {
    play, toggleReaction, togglePin, deleteMessage,
    startEditing, handleSaveEdit,
    editingMessageId, editContent, setEditContent, cancelEdit,
  } = useChatActions(user?.id);

  useChatRealtime({
    channelId: selectedChannel?.id,
    userId: user?.id,
    members,
    play,
    setMessages,
    threadParentRef,
    setThreadMessages,
  });

  const { typingUsers, broadcastTyping } = useChatTyping(
    selectedChannel?.id,
    user?.id,
    currentDisplayName || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Someone',
  );

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

  /* ═══ FETCH MEMBERS FOR @MENTIONS ═══ */
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('id, display_name, avatar_url').then(({ data }) => {
      if (data) {
        setMembers(data.map(p => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url })));
        const me = data.find(p => p.id === user.id);
        if (me) setCurrentDisplayName(me.display_name);
      }
    });
  }, [user]);

  /* ═══ FETCH MESSAGES ═══ */
  useEffect(() => {
    if (!selectedChannel || !user) return;

    fetchMessages(selectedChannel.id).then(async () => {
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
    });
  }, [selectedChannel?.id, user?.id]);

  const handleLoadMore = useCallback(() => {
    if (selectedChannel) loadOlderMessages(selectedChannel.id);
  }, [selectedChannel, loadOlderMessages]);

  /* ═══ ACTIONS ═══ */
  const handleSend = async (imageUrls?: string[]) => {
    const hasText = newMessage.trim().length > 0;
    const hasImages = imageUrls && imageUrls.length > 0;
    if ((!hasText && !hasImages) || !selectedChannel || !user || sending) return;
    play('tap');
    setSending(true);

    // Build content: text + image URLs on separate lines
    let content = newMessage.trim();
    if (hasImages) {
      const imgLines = imageUrls.map(url => url).join('\n');
      content = content ? `${content}\n${imgLines}` : imgLines;
    }
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
      setMessages(prev => prev.map(m => m.id === optimisticId
        ? { ...inserted, reply_count: 0, reactions: [] }
        : m
      ));
      // Fire-and-forget: push notification + link preview generation
      supabase.functions.invoke('send-push-notification', {
        body: { record: { id: inserted.id, channel_id: inserted.channel_id, user_id: inserted.user_id, content: inserted.content } },
      }).catch(() => {});

      // Link previews are generated by LinkPreviewCard on render — no duplicate insert here
    }
    setSending(false);
  };

  const openThread = useCallback(async (msg: Message) => {
    setThreadParent(msg);
    setShowPinned(false);
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('parent_message_id', msg.id)
      .order('created_at', { ascending: true });
    setThreadMessages(data || []);
  }, []);

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
      supabase.functions.invoke('send-push-notification', {
        body: { record: { id: inserted.id, channel_id: inserted.channel_id, user_id: inserted.user_id, content: inserted.content } },
      }).catch(() => {});
    }
  };

  const handleTogglePin = useCallback(async (msg: Message) => {
    await togglePin(msg);
    if (showPinned) {
      if (msg.is_pinned) {
        setPinnedMessages(prev => prev.filter(m => m.id !== msg.id));
      } else {
        setPinnedMessages(prev => [msg, ...prev]);
      }
    }
  }, [togglePin, showPinned]);

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

  const handleEditChannel = async (channelId: string, newName: string) => {
    if (!user) return;
    const { error } = await supabase.from('channels').update({ name: newName }).eq('id', channelId);
    if (error) {
      toast.error('Failed to rename channel');
    } else {
      play('success');
      toast.success('Channel renamed');
      setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, name: newName } : ch));
      if (selectedChannel?.id === channelId) {
        setSelectedChannel(prev => prev ? { ...prev, name: newName } : prev);
      }
    }
  };

  const handleUpdateChannel = async (channelId: string, updates: Partial<Pick<Channel, 'name' | 'description' | 'icon' | 'category_id' | 'is_default'>>) => {
    if (!user) return;
    const { error } = await supabase.from('channels').update(updates).eq('id', channelId);
    if (error) {
      toast.error('Failed to update channel');
    } else {
      play('success');
      toast.success('Channel updated');
      setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, ...updates } : ch));
      if (selectedChannel?.id === channelId) {
        setSelectedChannel(prev => prev ? { ...prev, ...updates } as Channel : prev);
      }
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!user) return;
    // Delete messages first (cascade may not cover all), then the channel
    await supabase.from('messages').delete().eq('channel_id', channelId);
    const { error } = await supabase.from('channels').delete().eq('id', channelId);
    if (error) {
      toast.error('Failed to delete channel');
    } else {
      play('success');
      toast.success('Channel deleted');
      setChannels(prev => prev.filter(ch => ch.id !== channelId));
      if (selectedChannel?.id === channelId) {
        const remaining = channels.filter(ch => ch.id !== channelId);
        const def = remaining.find(c => c.is_default) || remaining[0] || null;
        setSelectedChannel(def);
        if (!def) setShowChannelList(true);
      }
    }
  };

  const handleCreateCategory = async (name: string) => {
    if (!user) return;
    const { error } = await supabase.from('channel_categories').insert({ name, position: categories.length });
    if (error) {
      toast.error('Failed to create category');
    } else {
      play('success');
      fetchChannels();
    }
  };

  const handleReorderChannels = async (categoryId: string, reordered: Channel[]) => {
    setChannels(prev => {
      const others = prev.filter(ch => ch.category_id !== categoryId);
      const updated = reordered.map((ch, i) => ({ ...ch, position: i }));
      return [...others, ...updated].sort((a, b) => a.position - b.position);
    });
    await Promise.all(
      reordered.map((ch, i) =>
        supabase.from('channels').update({ position: i }).eq('id', ch.id)
      )
    );
  };

  const selectChannel = (ch: Channel) => {
    setSelectedChannel(ch);
    setMessages([]);
    setShowChannelList(false);
    setThreadParent(null);
    setShowPinned(false);
    setLastReadAt(null);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults(null);
    cancelEdit();
    setNewMessage('');
    play('tap');
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      setTimeout(() => composerRef.current?.focus(), 200);
    }
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
  const showSidePanel = !!threadParent || showPinned;

  /* ═══ CHANNEL LIST VIEW (mobile only — desktop uses sidebar) ═══ */
  if (showChannelList) {
    return (
      <div className="flex overflow-hidden" style={{ height: chatHeight }}>
        <div className="w-full lg:w-[260px] lg:border-r lg:border-border/25 flex-shrink-0 overflow-y-auto">
          <ChannelList
            channels={channels}
            categories={categories}
            channelMeta={channelMeta}
            selectedChannel={selectedChannel}
            loading={loading}
            onSelectChannel={selectChannel}
            onCreateChannel={handleCreateChannel}
            onEditChannel={handleEditChannel}
            onReorderChannels={handleReorderChannels}
            onOpenSettings={setSettingsChannel}
            onCreateCategory={handleCreateCategory}
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
    <div className="flex overflow-hidden" style={{ height: chatHeight }}>
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
          onEditChannel={handleEditChannel}
          onReorderChannels={handleReorderChannels}
          onOpenSettings={setSettingsChannel}
          onCreateCategory={handleCreateCategory}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2.5 py-3 border-b border-border/20 flex-shrink-0 sticky top-0 z-10" style={{ background: 'hsl(var(--background) / 0.8)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))', paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))', paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))' }}>
          <button onClick={() => { setShowChannelList(true); setThreadParent(null); setShowPinned(false); }} className="p-1.5 -ml-0.5 rounded-lg hover:bg-muted/50 transition-colors lg:hidden">
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
          <button onClick={() => navigate('/shared')} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground/60 transition-colors" title="Shared Media">
            <Link2 className="w-4 h-4" />
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
          <div className={cn("flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden", showSidePanel && "hidden lg:flex")}>
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
                          onClick={() => handleTogglePin(msg)}
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
                  currentDisplayName={currentDisplayName}
                  searchQuery={searchResults ? '' : ''}
                  onToggleReaction={toggleReaction}
                  onOpenThread={openThread}
                  onTogglePin={handleTogglePin}
                  onStartEditing={startEditing}
                  onDeleteMessage={deleteMessage}
                  onSaveEdit={handleSaveEdit}
                  editingMessageId={editingMessageId}
                  editContent={editContent}
                  onEditContentChange={setEditContent}
                  onCancelEdit={cancelEdit}
                  onLoadMore={searchResults ? undefined : handleLoadMore}
                  hasMore={searchResults ? false : hasMore}
                  loadingMore={loadingMore}
                  isSearchActive={!!searchResults}
                  lastReadAt={lastReadAt}
                  scrollToBottomTrigger={scrollToBottomTrigger}
                />
                {!searchResults && (
                  <div className="flex-shrink-0 border-t border-border/15 bg-background/80 backdrop-blur-sm z-10">
                    {typingUsers.length > 0 && (
                      <div className="px-4 sm:px-5 pt-1.5 pb-0.5">
                        <span className="text-[10px] text-muted-foreground/60 font-medium italic animate-pulse">
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
                      members={members}
                      userId={user?.id}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Thread side panel — show full-screen on mobile */}
          <AnimatePresence>
            {threadParent && (
              <div className={cn("flex flex-col min-h-0", "w-full lg:w-auto")}>
                <ThreadPanel
                  parent={threadParent}
                  replies={threadMessages}
                  replyValue={threadReply}
                  onReplyChange={setThreadReply}
                  onSendReply={handleThreadReply}
                  onClose={() => { setThreadParent(null); const isDesktop = window.matchMedia('(min-width: 1024px)').matches; if (isDesktop) setTimeout(() => composerRef.current?.focus(), 100); }}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
