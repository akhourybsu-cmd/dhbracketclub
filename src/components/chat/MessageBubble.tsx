import { useState, useRef, useCallback, useEffect, Fragment, memo, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Pin, Reply, Trash2, Pencil, Check, X, MessageSquare, Loader2,
} from 'lucide-react';
import { UserAvatar, getUserColor } from './UserAvatar';
import type { Message } from './types';
import { QUICK_EMOJIS } from './types';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { parseMessageLinks } from '@/lib/linkParser';
import { LinkPreviewCard } from './LinkPreviewCard';

/* ═══ URL auto-linking + inline image preview ═══ */
const URL_RE = /(https?:\/\/[^\s<]+)/g;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i;
const STORAGE_IMAGE_RE = /\/storage\/v1\/object\/public\/chat-attachments\//i;

function isImageUrl(url: string): boolean {
  return IMAGE_EXT_RE.test(url) || STORAGE_IMAGE_RE.test(url);
}

/** Remove image URLs from text so they only show as visual previews */
function stripImageUrls(text: string): string {
  return text.replace(URL_RE, match => isImageUrl(match) ? '' : match).replace(/\n{2,}/g, '\n').trim();
}

const MENTION_RE = /@([\w\s]+?)(?=\s@|\s|$)/g;

function renderContent(text: string, currentUserId?: string, currentDisplayName?: string) {
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
  return matches.filter(isImageUrl);
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
  const [showOverlay, setShowOverlay] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

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

  // Close overlay on Escape
  useEffect(() => {
    if (!showOverlay) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowOverlay(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showOverlay]);

  const isBeingEdited = editingMessageId === msg.id;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isBeingEdited) return;
    e.preventDefault();
    setShowOverlay(true);
  }, [isBeingEdited]);

  const handleTap = useCallback(() => {
    if (isBeingEdited) return;
    setShowOverlay(prev => !prev);
  }, [isBeingEdited]);

  const handleReaction = useCallback((emoji: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onToggleReaction(msg.id, emoji);
    setShowOverlay(false);
  }, [msg.id, onToggleReaction]);

  const confirmDelete = () => {
    onDeleteMessage(msg.id);
    setShowDeleteConfirm(false);
    setShowOverlay(false);
  };

  const showGroupedAvatar = sameAuthor && !nextSameAuthor;

  const imageUrls = extractImageUrls(msg.content);
  const parsedLinks = useMemo(() => parseMessageLinks(msg.content), [msg.content]);
  const previewLinks = parsedLinks.filter(l => l.contentType !== 'image');

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
        drag={isBeingEdited ? false : "x"}
        dragDirectionLock
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
        onContextMenu={handleContextMenu}
        onClick={handleTap}
      >
        {/* Swipe reply icon */}
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center pointer-events-none"
          style={{ opacity: replyIconOpacity, scale: replyIconScale }}
        >
          <Reply className="w-3 h-3 text-primary" />
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
              <p className={cn("text-[13px] leading-[1.55] text-foreground/85 break-words whitespace-pre-wrap", imageUrls.length > 0 && !stripImageUrls(msg.content) && "hidden")}>
                {renderContent(stripImageUrls(msg.content), currentUserId, currentDisplayName)}
                {msg.edited_at && <span className="text-[9px] text-muted-foreground/70 ml-1.5">(edited)</span>}
              </p>
              {previewLinks.length > 0 && !msg._optimistic && (
                <div className="space-y-1.5">
                  {previewLinks.map((link, i) => (
                    <LinkPreviewCard key={`${link.url}-${i}`} link={link} messageId={msg.id} />
                  ))}
                </div>
              )}
              {imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {imageUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                      <img
                        src={url}
                        alt="Shared image"
                        className="rounded-xl max-w-[280px] max-h-[220px] object-cover border border-border/15"
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

          {/* Reactions row — existing badges only, no add button */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {msg.reactions.map(r => (
                <button
                  key={r.emoji}
                  onClick={(e) => { e.stopPropagation(); handleReaction(r.emoji); }}
                  className={cn(
                    "inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[11px] border transition-all duration-150 active:scale-90",
                    r.user_reacted
                      ? "border-primary/25 bg-primary/8 text-primary scale-[1.02]"
                      : "border-border/15 bg-muted/20 text-muted-foreground/70 hover:border-border/30 hover:bg-muted/35"
                  )}
                >
                  {r.emoji} <span className="font-bold text-[10px]">{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Long-press / right-click overlay — fixed centered modal for mobile */}
          {showOverlay && ReactDOM.createPortal(
            <AnimatePresence>
              <motion.div
                key="overlay-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                style={{ touchAction: 'none' }}
                onClick={() => setShowOverlay(false)}
              >
                <motion.div
                  key="overlay-card"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.88, y: 12 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                  className="w-[calc(100%-2rem)] max-w-[340px] rounded-2xl bg-background/95 backdrop-blur-lg border border-border/20 shadow-2xl p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Close button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowOverlay(false); }}
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-muted/30 hover:bg-muted/60 transition-colors active:scale-90"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>

                  {/* Message preview */}
                  <p className="text-[12px] text-muted-foreground/70 line-clamp-2 mb-3 pr-9 leading-relaxed">
                    {msg.content}
                  </p>

                  {/* Emoji row */}
                  <div className="flex items-center gap-1 mb-3">
                    {QUICK_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={(e) => handleReaction(emoji, e)}
                        className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-muted/50 text-xl transition-colors active:scale-90 flex-shrink-0"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-border/15 mb-2" />

                  {/* Action buttons */}
                  <div className="space-y-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenThread(msg); setShowOverlay(false); }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 text-left text-[13px] font-medium text-foreground/80 active:bg-muted/70 transition-colors"
                    >
                      <Reply className="w-4 h-4 text-muted-foreground/70" /> Reply in thread
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onTogglePin(msg); setShowOverlay(false); }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 text-left text-[13px] font-medium text-foreground/80 active:bg-muted/70 transition-colors"
                    >
                      <Pin className="w-4 h-4 text-muted-foreground/70" /> {msg.is_pinned ? 'Unpin' : 'Pin'}
                    </button>
                    {isOwn && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); onStartEditing(msg); setShowOverlay(false); }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 text-left text-[13px] font-medium text-foreground/80 active:bg-muted/70 transition-colors"
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground/70" /> Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-destructive/10 text-left text-[13px] font-medium text-destructive active:bg-destructive/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>,
            document.body
          )}

          {/* Thread indicator */}
          {(msg.reply_count || 0) > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenThread(msg); }}
              className="flex items-center gap-1.5 mt-2 py-1.5 -my-1 text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
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
