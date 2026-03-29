import { useRef, useEffect, Fragment } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MessageSquare, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { UserAvatar } from './UserAvatar';
import { MessageComposer } from './MessageComposer';
import type { Message } from './types';

/* URL auto-linking (same as MessageBubble) */
const URL_RE = /(https?:\/\/[^\s<]+)/g;
function renderContent(text: string) {
  const parts = text.split(URL_RE);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    URL_RE.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 break-all">{part}</a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
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
          <UserAvatar userId={parent.user_id} name={parent.profiles?.display_name || '?'} size={26} />
          <span className="text-[11px] font-bold text-foreground/80">{parent.profiles?.display_name}</span>
          <span className="text-[9px] text-muted-foreground/70">{format(new Date(parent.created_at), 'h:mm a')}</span>
        </div>
        <p className="text-[13px] text-foreground/75 leading-relaxed pl-[34px] whitespace-pre-wrap break-words">{renderContent(parent.content)}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <div className="py-3 space-y-3">
          {replies.length === 0 && <p className="text-xs text-muted-foreground/70 text-center py-8">No replies yet</p>}
          {replies.map(msg => (
            <div key={msg.id} className={cn("flex gap-2.5", msg._optimistic && "opacity-70")}>
              <UserAvatar userId={msg.user_id} name={msg.profiles?.display_name || '?'} size={24} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[11px] font-bold text-foreground/80">{msg.profiles?.display_name}</span>
                  <span className="text-[9px] text-muted-foreground/65">{format(new Date(msg.created_at), 'h:mm a')}</span>
                </div>
                <p className="text-[12px] text-foreground/75 leading-relaxed break-words whitespace-pre-wrap">{renderContent(msg.content)}</p>
                {msg._optimistic && (
                  <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] text-muted-foreground/50 font-medium">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Sending…
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-border/5 flex-shrink-0">
        <MessageComposer
          value={replyValue}
          onChange={onReplyChange}
          onSend={onSendReply}
          placeholder="Reply in thread..."
          compact
          autoFocus
        />
      </div>
    </motion.div>
  );
}
