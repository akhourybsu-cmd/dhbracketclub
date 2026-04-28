import { Lock, Plus, X } from 'lucide-react';
import type { RelicDef } from '@/lib/runedelve/relics';
import { CATEGORY_META } from '@/lib/runedelve/relics';
import { cn } from '@/lib/utils';

interface Props {
  relic: RelicDef | null;
  locked?: boolean;
  unlockHint?: string; // e.g. "Reach Lv 25"
  /** Optional rank (1..5) for the equipped relic. */
  rank?: number;
  onClick?: () => void;
  onClear?: () => void;
}

export function LoadoutSlot({ relic, locked, unlockHint, rank, onClick, onClear }: Props) {
  if (locked) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-3 flex flex-col items-center justify-center text-center min-h-[88px] opacity-80 bg-muted/15">
        <Lock className="w-4 h-4 text-foreground/60 mb-1" />
        <p className="text-[11px] font-extrabold text-foreground/75">{unlockHint ?? 'Locked'}</p>
      </div>
    );
  }
  if (!relic) {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-xl border border-dashed border-border/70 p-3 flex flex-col items-center justify-center text-center min-h-[88px] btn-press hover:border-primary/40 transition-colors bg-muted/10"
      >
        <Plus className="w-4 h-4 text-foreground/60 mb-1" />
        <p className="text-[11px] font-extrabold text-foreground/75">Empty slot</p>
      </button>
    );
  }
  const cat = CATEGORY_META[relic.category];
  const tierColor =
    relic.tier === 1 ? 'hsl(var(--primary))' :
    relic.tier === 2 ? 'hsl(var(--accent))' :
    'hsl(var(--gold))';
  return (
    <div
      className={cn('relative rounded-xl border p-3 flex flex-col items-center justify-center text-center min-h-[88px]')}
      style={{
        background: `linear-gradient(135deg, ${tierColor.replace(')', ' / 0.10)')}, hsl(var(--card)))`,
        borderColor: tierColor.replace(')', ' / 0.4)'),
      }}
    >
      {onClear && (
        <button
          onClick={onClear}
          aria-label={`Unequip ${relic.name}`}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/60 flex items-center justify-center hover:bg-destructive/30 btn-press"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <div className="relative">
        <div className="text-2xl mb-0.5" aria-hidden>{relic.icon}</div>
        {rank != null && rank > 1 && (
          <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center tabular-nums shadow-sm"
            style={{ background: 'hsl(var(--gold))', color: 'hsl(var(--background))' }}>
            R{rank}
          </span>
        )}
      </div>
      <p className="font-extrabold text-[12px] leading-tight truncate w-full px-1 text-foreground">{relic.name}</p>
      <p className="text-[10px] font-bold text-foreground/65 mt-0.5">{cat.label}</p>
    </div>
  );
}
