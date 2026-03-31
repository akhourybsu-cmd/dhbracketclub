import { useRef, useEffect, useCallback, useState, useLayoutEffect } from 'react';
import { MessageSquare, ChevronDown, SearchX } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageBubble } from './MessageBubble';
import { cn } from '@/lib/utils';
import type { Message, Channel } from './types';

interface MessageListProps {
  messages: Message[];
  selectedChannel: Channel | null;
  userId: string | undefined;
  currentDisplayName?: string;
  searchQuery: string;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onOpenThread: (msg: Message) => void;
  onTogglePin: (msg: Message) => void;
  onStartEditing: (msg: Message) => void;
  onDeleteMessage: (msgId: string) => void;
  onSaveEdit: (msgId: string, content: string) => void;
  editingMessageId: string | null;
  editContent: string;
  onEditContentChange: (content: string) => void;
  onCancelEdit: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  isSearchActive?: boolean;
  lastReadAt?: string | null;
  scrollToBottomTrigger?: number;
}

function getDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function MessageList({
  messages, selectedChannel, userId, currentDisplayName, searchQuery,
  onToggleReaction, onOpenThread, onTogglePin,
  onStartEditing, onDeleteMessage, onSaveEdit,
  editingMessageId, editContent, onEditContentChange, onCancelEdit,
  onLoadMore, hasMore, loadingMore, isSearchActive, lastReadAt,
  scrollToBottomTrigger,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const prevMsgCount = useRef(messages.length);

  // Reset auto-scroll when channel changes so we always land at the bottom
  useEffect(() => {
    setAutoScroll(true);
    setNewMsgCount(0);
    // Use a short delay to ensure messages have rendered before scrolling
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView();
    }, 50);
    return () => clearTimeout(t);
  }, [selectedChannel?.id]);

  // Scroll preservation on load-more (prepend)
  const prevScrollHeight = useRef<number | null>(null);

  // Capture scroll height before DOM update when loading more
  useEffect(() => {
    if (loadingMore && scrollRef.current) {
      prevScrollHeight.current = scrollRef.current.scrollHeight;
    }
  }, [loadingMore]);

  // After messages prepend, restore scroll position
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || prevScrollHeight.current === null) return;
    if (!loadingMore && messages.length > prevMsgCount.current) {
      const delta = el.scrollHeight - prevScrollHeight.current;
      if (delta > 0) {
        el.scrollTop += delta;
      }
      prevScrollHeight.current = null;
    }
  }, [messages, loadingMore]);

  // Auto scroll to bottom on new messages (only if user is near bottom)
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewMsgCount(0);
    } else if (messages.length > prevMsgCount.current && prevScrollHeight.current === null) {
      setNewMsgCount(prev => prev + (messages.length - prevMsgCount.current));
    }
    prevMsgCount.current = messages.length;
  }, [messages, autoScroll]);

  // When the container resizes (e.g. keyboard open/close changes parent height),
  // keep the last message visible by scrolling to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !autoScroll) return;

    const observer = new ResizeObserver(() => {
      if (autoScroll) {
        messagesEndRef.current?.scrollIntoView();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoScroll]);

  // Passive, RAF-throttled scroll handler
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!el) return;

        if (el.scrollTop < 80 && hasMore && !loadingMore && onLoadMore) {
          onLoadMore();
        }

        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        setAutoScroll(nearBottom);
        if (nearBottom) setNewMsgCount(0);
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [hasMore, loadingMore, onLoadMore]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
    setNewMsgCount(0);
  };

  const filtered = searchQuery
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  // Determine unread divider position
  const unreadDividerAfterIdx = (() => {
    if (!lastReadAt || isSearchActive) return -1;
    for (let i = filtered.length - 1; i >= 0; i--) {
      if (new Date(filtered[i].created_at) <= new Date(lastReadAt)) return i;
    }
    return -1;
  })();
  const hasUnreadDivider = unreadDividerAfterIdx >= 0 && unreadDividerAfterIdx < filtered.length - 1;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5 relative" style={{ minHeight: 0 }}>
      <div className="py-3 space-y-0.5">
        {loadingMore && (
          <div className="text-center py-2">
            <span className="text-[10px] text-muted-foreground/50 font-medium">Loading older messages…</span>
          </div>
        )}

        {/* Empty state for no messages */}
        {messages.length === 0 && !isSearchActive && (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.15))' }}>
              <MessageSquare className="w-6 h-6 text-muted-foreground/65" />
            </div>
            <p className="text-sm text-muted-foreground/60 font-medium">Welcome to #{selectedChannel?.name}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">{selectedChannel?.description || 'Start the conversation'}</p>
          </div>
        )}

        {/* Empty state for search with no results */}
        {isSearchActive && messages.length === 0 && (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.15))' }}>
              <SearchX className="w-6 h-6 text-muted-foreground/65" />
            </div>
            <p className="text-sm text-muted-foreground/60 font-medium">No messages found</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">Try a different search term</p>
          </div>
        )}

        {filtered.map((msg, idx) => {
          const prevMsg = idx > 0 ? filtered[idx - 1] : null;
          const nextMsg = idx < filtered.length - 1 ? filtered[idx + 1] : null;
          const showDate = !prevMsg || getDateLabel(msg.created_at) !== getDateLabel(prevMsg.created_at);
          // sameAuthor now also checks date boundary
          const sameAuthor = !!prevMsg && prevMsg.user_id === msg.user_id &&
            new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 300000 &&
            getDateLabel(msg.created_at) === getDateLabel(prevMsg.created_at);
          const nextSameAuthor = !!nextMsg && nextMsg.user_id === msg.user_id &&
            new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime() < 300000 &&
            getDateLabel(msg.created_at) === getDateLabel(nextMsg.created_at);

          return (
            <div key={msg.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 60px' }}>
              {showDate && (
                <div className="flex items-center gap-3 py-4">
                  <div className="flex-1 h-px bg-border/8" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70 px-2">{getDateLabel(msg.created_at)}</span>
                  <div className="flex-1 h-px bg-border/8" />
                </div>
              )}
              {/* New messages divider */}
              {hasUnreadDivider && idx === unreadDividerAfterIdx + 1 && (
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-destructive/30" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-destructive/70 px-2">New messages</span>
                  <div className="flex-1 h-px bg-destructive/30" />
                </div>
              )}
              <MessageBubble
                msg={msg}
                isOwn={msg.user_id === userId}
                sameAuthor={sameAuthor}
                nextSameAuthor={nextSameAuthor}
                currentUserId={userId}
                currentDisplayName={currentDisplayName}
                onToggleReaction={onToggleReaction}
                onOpenThread={onOpenThread}
                onTogglePin={onTogglePin}
                onStartEditing={onStartEditing}
                onDeleteMessage={onDeleteMessage}
                onSaveEdit={onSaveEdit}
                editingMessageId={editingMessageId}
                editContent={editContent}
                onEditContentChange={onEditContentChange}
                onCancelEdit={onCancelEdit}
              />
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom FAB */}
      <AnimatePresence>
        {!autoScroll && (
           <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={scrollToBottom}
            className="sticky bottom-3 ml-auto mr-3 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-20"
            style={{ touchAction: 'manipulation' }}
          >
            <ChevronDown className="w-5 h-5" />
            {newMsgCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1">
                {newMsgCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
