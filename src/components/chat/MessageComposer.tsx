import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UserAvatar } from './UserAvatar';

export interface MentionMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface MessageComposerHandle {
  focus: () => void;
}

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
  members?: MentionMember[];
}

export const MessageComposer = forwardRef<MessageComposerHandle, MessageComposerProps>(
  ({ value, onChange, onSend, onTyping, disabled, placeholder, compact, autoFocus, members = [] }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Mention state
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionStart, setMentionStart] = useState(0); // cursor pos of the '@'

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    // Auto-resize textarea
    const resize = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      const lineHeight = compact ? 20 : 22;
      const maxLines = 4;
      const maxHeight = lineHeight * maxLines + 16;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }, [compact]);

    useEffect(() => { resize(); }, [value, resize]);

    // Auto-focus on mount
    useEffect(() => {
      if (autoFocus) {
        const t = setTimeout(() => textareaRef.current?.focus(), 150);
        return () => clearTimeout(t);
      }
    }, [autoFocus]);

    // iOS keyboard: keep composer visible using visualViewport
    useEffect(() => {
      const vv = window.visualViewport;
      if (!vv || !containerRef.current) return;

      const handleResize = () => {
        const container = containerRef.current;
        if (!container) return;
        const offsetBottom = window.innerHeight - vv.height - vv.offsetTop;
        container.style.transform = offsetBottom > 0 ? `translateY(-${offsetBottom}px)` : '';
      };

      vv.addEventListener('resize', handleResize);
      vv.addEventListener('scroll', handleResize);
      return () => {
        vv.removeEventListener('resize', handleResize);
        vv.removeEventListener('scroll', handleResize);
      };
    }, []);

    // Detect @ mention trigger from cursor position
    const detectMention = useCallback(() => {
      const el = textareaRef.current;
      if (!el || members.length === 0) { setMentionQuery(null); return; }
      const cursor = el.selectionStart;
      const text = el.value;

      // Walk backwards from cursor to find '@'
      let i = cursor - 1;
      while (i >= 0 && text[i] !== '@' && text[i] !== ' ' && text[i] !== '\n') i--;

      if (i >= 0 && text[i] === '@' && (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n')) {
        const query = text.slice(i + 1, cursor);
        setMentionQuery(query);
        setMentionStart(i);
        setMentionIndex(0);
      } else {
        setMentionQuery(null);
      }
    }, [members]);

    const filteredMembers = mentionQuery !== null
      ? members.filter(m => m.display_name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
      : [];

    const insertMention = useCallback((member: MentionMember) => {
      const el = textareaRef.current;
      if (!el) return;
      const before = value.slice(0, mentionStart);
      const after = value.slice(el.selectionStart);
      const mention = `@${member.display_name} `;
      const newValue = before + mention + after;
      onChange(newValue);
      setMentionQuery(null);
      // Set cursor after mention
      requestAnimationFrame(() => {
        const pos = before.length + mention.length;
        el.selectionStart = el.selectionEnd = pos;
        el.focus();
      });
    }, [value, mentionStart, onChange]);

    const handleSend = () => {
      onSend();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      setMentionQuery(null);
      textareaRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Handle mention dropdown navigation
      if (mentionQuery !== null && filteredMembers.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setMentionIndex(prev => (prev + 1) % filteredMembers.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertMention(filteredMembers[mentionIndex]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setMentionQuery(null);
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      onTyping?.();
      // Detect mention after value updates
      requestAnimationFrame(detectMention);
    };

    const handleSelect = () => {
      // Re-check mention on cursor move
      detectMention();
    };

    return (
      <div
        ref={containerRef}
        className={cn("flex items-end gap-2", compact ? "px-4 py-3" : "px-4 sm:px-5 py-3")}
        style={{ paddingBottom: compact ? undefined : 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex-1 relative">
          {/* Mention autocomplete dropdown */}
          {mentionQuery !== null && filteredMembers.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border/25 rounded-xl shadow-xl z-50 overflow-hidden max-h-[200px] overflow-y-auto"
            >
              {filteredMembers.map((member, i) => (
                <button
                  key={member.id}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(member); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                    i === mentionIndex ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground/80"
                  )}
                >
                  <UserAvatar userId={member.id} name={member.display_name} avatarUrl={member.avatar_url} size={24} />
                  <span className="font-medium truncate">{member.display_name}</span>
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            placeholder={placeholder || 'Message'}
            rows={1}
            className={cn(
              "w-full resize-none bg-muted/15 border border-border/20 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/30 focus:bg-muted/25 transition-all duration-200 placeholder:text-muted-foreground/40",
              compact ? "text-xs pl-3.5 pr-11 py-2" : "text-sm pl-4 pr-12 py-3"
            )}
            autoComplete="off"
            style={{ minHeight: compact ? 36 : 44, maxHeight: compact ? 96 : 104 }}
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={value.trim() ? 'active' : 'inactive'}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: value.trim() ? 1 : 0.3, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={cn("absolute right-2 bottom-2", compact ? "h-7 w-7" : "h-8 w-8")}
            >
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!value.trim() || disabled}
                className={cn(
                  "p-0 rounded-xl shadow-sm w-full h-full active:scale-[0.85] transition-transform",
                )}
              >
                <Send className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
              </Button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }
);

MessageComposer.displayName = 'MessageComposer';
