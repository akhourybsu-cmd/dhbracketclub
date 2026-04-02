import { useRef, useEffect, Fragment, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MessageSquare, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { UserAvatar } from './UserAvatar';
import { MessageComposer } from './MessageComposer';
import { LinkPreviewCard } from './LinkPreviewCard';
import { parseMessageLinks } from '@/lib/linkParser';
import type { Message } from './types';

/* URL auto-linking + image detection */
const URL_RE = /(https?:\/\/[^\s<]+)/g;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?[^\s]*)?$/i;
const STORAGE_IMAGE_RE = /\/storage\/v1\/object\/public\/chat-attachments\//i;

function isImageUrl(url: string): boolean {
  return IMAGE_EXT_RE.test(url) || STORAGE_IMAGE_RE.test(url);
}

function stripImageUrls(text: string): string {
  return text.replace(URL_RE, match => isImageUrl(match) ? '' : match).replace(/\n{2,}/g, '\n').trim();
}

function renderContent(text: string) {
  const cleaned = stripImageUrls(text);
  if (!cleaned) return null;
  const parts = cleaned.split(URL_RE);
  if (parts.length === 1) return cleaned;
  return parts.map((part, i) =>
    URL_RE.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 break-all">{part}</a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

function extractImageUrls(text: string): string[] {
  const matches = text.match(URL_RE);
  if (!matches) return [];
  return matches.filter(isImageUrl);
}

interface ThreadPanelProps {
  parent: Message;
  replies: Message[];
  replyValue: string;
  onReplyChange: (v: string) => void;
  onSendReply: () => void;
  onClose: () => void;
}

export function ThreadPanel({ parent, replies, replyValue, onReplyChange, onSendReply, onClose }: ThreadPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [replies]);

  const parentImages = extractImageUrls(parent.content);
  const parentLinks = useMemo(() => parseMessageLinks(parent.content).filter(l => l.contentType !== 'image'), [parent.content]);

  // Wrap onSendReply to match the composer's onSend signature (imageUrls?: string[])
  const handleSend = () => { onSendReply(); };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={cn("flex flex-col min-h-0 bg-background", "w-full lg:w-[320px] lg:border-l lg:border-border/25")}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/25 flex-shrink-0">
        <h3 className="text-[13px] font-bold flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-primary/80" /> Thread
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
          <X className="w-4 h-4 text-muted-foreground/70" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-border/5 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <UserAvatar userId={parent.user_id} name={parent.profiles?.display_name || '?'} avatarUrl={parent.profiles?.avatar_url} size={26} />
          <span className="text-[11px] font-bold text-foreground/80">{parent.profiles?.display_name}</span>
          <span className="text-[9px] text-muted-foreground/70">{format(new Date(parent.created_at), 'h:mm a')}</span>
        </div>
        <div className="pl-[34px]">
          <p className="text-[13px] text-foreground/75 leading-relaxed whitespace-pre-wrap break-words">{renderContent(parent.content)}</p>
          {parentLinks.length > 0 && (
            <div className="space-y-1.5 mt-1">
              {parentLinks.map((link, i) => (
                <LinkPreviewCard key={`${link.url}-${i}`} link={link} messageId={parent.id} />
              ))}
            </div>
          )}
          {parentImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {parentImages.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                  <img src={url} alt="Shared image" className="rounded-xl max-w-[240px] max-h-[180px] object-cover border border-border/15" loading="lazy" decoding="async" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <div className="py-3 space-y-3">
          {replies.length === 0 && <p className="text-xs text-muted-foreground/70 text-center py-8">No replies yet</p>}
          {replies.map(msg => {
            const replyImages = extractImageUrls(msg.content);
            const replyLinks = parseMessageLinks(msg.content).filter(l => l.contentType !== 'image');
            return (
              <div key={msg.id} className={cn("flex gap-2.5", msg._optimistic && "opacity-70")}>
                <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} avatarUrl={msg.profiles?.avatar_url} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-bold text-foreground/80">{msg.profiles?.display_name}</span>
                    <span className="text-[9px] text-muted-foreground/65">{format(new Date(msg.created_at), 'h:mm a')}</span>
                  </div>
                  <p className="text-[12px] text-foreground/75 leading-relaxed break-words whitespace-pre-wrap">{renderContent(msg.content)}</p>
                  {replyLinks.length > 0 && !msg._optimistic && (
                    <div className="space-y-1.5 mt-1">
                      {replyLinks.map((link, i) => (
                        <LinkPreviewCard key={`${link.url}-${i}`} link={link} messageId={msg.id} />
                      ))}
                    </div>
                  )}
                  {replyImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {replyImages.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                          <img src={url} alt="Shared image" className="rounded-xl max-w-[200px] max-h-[160px] object-cover border border-border/15" loading="lazy" decoding="async" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-border/15 bg-background/80 backdrop-blur-sm flex-shrink-0">
        <MessageComposer
          value={replyValue}
          onChange={onReplyChange}
          onSend={handleSend}
          placeholder="Reply in thread..."
          compact
          autoFocus
        />
      </div>
    </motion.div>
  );
}
