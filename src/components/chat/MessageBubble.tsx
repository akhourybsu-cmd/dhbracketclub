import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Pin, Reply, SmilePlus, Trash2, Pencil, Check, X, MessageSquare,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UserAvatar } from './UserAvatar';
import type { Message } from './types';
import { QUICK_EMOJIS } from './types';

interface MessageBubbleProps {
  msg: Message;
  isOwn: boolean;
  sameAuthor: boolean;
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
}

export function MessageBubble({
  msg, isOwn, sameAuthor,
  onToggleReaction, onOpenThread, onTogglePin,
  onStartEditing, onDeleteMessage, onSaveEdit,
  editingMessageId, editContent, onEditContentChange, onCancelEdit,
}: MessageBubbleProps) {
  const [reactionOpen, setReactionOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMobileActions, setShowMobileActions] = useState(false);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setShowMobileActions(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  return (
    <div
      className={cn(
        "group relative px-2.5 py-1.5 -mx-2.5 rounded-xl transition-colors",
        "hover:bg-muted/12",
        sameAuthor ? "mt-0" : "mt-3",
        msg._optimistic && "opacity-60"
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {/* Author line */}
      {!sameAuthor && (
        <div className="flex items-center gap-2 mb-1">
          <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} size={30} />
          <span className="text-[12px] font-bold text-foreground/90">{msg.profiles?.display_name || 'Unknown'}</span>
          <span className="text-[9px] text-muted-foreground/70 font-medium">{format(new Date(msg.created_at), 'h:mm a')}</span>
          {msg.is_pinned && <Pin className="w-2.5 h-2.5" style={{ color: 'hsl(var(--premium-warm) / 0.7)' }} />}
        </div>
      )}

      <div className={cn("relative", !sameAuthor && "pl-[38px]")}>
        {sameAuthor && (
          <span className="absolute -left-0.5 top-0.5 text-[8px] text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors font-mono">
            {format(new Date(msg.created_at), 'h:mm')}
          </span>
        )}

        {editingMessageId === msg.id ? (
          <div className="flex items-center gap-2">
            <Input
              value={editContent}
              onChange={e => onEditContentChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onSaveEdit(msg.id, editContent);
                if (e.key === 'Escape') onCancelEdit();
              }}
              className="h-8 text-[13px] bg-muted/20 border-border/25 rounded-lg flex-1"
              autoFocus
            />
            <button onClick={() => onSaveEdit(msg.id, editContent)} className="p-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={onCancelEdit} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground/70" />
            </button>
          </div>
        ) : (
          <p className="text-[13px] leading-[1.55] text-foreground/85 break-words">
            {msg.content}
            {msg.edited_at && <span className="text-[9px] text-muted-foreground/70 ml-1.5">(edited)</span>}
          </p>
        )}

        {/* Reactions row */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {msg.reactions.map(r => (
              <button
                key={r.emoji}
                onClick={() => onToggleReaction(msg.id, r.emoji)}
                className={cn(
                  "inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[11px] border transition-all duration-150",
                  r.user_reacted
                    ? "border-primary/25 bg-primary/8 text-primary scale-[1.02]"
                    : "border-border/15 bg-muted/20 text-muted-foreground/70 hover:border-border/30 hover:bg-muted/35"
                )}
              >
                {r.emoji} <span className="font-bold text-[10px]">{r.count}</span>
              </button>
            ))}
            <button
              onClick={() => setReactionOpen(!reactionOpen)}
              className="w-6 h-6 rounded-md border border-border/25 bg-muted/10 flex items-center justify-center hover:bg-muted/50 transition-colors"
            >
              <SmilePlus className="w-3 h-3 text-muted-foreground/70" />
            </button>
          </div>
        )}

        {/* Floating action bar (desktop hover) */}
        <div className="absolute -top-4 right-0 hidden group-hover:flex items-center gap-0.5 bg-surface-elevated/95 border border-border/15 rounded-lg px-0.5 py-0.5 shadow-xl backdrop-blur-sm z-10">
          {QUICK_EMOJIS.slice(0, 4).map(emoji => (
            <button key={emoji} onClick={() => onToggleReaction(msg.id, emoji)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 text-sm transition-colors">
              {emoji}
            </button>
          ))}
          <div className="w-px h-4 bg-border/15 mx-0.5" />
          <button onClick={() => onOpenThread(msg)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors" title="Reply in thread">
            <Reply className="w-3.5 h-3.5 text-muted-foreground/70" />
          </button>
          <button onClick={() => onTogglePin(msg)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors" title={msg.is_pinned ? 'Unpin' : 'Pin'}>
            <Pin className={cn("w-3.5 h-3.5", msg.is_pinned ? "text-premium-warm" : "text-muted-foreground/60")} />
          </button>
          {isOwn && (
            <>
              <button onClick={() => onStartEditing(msg)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors" title="Edit">
                <Pencil className="w-3.5 h-3.5 text-muted-foreground/60" />
              </button>
              <button onClick={() => onDeleteMessage(msg.id)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors" title="Delete">
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-destructive" />
              </button>
            </>
          )}
        </div>

        {/* Mobile long-press action sheet */}
        <AnimatePresence>
          {showMobileActions && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMobileActions(false)} />
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute left-0 right-0 -bottom-2 translate-y-full bg-surface-elevated border border-border/15 rounded-xl p-2 shadow-xl z-50"
              >
                <div className="flex items-center gap-0.5 mb-2 px-1">
                  {QUICK_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => { onToggleReaction(msg.id, emoji); setShowMobileActions(false); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 text-base transition-colors active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="space-y-0.5">
                  <button onClick={() => { onOpenThread(msg); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 text-left text-xs font-medium text-foreground/80">
                    <Reply className="w-3.5 h-3.5 text-muted-foreground/70" /> Reply in thread
                  </button>
                  <button onClick={() => { onTogglePin(msg); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 text-left text-xs font-medium text-foreground/80">
                    <Pin className="w-3.5 h-3.5 text-muted-foreground/70" /> {msg.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                  {isOwn && (
                    <>
                      <button onClick={() => { onStartEditing(msg); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 text-left text-xs font-medium text-foreground/80">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground/70" /> Edit
                      </button>
                      <button onClick={() => { onDeleteMessage(msg.id); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-destructive/10 text-left text-xs font-medium text-destructive">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Reaction picker (inline) */}
        <AnimatePresence>
          {reactionOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              className="flex items-center gap-0.5 mt-2 bg-surface-elevated border border-border/15 rounded-xl px-1.5 py-1.5 shadow-xl w-fit"
            >
              {QUICK_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => { onToggleReaction(msg.id, emoji); setReactionOpen(false); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 text-base transition-colors active:scale-90">
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thread indicator */}
        {(msg.reply_count || 0) > 0 && (
          <button
            onClick={() => onOpenThread(msg)}
            className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            {msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>
    </div>
  );
}
