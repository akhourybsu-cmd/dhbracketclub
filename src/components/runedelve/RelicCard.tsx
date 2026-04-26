import { Lock, Check, Sparkles, ArrowUp } from 'lucide-react';
import type { RelicDef } from '@/lib/runedelve/relics';
import { CATEGORY_META, MAX_RANK, rankCost, describeRelicAtRank } from '@/lib/runedelve/relics';
import { cn } from '@/lib/utils';

interface Props {
  relic: RelicDef;
  state: 'locked-tier' | 'affordable' | 'unaffordable' | 'owned' | 'equipped';
  shards?: number;          // for buy state
  /** When the relic is owned, current rank (1..MAX_RANK). */
  rank?: number;
  onClick?: () => void;
  disabled?: boolean;
}

/** Mobile-first relic card. Full-width row, 56px icon, clear state. */
export function RelicCard({ relic, state, shards, rank, onClick, disabled }: Props) {
  const cat = CATEGORY_META[relic.category];
  const tierColor =
    relic.tier === 1 ? 'hsl(var(--primary))' :
    relic.tier === 2 ? 'hsl(var(--accent))' :
    'hsl(var(--gold))';

  const isOwnedLike = state === 'owned' || state === 'equipped';
  const curRank = rank ?? 1;
  const isMax = curRank >= MAX_RANK;
  const upgradeCost = isOwnedLike && !isMax ? rankCost(relic.cost, curRank + 1) : 0;
  const canAffordUpgrade = isOwnedLike && !isMax && shards != null && shards >= upgradeCost;

  const stateChip = (() => {
    switch (state) {
      case 'equipped':
      case 'owned': {
        if (isMax) {
          return (
            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider"
              style={{ color: 'hsl(var(--gold))' }}>
              <Check className="w-2.5 h-2.5" /> Maxed
            </span>
          );
        }
        return (
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums transition-all',
            !canAffordUpgrade && 'opacity-60',
            canAffordUpgrade && 'shadow-[0_0_12px_hsl(var(--gold)/0.3)]',
          )}
            style={{
              background: canAffordUpgrade ? 'hsl(var(--gold) / 0.16)' : 'hsl(var(--muted) / 0.5)',
              color: canAffordUpgrade ? 'hsl(var(--gold))' : undefined,
              border: canAffordUpgrade ? '1px solid hsl(var(--gold) / 0.4)' : undefined,
            }}>
            <ArrowUp className="w-3 h-3" /> {upgradeCost}
          </span>
        );
      }
      case 'affordable':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums shadow-[0_0_10px_hsl(var(--gold)/0.25)]"
            style={{ background: 'hsl(var(--gold) / 0.16)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.4)' }}>
            <Sparkles className="w-3 h-3" /> {relic.cost}
          </span>
        );
      case 'unaffordable':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums opacity-60"
            style={{ background: 'hsl(var(--muted) / 0.5)' }}>
            <Sparkles className="w-3 h-3" /> {relic.cost}
            {shards != null && <span className="text-[9px] font-bold text-destructive ml-0.5">need {relic.cost - shards}</span>}
          </span>
        );
      case 'locked-tier':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground"><Lock className="w-3 h-3" />Tier {relic.tier}</span>;
    }
  })();

  return (
    <button
      onClick={onClick}
      disabled={disabled || state === 'locked-tier'}
      className={cn(
        'group w-full text-left rounded-xl p-3 border flex items-start gap-3 btn-press min-w-0 transition-all duration-200',
        'active:scale-[0.985] disabled:active:scale-100',
        state === 'equipped' && 'bg-primary/10 border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]',
        state === 'owned' && 'bg-muted/20 border-border/50 hover:border-gold/40 hover:bg-muted/30',
        state === 'affordable' && 'bg-card border-border/60 hover:border-gold/50 hover:shadow-[0_0_20px_hsl(var(--gold)/0.08)]',
        state === 'unaffordable' && 'bg-card border-border/40 opacity-75',
        state === 'locked-tier' && 'bg-muted/10 border-border/30 opacity-55',
      )}
    >
      <div
        className={cn(
          'relative w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-transform duration-200',
          'group-hover:scale-105 group-active:scale-95',
        )}
        style={{
          background: `linear-gradient(135deg, ${tierColor.replace(')', ' / 0.18)')}, hsl(var(--card)))`,
          border: `1px solid ${tierColor.replace(')', ' / 0.3)')}`,
        }}
        aria-hidden
      >
        {relic.icon}
        {isOwnedLike && rank != null && rank > 1 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center tabular-nums shadow-md animate-scale-in"
            style={{ background: 'hsl(var(--gold))', color: 'hsl(var(--background))', boxShadow: '0 2px 8px hsl(var(--gold) / 0.5)' }}>
            R{rank}
          </span>
        )}
        {canAffordUpgrade && (
          <span
            className="absolute inset-0 rounded-xl pointer-events-none animate-pulse"
            style={{ boxShadow: '0 0 0 2px hsl(var(--gold) / 0.35)' }}
            aria-hidden
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="font-rd-display font-extrabold text-[14px] truncate tracking-wide">{relic.name}</span>
          <span className="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: `${tierColor.replace(')', ' / 0.15)')}`, color: tierColor }}>
            T{relic.tier}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          {describeRelicAtRank(relic, isOwnedLike ? curRank : 1)}
        </p>
        {isOwnedLike && (
          <div className="flex items-center gap-1 mt-1.5" aria-label={`Rank ${curRank} of ${MAX_RANK}`}>
            {Array.from({ length: MAX_RANK }).map((_, i) => {
              const filled = i < curRank;
              return (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    filled ? 'w-3' : 'w-1.5 bg-muted/50',
                  )}
                  style={
                    filled
                      ? { background: 'hsl(var(--gold))', boxShadow: '0 0 6px hsl(var(--gold) / 0.45)' }
                      : undefined
                  }
                  aria-hidden
                />
              );
            })}
            <span className="ml-1 text-[9px] font-extrabold tabular-nums text-foreground/70">R{curRank}/{MAX_RANK}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[9px] font-bold text-muted-foreground inline-flex items-center gap-0.5">
            <span aria-hidden>{cat.emoji}</span> {cat.label}
          </span>
          <span className="ml-auto">{stateChip}</span>
        </div>
      </div>
    </button>
  );
}
