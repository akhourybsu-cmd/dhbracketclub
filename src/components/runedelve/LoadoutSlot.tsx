import { Lock, Plus, X } from 'lucide-react';
import type { RelicDef } from '@/lib/runedelve/relics';
import { CATEGORY_META } from '@/lib/runedelve/relics';
import { cn } from '@/lib/utils';

interface Props {
  relic: RelicDef | null;
  locked?: boolean;
  unlockHint?: string; // e.g. "Reach Lv 50"
  onClick?: () => void;
  onClear?: () => void;
}

export function LoadoutSlot({ relic, locked, unlockHint, onClick, onClear }: Props) {
  if (locked) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-3 flex flex-col items-center justify-center text-center min-h-[88px] opacity-60">
        <Lock className="w-4 h-4 text-muted-foreground mb-1" />
        <p className="text-[10px] font-bold text-muted-foreground">{unlockHint ?? 'Locked'}</p>
      </div>
    );
  }
  if (!relic) {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-xl border border-dashed border-border/60 p-3 flex flex-col items-center justify-center text-center min-h-[88px] btn-press hover:border-primary/40 transition-colors"
      >
        <Plus className="w-4 h-4 text-muted-foreground mb-1" />
        <p className="text-[10px] font-bold text-muted-foreground">Empty slot</p>
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
      <div className="text-2xl mb-0.5" aria-hidden>{relic.icon}</div>
      <p className="font-extrabold text-[11px] leading-tight truncate w-full px-1">{relic.name}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{cat.label}</p>
    </div>
  );
}
