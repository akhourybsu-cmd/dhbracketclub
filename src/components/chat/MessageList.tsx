import { useRef, useEffect, useCallback, useState } from 'react';
import { MessageSquare, ChevronDown, SearchX } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageBubble } from './MessageBubble';
import { cn } from '@/lib/utils';
import type { Message, Channel } from './types';

interface MessageListProps {
  messages: Message[];
  selectedChannel: Channel | null;
  userId: string | undefined;
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
  messages, selectedChannel, userId, searchQuery,
  onToggleReaction, onOpenThread, onTogglePin,
  onStartEditing, onDeleteMessage, onSaveEdit,
  editingMessageId, editContent, onEditContentChange, onCancelEdit,
  onLoadMore, hasMore, loadingMore, isSearchActive,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const prevMsgCount = useRef(messages.length);

  // Auto scroll to bottom on new messages (only if user is near bottom)
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewMsgCount(0);
    } else if (messages.length > prevMsgCount.current) {
      setNewMsgCount(prev => prev + (messages.length - prevMsgCount.current));
    }
    prevMsgCount.current = messages.length;
  }, [messages, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (el.scrollTop < 80 && hasMore && !loadingMore && onLoadMore) {
      onLoadMore();
    }

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setAutoScroll(nearBottom);
    if (nearBottom) setNewMsgCount(0);
  }, [hasMore, loadingMore, onLoadMore]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
    setNewMsgCount(0);
  };

  const filtered = searchQuery
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5 relative">
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
          const sameAuthor = !!prevMsg && prevMsg.user_id === msg.user_id &&
            new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 300000;
          const nextSameAuthor = !!nextMsg && nextMsg.user_id === msg.user_id &&
            new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime() < 300000 &&
            getDateLabel(msg.created_at) === getDateLabel(nextMsg.created_at);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-3 py-4">
                  <div className="flex-1 h-px bg-border/8" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70 px-2">{getDateLabel(msg.created_at)}</span>
                  <div className="flex-1 h-px bg-border/8" />
                </div>
              )}
              <MessageBubble
                msg={msg}
                isOwn={msg.user_id === userId}
                sameAuthor={sameAuthor}
                nextSameAuthor={nextSameAuthor}
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
            className="sticky bottom-4 left-1/2 -translate-x-1/2 mx-auto block w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-20"
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
