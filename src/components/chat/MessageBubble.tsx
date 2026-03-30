import { useState, useRef, useCallback, useEffect, Fragment, memo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Pin, Reply, SmilePlus, Trash2, Pencil, Check, X, MessageSquare, Loader2,
} from 'lucide-react';
import { UserAvatar, getUserColor } from './UserAvatar';
import type { Message } from './types';
import { QUICK_EMOJIS } from './types';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/* ═══ URL auto-linking + inline image preview ═══ */
const URL_RE = /(https?:\/\/[^\s<]+)/g;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i;

const MENTION_RE = /@([\w\s]+?)(?=\s@|\s|$)/g;

function renderContent(text: string, currentUserId?: string, currentDisplayName?: string) {
  // First split by URLs
  const urlParts = text.split(URL_RE);
  if (urlParts.length === 1) return renderMentions(text, currentDisplayName);
  return urlParts.map((part, i) =>
    URL_RE.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
        onClick={e => e.stopPropagation()}>{part}</a>
    ) : (
      <Fragment key={i}>{renderMentions(part, currentDisplayName, i)}</Fragment>
    )
  );
}

function renderMentions(text: string, currentDisplayName?: string, keyPrefix: number = 0): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const mentionName = match[1].trim();
    const isCurrentUser = currentDisplayName && mentionName.toLowerCase() === currentDisplayName.toLowerCase();
    parts.push(
      <span
        key={`${keyPrefix}-mention-${match.index}`}
        className={cn(
          "inline-block rounded px-1 py-0.5 font-semibold text-[12px]",
          isCurrentUser
            ? "bg-primary/20 text-primary"
            : "bg-primary/10 text-primary/80"
        )}
      >
        @{mentionName}
      </span>
    );
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function extractImageUrls(text: string): string[] {
  const matches = text.match(URL_RE);
  if (!matches) return [];
  return matches.filter(url => IMAGE_EXT_RE.test(url));
}

interface MessageBubbleProps {
  msg: Message;
  isOwn: boolean;
  sameAuthor: boolean;
  nextSameAuthor?: boolean;
  currentUserId?: string;
  currentDisplayName?: string;
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

const SWIPE_THRESHOLD = 60;

function MessageBubbleInner({
  msg, isOwn, sameAuthor, nextSameAuthor,
  currentUserId, currentDisplayName,
  onToggleReaction, onOpenThread, onTogglePin,
  onStartEditing, onDeleteMessage, onSaveEdit,
  editingMessageId, editContent, onEditContentChange, onCancelEdit,
}: MessageBubbleProps) {
  const [reactionOpen, setReactionOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const reactionRef = useRef<HTMLDivElement>(null);

  // Swipe-to-reply
  const dragX = useMotionValue(0);
  const replyIconOpacity = useTransform(dragX, [0, SWIPE_THRESHOLD], [0, 1]);
  const replyIconScale = useTransform(dragX, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const [swiped, setSwiped] = useState(false);

  // Auto-resize edit textarea
  useEffect(() => {
    const el = editRef.current;
    if (!el || editingMessageId !== msg.id) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [editContent, editingMessageId, msg.id]);

  // Close reaction picker on outside click / Escape
  useEffect(() => {
    if (!reactionOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (reactionRef.current && !reactionRef.current.contains(e.target as Node)) {
        setReactionOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReactionOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [reactionOpen]);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      navigator.vibrate?.(10);
      setShowMobileActions(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleTapTimestamp = useCallback(() => {
    if (sameAuthor) setShowTimestamp(prev => !prev);
  }, [sameAuthor]);

  const handleReaction = useCallback((emoji: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onToggleReaction(msg.id, emoji);
    setReactionOpen(false);
    setShowMobileActions(false);
  }, [msg.id, onToggleReaction]);

  const confirmDelete = () => {
    onDeleteMessage(msg.id);
    setShowDeleteConfirm(false);
    setShowMobileActions(false);
  };

  const showGroupedAvatar = sameAuthor && !nextSameAuthor;

  const imageUrls = extractImageUrls(msg.content);

  return (
    <>
      <motion.div
        className={cn(
          "group relative py-1.5 rounded-xl transition-colors",
          "hover:bg-muted/12",
          sameAuthor ? "mt-0" : "mt-3",
          isOwn && "bg-primary/[0.04]",
          msg._optimistic && "opacity-70"
        )}
        style={{
          borderLeft: `3px solid ${getUserColor(msg.user_id)}`,
          paddingLeft: '10px',
          paddingRight: '10px',
          x: dragX,
        }}
        drag="x"
        dragConstraints={{ left: 0, right: SWIPE_THRESHOLD + 10 }}
        dragElastic={0.15}
        dragSnapToOrigin
        onDrag={(_, info) => {
          if (info.offset.x > SWIPE_THRESHOLD && !swiped) {
            setSwiped(true);
            navigator.vibrate?.(10);
          }
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x > SWIPE_THRESHOLD) {
            onOpenThread(msg);
          }
          setSwiped(false);
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onClick={handleTapTimestamp}
      >
        {/* Swipe reply icon (behind the message) */}
        <motion.div
          className="absolute left-[-32px] top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center pointer-events-none"
          style={{ opacity: replyIconOpacity, scale: replyIconScale }}
        >
          <Reply className="w-3.5 h-3.5 text-primary" />
        </motion.div>

        {/* Author line */}
        {!sameAuthor && (
          <div className="flex items-center gap-2 mb-1">
            <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} avatarUrl={msg.profiles?.avatar_url} size={30} />
            <span className="text-[12px] font-bold" style={{ color: getUserColor(msg.user_id) }}>{msg.profiles?.display_name || 'Unknown'}</span>
            <span className="text-[9px] text-muted-foreground/70 font-medium">{format(new Date(msg.created_at), 'h:mm a')}</span>
            {msg.is_pinned && <Pin className="w-2.5 h-2.5" style={{ color: 'hsl(var(--premium-warm) / 0.7)' }} />}
          </div>
        )}

        {/* Content area */}
        <div className="relative pl-[38px]">
          {sameAuthor && (
            <div className="absolute left-0 top-0.5 flex items-center gap-1">
              {showGroupedAvatar ? (
                <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} avatarUrl={msg.profiles?.avatar_url} size={18} />
              ) : (
                <div className="w-[18px]" />
              )}
              <span className={cn(
                "text-[8px] font-mono transition-colors",
                showTimestamp ? "text-muted-foreground/70" : "text-muted-foreground/0 group-hover:text-muted-foreground/70"
              )}>
                {format(new Date(msg.created_at), 'h:mm')}
              </span>
            </div>
          )}

          {editingMessageId === msg.id ? (
            <div className="flex items-start gap-2">
              <textarea
                ref={editRef}
                value={editContent}
                onChange={e => onEditContentChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveEdit(msg.id, editContent); }
                  if (e.key === 'Escape') onCancelEdit();
                }}
                className="flex-1 resize-none text-[13px] bg-muted/20 border border-border/25 rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
                rows={1}
                autoFocus
                style={{ minHeight: 32, maxHeight: 120 }}
              />
              <button onClick={() => onSaveEdit(msg.id, editContent)} className="p-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={onCancelEdit} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors mt-0.5">
                <X className="w-3.5 h-3.5 text-muted-foreground/70" />
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[13px] leading-[1.55] text-foreground/85 break-words whitespace-pre-wrap">
                {renderContent(msg.content, currentUserId, currentDisplayName)}
                {msg.edited_at && <span className="text-[9px] text-muted-foreground/70 ml-1.5">(edited)</span>}
              </p>
              {/* Inline image previews */}
              {imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {imageUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                      <img
                        src={url}
                        alt="Shared image"
                        className="rounded-lg max-w-[240px] max-h-[180px] object-cover border border-border/15"
                        loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </a>
                  ))}
                </div>
              )}
              {msg._optimistic && (
                <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] text-muted-foreground/50 font-medium">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Sending…
                </span>
              )}
            </div>
          )}

          {/* Reactions row */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {msg.reactions.map(r => (
                <button
                  key={r.emoji}
                  onClick={(e) => { e.stopPropagation(); handleReaction(r.emoji); }}
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
                onClick={(e) => { e.stopPropagation(); setReactionOpen(!reactionOpen); }}
                className="w-6 h-6 rounded-md border border-border/25 bg-muted/10 flex items-center justify-center hover:bg-muted/50 transition-colors"
              >
                <SmilePlus className="w-3 h-3 text-muted-foreground/70" />
              </button>
            </div>
          )}

          {/* Floating action bar (desktop hover) */}
          <div className="absolute -top-4 right-2 hidden group-hover:flex items-center gap-0.5 bg-surface-elevated/95 border border-border/15 rounded-lg px-0.5 py-0.5 shadow-xl backdrop-blur-sm z-30">
            {QUICK_EMOJIS.slice(0, 4).map(emoji => (
              <button key={emoji} onClick={(e) => handleReaction(emoji, e)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 text-sm transition-colors">
                {emoji}
              </button>
            ))}
            <div className="w-px h-4 bg-border/15 mx-0.5" />
            <button onClick={(e) => { e.stopPropagation(); onOpenThread(msg); }} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors" title="Reply in thread">
              <Reply className="w-3.5 h-3.5 text-muted-foreground/70" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onTogglePin(msg); }} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors" title={msg.is_pinned ? 'Unpin' : 'Pin'}>
              <Pin className={cn("w-3.5 h-3.5", msg.is_pinned ? "text-premium-warm" : "text-muted-foreground/60")} />
            </button>
            {isOwn && (
              <>
                <button onClick={(e) => { e.stopPropagation(); onStartEditing(msg); }} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors" title="Edit">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground/60" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors" title="Delete">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-destructive" />
                </button>
              </>
            )}
          </div>

          {/* Mobile long-press action sheet */}
          <AnimatePresence>
            {showMobileActions && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/30 z-40"
                  onClick={() => setShowMobileActions(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/15 rounded-t-2xl p-4 shadow-2xl z-50"
                  style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
                >
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-3" />
                  <div className="flex items-center gap-1 mb-3 px-1 overflow-x-auto">
                    {QUICK_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted/50 text-lg transition-colors active:scale-90 flex-shrink-0"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-0.5">
                    <button onClick={() => { onOpenThread(msg); setShowMobileActions(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 text-left text-sm font-medium text-foreground/80 active:bg-muted/70">
                      <Reply className="w-4 h-4 text-muted-foreground/70" /> Reply in thread
                    </button>
                    <button onClick={() => { onTogglePin(msg); setShowMobileActions(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 text-left text-sm font-medium text-foreground/80 active:bg-muted/70">
                      <Pin className="w-4 h-4 text-muted-foreground/70" /> {msg.is_pinned ? 'Unpin' : 'Pin'}
                    </button>
                    {isOwn && (
                      <>
                        <button onClick={() => { onStartEditing(msg); setShowMobileActions(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 text-left text-sm font-medium text-foreground/80 active:bg-muted/70">
                          <Pencil className="w-4 h-4 text-muted-foreground/70" /> Edit
                        </button>
                        <button onClick={() => { setShowDeleteConfirm(true); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 text-left text-sm font-medium text-destructive active:bg-destructive/20">
                          <Trash2 className="w-4 h-4" /> Delete
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
                ref={reactionRef}
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className="flex items-center gap-0.5 mt-2 bg-surface-elevated border border-border/15 rounded-xl px-1.5 py-1.5 shadow-xl w-fit z-30 relative"
              >
                {QUICK_EMOJIS.map(emoji => (
                  <button key={emoji} onClick={(e) => handleReaction(emoji, e)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 text-base transition-colors active:scale-90">
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Thread indicator */}
          {(msg.reply_count || 0) > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenThread(msg); }}
              className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              {msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      </motion.div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The message and its replies will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  return (
    prev.msg.id === next.msg.id &&
    prev.msg.content === next.msg.content &&
    prev.msg.edited_at === next.msg.edited_at &&
    prev.msg.is_pinned === next.msg.is_pinned &&
    prev.msg.reply_count === next.msg.reply_count &&
    prev.msg._optimistic === next.msg._optimistic &&
    prev.isOwn === next.isOwn &&
    prev.sameAuthor === next.sameAuthor &&
    prev.nextSameAuthor === next.nextSameAuthor &&
    prev.editingMessageId === next.editingMessageId &&
    prev.editContent === next.editContent &&
    JSON.stringify(prev.msg.reactions) === JSON.stringify(next.msg.reactions)
  );
});
