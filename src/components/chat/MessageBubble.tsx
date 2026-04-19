import { useState, useRef, useCallback, useEffect, Fragment, memo, useMemo } from 'react';
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

/* ═══ Bubble corner rounding logic ═══ */
function getBubbleCorners(isOwn: boolean, isFirst: boolean, isLast: boolean, isSingle: boolean): string {
  if (isSingle) return 'rounded-2xl';
  const base = 'rounded-2xl';
  if (isOwn) {
    if (isFirst) return `${base} rounded-br-md`;
    if (isLast) return `${base} rounded-tr-md`;
    return `${base} rounded-tr-md rounded-br-md`;
  } else {
    if (isFirst) return `${base} rounded-bl-md`;
    if (isLast) return `${base} rounded-tl-md`;
    return `${base} rounded-tl-md rounded-bl-md`;
  }
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
  isOverlayOpen?: boolean;
  onToggleOverlay?: (msgId: string | null) => void;
}

const SWIPE_THRESHOLD = 60;
const HEADER_OFFSET = 80;

function MessageBubbleInner({
  msg, isOwn, sameAuthor, nextSameAuthor,
  currentUserId, currentDisplayName,
  onToggleReaction, onOpenThread, onTogglePin,
  onStartEditing, onDeleteMessage, onSaveEdit,
  editingMessageId, editContent, onEditContentChange, onCancelEdit,
  isOverlayOpen, onToggleOverlay,
}: MessageBubbleProps) {
  const showOverlay = !!isOverlayOpen;
  const setShowOverlay = useCallback((open: boolean) => {
    onToggleOverlay?.(open ? msg.id : null);
  }, [msg.id, onToggleOverlay]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [overlayBelow, setOverlayBelow] = useState(false);
  const bubbleWrapperRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const dragX = useMotionValue(0);
  const replyIconOpacity = useTransform(dragX, [0, SWIPE_THRESHOLD], [0, 1]);
  const replyIconScale = useTransform(dragX, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const [swiped, setSwiped] = useState(false);

  useEffect(() => {
    const el = editRef.current;
    if (!el || editingMessageId !== msg.id) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [editContent, editingMessageId, msg.id]);

  useEffect(() => {
    if (!showOverlay) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowOverlay(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showOverlay, setShowOverlay]);

  const isBeingEdited = editingMessageId === msg.id;
  const isFirstInBlock = !sameAuthor;
  const isLastInBlock = !nextSameAuthor;
  const isSingle = isFirstInBlock && isLastInBlock;

  const openOverlay = useCallback(() => {
    if (isBeingEdited) return;
    const rect = bubbleWrapperRef.current?.getBoundingClientRect();
    setOverlayBelow(!!rect && rect.top < HEADER_OFFSET + 44);
    setShowOverlay(true);
  }, [isBeingEdited, setShowOverlay]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isBeingEdited) return;
    e.preventDefault();
    openOverlay();
  }, [isBeingEdited, openOverlay]);

  const handleTap = useCallback(() => {
    if (isBeingEdited) return;
    if (showOverlay) setShowOverlay(false);
    else openOverlay();
  }, [isBeingEdited, showOverlay, openOverlay, setShowOverlay]);

  const handleReaction = useCallback((emoji: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onToggleReaction(msg.id, emoji);
    setShowOverlay(false);
  }, [msg.id, onToggleReaction, setShowOverlay]);

  const confirmDelete = () => {
    onDeleteMessage(msg.id);
    setShowDeleteConfirm(false);
    setShowOverlay(false);
  };

  const imageUrls = extractImageUrls(msg.content);
  const parsedLinks = useMemo(() => parseMessageLinks(msg.content), [msg.content]);
  const previewLinks = parsedLinks.filter(l => l.contentType !== 'image');
  const senderColor = getUserColor(msg.user_id);
  const bubbleCorners = getBubbleCorners(isOwn, isFirstInBlock, isLastInBlock, isSingle);

  return (
    <>
      <motion.div
        className={cn(
          "group relative",
          sameAuthor ? "py-[1px]" : "pt-1",
          msg._optimistic && "opacity-70"
        )}
        style={{ x: dragX }}
        drag={isBeingEdited ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: 0, right: SWIPE_THRESHOLD + 10 }}
        dragElastic={0.15}
        dragSnapToOrigin
        dragMomentum={false}
        onDrag={(_, info) => {
          if (info.offset.x > SWIPE_THRESHOLD && !swiped) {
            setSwiped(true);
            navigator.vibrate?.(10);
          }
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x > SWIPE_THRESHOLD) onOpenThread(msg);
          setSwiped(false);
        }}
        onContextMenu={handleContextMenu}
        onTap={(e) => {
          // Ignore taps that originated on interactive children (links, buttons, images)
          const target = e.target as HTMLElement;
          if (target.closest('a, button, textarea, input')) return;
          handleTap();
        }}
      >
        {/* Swipe reply icon */}
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center pointer-events-none"
          style={{ opacity: replyIconOpacity, scale: replyIconScale }}
        >
          <Reply className="w-3 h-3 text-primary" />
        </motion.div>

        {/* Row container: flex left or right */}
        <div className={cn("flex items-end gap-2", isOwn ? "justify-end" : "justify-start")}>
          {/* Avatar for other users — only on last message of block */}
          {!isOwn && (
            <div className="w-7 flex-shrink-0">
              {isLastInBlock ? (
                <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} avatarUrl={msg.profiles?.avatar_url} size={28} />
              ) : (
                <div className="w-7" />
              )}
            </div>
          )}

          {/* Bubble column */}
          <div ref={bubbleWrapperRef} className="relative max-w-[80%] min-w-[60px]">
            {/* Sender name — first message of other user's block */}
            {!isOwn && isFirstInBlock && (
              <div className="flex items-baseline gap-2 mb-0.5 pl-1">
                <span className="text-[12px] font-semibold truncate" style={{ color: senderColor }}>
                  {msg.profiles?.display_name || 'Unknown'}
                </span>
                <span className="text-[10px] text-muted-foreground/45 font-medium flex-shrink-0">
                  {format(new Date(msg.created_at), 'h:mm a')}
                </span>
              </div>
            )}

            {/* Bubble + overlapping reactions wrapper */}
            <div className={cn(
              "relative",
              msg.reactions && msg.reactions.length > 0 && "mb-3.5"
            )}>
              {/* The bubble */}
              <div
                className={cn(
                  bubbleCorners,
                  "px-3 py-2 relative",
                  isOwn
                    ? "text-foreground/95"
                    : "border border-border/10 text-foreground/90"
                )}
                style={{
                  backgroundColor: isOwn
                    ? 'hsl(var(--chat-own-bg))'
                    : 'hsl(var(--chat-incoming))'
                }}
              >
                {isBeingEdited ? (
                  <div className="flex items-start gap-2">
                    <textarea
                      ref={editRef}
                      value={editContent}
                      onChange={e => onEditContentChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveEdit(msg.id, editContent); }
                        if (e.key === 'Escape') onCancelEdit();
                      }}
                      className="flex-1 resize-none text-[13px] bg-background/30 border border-border/25 rounded-lg px-2 py-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
                      rows={1}
                      autoFocus
                      style={{ minHeight: 28, maxHeight: 120 }}
                    />
                    <button onClick={() => onSaveEdit(msg.id, editContent)} className="p-1 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={onCancelEdit} className="p-1 rounded-lg hover:bg-muted/50 transition-colors">
                      <X className="w-3.5 h-3.5 text-muted-foreground/70" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className={cn(
                      "text-[13px] leading-[1.55] break-words whitespace-pre-wrap",
                      imageUrls.length > 0 && !stripImageUrls(msg.content) && "hidden"
                    )}>
                      {renderContent(stripImageUrls(msg.content), currentUserId, currentDisplayName)}
                      {msg.is_pinned && <Pin className="w-2 h-2 inline-block ml-1 -mt-0.5" style={{ color: 'hsl(var(--premium-warm) / 0.5)' }} />}
                      {msg.edited_at && <span className="text-[9px] text-muted-foreground/50 ml-1.5">(edited)</span>}
                    </p>
                    {previewLinks.length > 0 && !msg._optimistic && (
                      <div className="space-y-1.5 mt-1.5">
                        {previewLinks.map((link, i) => (
                          <LinkPreviewCard key={`${link.url}-${i}`} link={link} messageId={msg.id} />
                        ))}
                      </div>
                    )}
                    {imageUrls.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {imageUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                            <img
                              src={url}
                              alt="Shared image"
                              className="rounded-lg max-w-[240px] max-h-[200px] object-cover border border-border/10"
                              loading="lazy"
                              decoding="async"
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
              </div>

              {/* Reactions — overlapping bottom corner of bubble (iMessage style) */}
              {msg.reactions && msg.reactions.length > 0 && (
                <div className={cn(
                  "absolute -bottom-2.5 z-10 flex flex-wrap gap-1",
                  isOwn ? "right-1" : "left-1"
                )}>
                  {msg.reactions.map(r => (
                    <button
                      key={r.emoji}
                      onClick={(e) => { e.stopPropagation(); handleReaction(r.emoji); }}
                      className={cn(
                        "inline-flex items-center gap-1 h-6 px-1.5 rounded-full text-[11px] border shadow-sm backdrop-blur-sm transition-all duration-150 active:scale-90",
                        r.user_reacted
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/30 bg-background/95 text-foreground/80 hover:bg-background"
                      )}
                    >
                      {r.emoji} <span className="font-bold text-[10px]">{r.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Timestamp for own messages — last in block */}
            {isOwn && isLastInBlock && !isBeingEdited && (
              <div className="flex justify-end mt-1 pr-1">
                <span className="text-[10px] text-muted-foreground/40 font-medium">
                  {format(new Date(msg.created_at), 'h:mm a')}
                </span>
              </div>
            )}

            {/* Action overlay */}
            <AnimatePresence>
              {showOverlay && (
                <motion.div
                  key="inline-bar"
                  initial={{ opacity: 0, scale: 0.9, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 6 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                  className={cn(
                    "absolute z-50 pointer-events-auto flex items-center gap-0.5 px-1.5 py-1 bg-background/95 backdrop-blur-lg border border-border/20 shadow-lg rounded-xl",
                    overlayBelow ? "-bottom-11" : "-top-11",
                    isOwn ? "right-0" : "left-0"
                  )}
                  onClick={(e) => e.stopPropagation()}
                  onTap={(e) => e.stopPropagation?.()}
                >
                  {QUICK_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={(e) => handleReaction(emoji, e)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 text-base transition-colors active:scale-90 flex-shrink-0"
                    >
                      {emoji}
                    </button>
                  ))}
                  <div className="w-px h-5 bg-border/20 mx-0.5" />
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenThread(msg); setShowOverlay(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors active:scale-90"
                    title="Reply"
                  >
                    <Reply className="w-3.5 h-3.5 text-muted-foreground/70" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onTogglePin(msg); setShowOverlay(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors active:scale-90"
                    title={msg.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin className="w-3.5 h-3.5 text-muted-foreground/70" />
                  </button>
                  {isOwn && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); onStartEditing(msg); setShowOverlay(false); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors active:scale-90"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground/70" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setShowOverlay(false); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors active:scale-90"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Thread indicator */}
            {(msg.reply_count || 0) > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenThread(msg); }}
                className={cn(
                  "flex items-center gap-1.5 mt-1.5 py-1 text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors",
                  isOwn ? "ml-auto" : ""
                )}
                style={{ touchAction: 'manipulation' }}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
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
    prev.msg.reactions === next.msg.reactions &&
    prev.msg.reply_count === next.msg.reply_count &&
    prev.msg._optimistic === next.msg._optimistic &&
    prev.isOwn === next.isOwn &&
    prev.sameAuthor === next.sameAuthor &&
    prev.nextSameAuthor === next.nextSameAuthor &&
    prev.editingMessageId === next.editingMessageId &&
    prev.editContent === next.editContent &&
    prev.isOverlayOpen === next.isOverlayOpen
  );
});
