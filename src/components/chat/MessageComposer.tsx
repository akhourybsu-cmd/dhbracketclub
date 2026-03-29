import { useRef } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}

export function MessageComposer({ value, onChange, onSend, disabled, placeholder, compact }: MessageComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    onSend();
    inputRef.current?.focus();
  };

  return (
    <div className={cn("flex items-center gap-2", compact ? "px-4 py-3" : "px-4 sm:px-5 py-3")}>
      <div className="flex-1 relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={placeholder || 'Message'}
          className={cn(
            "bg-muted/20 border-border/25 rounded-xl pr-12 focus-visible:ring-primary/20 focus-visible:border-primary/20",
            compact ? "h-10 text-xs pl-3.5 pr-11" : "h-11 text-sm pl-4 pr-12"
          )}
          autoComplete="off"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className={cn(
            "absolute right-1.5 top-1/2 -translate-y-1/2 p-0 rounded-lg transition-all duration-200",
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
