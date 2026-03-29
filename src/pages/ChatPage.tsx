import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash, Send, Plus, ChevronLeft, Pin, MessageSquare, SmilePlus, Reply,
  Settings, Search, X
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { useSoundEffect } from '@/hooks/useSoundEffect';

type Channel = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category_id: string | null;
  position: number;
  is_default: boolean;
};

type Category = {
  id: string;
  name: string;
  position: number;
};

type Message = {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  parent_message_id: string | null;
  is_pinned: boolean;
  created_at: string;
  edited_at: string | null;
  profiles?: { display_name: string; avatar_url: string | null };
  reply_count?: number;
  reactions?: { emoji: string; count: number; user_reacted: boolean }[];
};

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '💀', '👀'];

export default function ChatPage() {
  const { user } = useAuth();
  const { play } = useSoundEffect();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showChannelList, setShowChannelList] = useState(true);
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadReply, setThreadReply] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Fetch channels
  useEffect(() => {
    const fetchChannels = async () => {
      const [{ data: cats }, { data: chs }] = await Promise.all([
        supabase.from('channel_categories').select('*').order('position'),
        supabase.from('channels').select('*').order('position'),
      ]);
      if (cats) setCategories(cats);
      if (chs) {
        setChannels(chs as Channel[]);
        if (chs.length > 0 && !selectedChannel) {
          const def = chs.find((c: any) => c.is_default) || chs[0];
          setSelectedChannel(def as Channel);
          setShowChannelList(false);
        }
      }
      setLoading(false);
    };
    fetchChannels();
  }, []);

  // Fetch messages when channel changes
  useEffect(() => {
    if (!selectedChannel) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('channel_id', selectedChannel.id)
        .is('parent_message_id', null)
        .order('created_at', { ascending: true })
        .limit(100);

      if (data) {
        // Get reply counts
        const msgIds = data.map(m => m.id);
        let replyCounts = new Map<string, number>();
        if (msgIds.length > 0) {
          const { data: replies } = await supabase
            .from('messages')
            .select('parent_message_id')
            .in('parent_message_id', msgIds);
          if (replies) {
            replies.forEach(r => {
              replyCounts.set(r.parent_message_id!, (replyCounts.get(r.parent_message_id!) || 0) + 1);
            });
          }
        }

        // Get reactions
        let reactionsMap = new Map<string, { emoji: string; count: number; user_reacted: boolean }[]>();
        if (msgIds.length > 0) {
          const { data: rxns } = await supabase
            .from('message_reactions')
            .select('*')
            .in('message_id', msgIds);
          if (rxns) {
            const grouped = new Map<string, Map<string, { count: number; userReacted: boolean }>>();
            rxns.forEach(r => {
              if (!grouped.has(r.message_id)) grouped.set(r.message_id, new Map());
              const emojiMap = grouped.get(r.message_id)!;
              if (!emojiMap.has(r.emoji)) emojiMap.set(r.emoji, { count: 0, userReacted: false });
              const entry = emojiMap.get(r.emoji)!;
              entry.count++;
              if (r.user_id === user?.id) entry.userReacted = true;
            });
            grouped.forEach((emojiMap, msgId) => {
              reactionsMap.set(msgId, Array.from(emojiMap.entries()).map(([emoji, v]) => ({
                emoji, count: v.count, user_reacted: v.userReacted
              })));
            });
          }
        }

        setMessages(data.map(m => ({
          ...m,
          reply_count: replyCounts.get(m.id) || 0,
          reactions: reactionsMap.get(m.id) || [],
        })));
      }
    };
    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`chat-${selectedChannel.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${selectedChannel.id}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as any;
          if (newMsg.parent_message_id) {
            // Thread reply
            if (threadParent && newMsg.parent_message_id === threadParent.id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('id', newMsg.user_id)
                .single();
              setThreadMessages(prev => [...prev, { ...newMsg, profiles: profile }]);
            }
            // Update reply count
            setMessages(prev => prev.map(m =>
              m.id === newMsg.parent_message_id
                ? { ...m, reply_count: (m.reply_count || 0) + 1 }
                : m
            ));
            return;
          }
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', newMsg.user_id)
            .single();
          setMessages(prev => [...prev, { ...newMsg, profiles: profile, reply_count: 0, reactions: [] }]);
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, () => {
        // Refetch reactions simply
        fetchMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChannel, user?.id, threadParent]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChannel || !user) return;
    play('tap');
    const content = newMessage.trim();
    setNewMessage('');
    await supabase.from('messages').insert({
      channel_id: selectedChannel.id,
      user_id: user.id,
      content,
    });
  };

  // Open thread
  const openThread = async (msg: Message) => {
    setThreadParent(msg);
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('parent_message_id', msg.id)
      .order('created_at', { ascending: true });
    setThreadMessages(data || []);
  };

  // Send thread reply
  const handleThreadReply = async () => {
    if (!threadReply.trim() || !threadParent || !user || !selectedChannel) return;
    play('tap');
    const content = threadReply.trim();
    setThreadReply('');
    await supabase.from('messages').insert({
      channel_id: selectedChannel.id,
      user_id: user.id,
      content,
      parent_message_id: threadParent.id,
    });
  };

  // Toggle reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    play('tap');
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
      await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }
  };

  // Create channel
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
    // Refetch
    const { data } = await supabase.from('channels').select('*').order('position');
    if (data) setChannels(data as Channel[]);
  };

  // Date separator helper
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
  const uncategorized = channels.filter(ch => !ch.category_id);

  // ═══ CHANNEL LIST VIEW ═══
  if (showChannelList && !selectedChannel) {
    return (
      <div className="pb-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-extrabold tracking-tight">Chat</h1>
            <Button size="sm" variant="ghost" onClick={() => setShowNewChannel(true)} className="h-8 w-8 p-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* New channel form */}
          <AnimatePresence>
            {showNewChannel && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                <div className="glass-card p-4 space-y-3">
                  <Input
                    placeholder="channel-name"
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <select
                    value={newChannelCategory}
                    onChange={e => setNewChannelCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreateChannel} className="flex-1 h-8 text-xs">Create</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewChannel(false)} className="h-8 text-xs">Cancel</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Channel list */}
          <div className="space-y-5">
            {groupedChannels.map(group => (
              group.channels.length > 0 && (
                <div key={group.id}>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-2 px-1">{group.name}</p>
                  <div className="space-y-0.5">
                    {group.channels.map(ch => (
                      <button
                        key={ch.id}
                        onClick={() => { setSelectedChannel(ch); setShowChannelList(false); play('tap'); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-muted/50 active:bg-muted/70 group"
                      >
                        <Hash className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary/60 transition-colors" />
                        <span className="text-[13px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors">{ch.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            ))}
            {uncategorized.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-2 px-1">Other</p>
                <div className="space-y-0.5">
                  {uncategorized.map(ch => (
                    <button
                      key={ch.id}
                      onClick={() => { setSelectedChannel(ch); setShowChannelList(false); play('tap'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-muted/50"
                    >
                      <Hash className="w-4 h-4 text-muted-foreground/50" />
                      <span className="text-[13px] font-semibold text-foreground/80">{ch.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {channels.length === 0 && !loading && (
            <div className="text-center py-16">
              <Hash className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground/60 font-medium">No channels yet</p>
              <p className="text-xs text-muted-foreground/40 mt-1">Create one to start chatting</p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ═══ MESSAGE VIEW ═══
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Channel header */}
      <div className="flex items-center gap-2 pb-3 border-b border-border/10 mb-1 flex-shrink-0">
        <button onClick={() => { setSelectedChannel(null); setShowChannelList(true); setThreadParent(null); }} className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted/50 transition-colors">
          <ChevronLeft className="w-4.5 h-4.5 text-muted-foreground" />
        </button>
        <Hash className="w-4 h-4 text-primary/60" />
        <h2 className="font-bold text-[15px] tracking-tight flex-1">{selectedChannel?.name}</h2>
      </div>

      <div className="flex flex-1 min-h-0 gap-0">
        {/* Messages column */}
        <div className={cn("flex flex-col flex-1 min-w-0", threadParent && "hidden lg:flex")}>
          <ScrollArea className="flex-1 -mx-4 px-4">
            <div className="py-3 space-y-0.5">
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/15 mb-2" />
                  <p className="text-xs text-muted-foreground/40">No messages yet. Say something!</p>
                </div>
              )}
              {messages.map((msg, idx) => {
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const showDate = !prevMsg || getDateLabel(msg.created_at) !== getDateLabel(prevMsg.created_at);
                const sameAuthor = prevMsg && prevMsg.user_id === msg.user_id &&
                  new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 300000;

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex items-center gap-3 py-3">
                        <div className="flex-1 h-px bg-border/10" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">{getDateLabel(msg.created_at)}</span>
                        <div className="flex-1 h-px bg-border/10" />
                      </div>
                    )}
                    <div className={cn("group px-2 py-1 -mx-2 rounded-lg hover:bg-muted/20 transition-colors", sameAuthor ? "mt-0" : "mt-2.5")}>
                      {!sameAuthor && (
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{
                            background: `linear-gradient(135deg, hsl(${msg.user_id.charCodeAt(0) % 360} 60% 45%), hsl(${msg.user_id.charCodeAt(1) % 360} 50% 35%))`,
                          }}>
                            {(msg.profiles?.display_name || '?')[0].toUpperCase()}
                          </div>
                          <span className="text-[12px] font-bold text-foreground/90">{msg.profiles?.display_name || 'Unknown'}</span>
                          <span className="text-[9px] text-muted-foreground/30 font-medium">{format(new Date(msg.created_at), 'h:mm a')}</span>
                          {msg.is_pinned && <Pin className="w-2.5 h-2.5 text-premium-warm" />}
                        </div>
                      )}
                      <div className={cn("relative", !sameAuthor && "pl-9")}>
                        <p className="text-[13px] leading-relaxed text-foreground/85">{msg.content}</p>

                        {/* Reactions */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {msg.reactions.map(r => (
                              <button
                                key={r.emoji}
                                onClick={() => toggleReaction(msg.id, r.emoji)}
                                className={cn(
                                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] border transition-colors",
                                  r.user_reacted
                                    ? "border-primary/30 bg-primary/10 text-primary"
                                    : "border-border/20 bg-muted/30 text-muted-foreground/60 hover:border-border/40"
                                )}
                              >
                                {r.emoji} <span className="font-semibold">{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Actions (visible on hover) */}
                        <div className="absolute -top-3 right-0 hidden group-hover:flex items-center gap-0.5 bg-surface-elevated border border-border/20 rounded-lg px-1 py-0.5 shadow-lg">
                          {QUICK_EMOJIS.slice(0, 3).map(emoji => (
                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted/50 text-xs transition-colors">
                              {emoji}
                            </button>
                          ))}
                          <button onClick={() => openThread(msg)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted/50 transition-colors">
                            <Reply className="w-3 h-3 text-muted-foreground/60" />
                          </button>
                        </div>

                        {/* Thread indicator */}
                        {(msg.reply_count || 0) > 0 && (
                          <button
                            onClick={() => openThread(msg)}
                            className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-primary/70 hover:text-primary transition-colors"
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
          </ScrollArea>

          {/* Composer */}
          <div className="pt-2 pb-1 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={`Message #${selectedChannel?.name || ''}`}
                className="flex-1 h-10 text-sm bg-muted/30 border-border/10 focus-visible:ring-primary/30"
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!newMessage.trim()}
                className="h-10 w-10 p-0 rounded-xl"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Thread panel */}
        <AnimatePresence>
          {threadParent && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                "flex flex-col min-h-0",
                "w-full lg:w-80 lg:ml-3 lg:pl-3 lg:border-l lg:border-border/10"
              )}
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/10 mb-2 flex-shrink-0">
                <h3 className="text-[13px] font-bold">Thread</h3>
                <button onClick={() => setThreadParent(null)} className="p-1 rounded-lg hover:bg-muted/50">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* Parent message */}
              <div className="px-2 py-2 bg-muted/10 rounded-lg mb-2 flex-shrink-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[11px] font-bold text-foreground/80">{threadParent.profiles?.display_name}</span>
                  <span className="text-[9px] text-muted-foreground/30">{format(new Date(threadParent.created_at), 'h:mm a')}</span>
                </div>
                <p className="text-[12px] text-foreground/70 leading-relaxed">{threadParent.content}</p>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-2 py-1">
                  {threadMessages.map(msg => (
                    <div key={msg.id} className="px-2 py-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{
                          background: `linear-gradient(135deg, hsl(${msg.user_id.charCodeAt(0) % 360} 60% 45%), hsl(${msg.user_id.charCodeAt(1) % 360} 50% 35%))`,
                        }}>
                          {(msg.profiles?.display_name || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-[11px] font-bold text-foreground/80">{msg.profiles?.display_name}</span>
                        <span className="text-[9px] text-muted-foreground/30">{format(new Date(msg.created_at), 'h:mm a')}</span>
                      </div>
                      <p className="text-[12px] text-foreground/80 pl-[26px] leading-relaxed">{msg.content}</p>
                    </div>
                  ))}
                  <div ref={threadEndRef} />
                </div>
              </ScrollArea>

              <div className="pt-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    value={threadReply}
                    onChange={e => setThreadReply(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleThreadReply()}
                    placeholder="Reply..."
                    className="flex-1 h-9 text-xs bg-muted/30 border-border/10"
                  />
                  <Button size="sm" onClick={handleThreadReply} disabled={!threadReply.trim()} className="h-9 w-9 p-0 rounded-xl">
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
