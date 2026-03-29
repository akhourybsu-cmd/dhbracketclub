import { useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
}

export function MessageComposer({ value, onChange, onSend, disabled, placeholder, compact, autoFocus }: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = compact ? 20 : 22;
    const maxLines = 4;
    const maxHeight = lineHeight * maxLines + 16; // padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [compact]);

  useEffect(() => { resize(); }, [value, resize]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus) {
      // Small delay to avoid layout shift on mobile
      const t = setTimeout(() => textareaRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const handleSend = () => {
    onSend();
    // Reset height after send
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex items-end gap-2", compact ? "px-4 py-3" : "px-4 sm:px-5 py-3")}>
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Message'}
          rows={1}
          className={cn(
            "w-full resize-none bg-muted/20 border border-border/25 rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary/20 transition-colors placeholder:text-muted-foreground/50",
            compact ? "text-xs pl-3.5 pr-11 py-2" : "text-sm pl-4 pr-12 py-2.5"
          )}
          autoComplete="off"
          style={{ minHeight: compact ? 36 : 40, maxHeight: compact ? 96 : 104 }}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className={cn(
            "absolute right-1.5 bottom-1.5 p-0 rounded-lg transition-all duration-200",
            compact ? "h-7 w-7" : "h-8 w-8",
            value.trim() ? "opacity-100 scale-100" : "opacity-30 scale-90"
          )}
        >
          <Send className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
        </Button>
      </div>
    </div>
  );
}
