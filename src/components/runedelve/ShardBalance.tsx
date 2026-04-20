import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  shards: number;
  size?: 'sm' | 'md';
  className?: string;
}

/** Compact gold-tinted Rune Shard balance pill. Mobile-first ≥44px tap not required (display only). */
export function ShardBalance({ shards, size = 'md', className }: Props) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-extrabold tabular-nums',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
        className,
      )}
      style={{
        background: 'hsl(var(--gold) / 0.14)',
        color: 'hsl(var(--gold))',
        border: '1px solid hsl(var(--gold) / 0.3)',
      }}
    >
      <Sparkles className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {shards.toLocaleString()}
    </div>
  );
}
