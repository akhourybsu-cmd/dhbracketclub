import { Sparkles, ArrowRight, Check } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  type RelicDef,
  CATEGORY_META,
  MAX_RANK,
  RANK_EFFECTS,
  rankCost,
  effectValue,
  clampRank,
} from '@/lib/runedelve/relics';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relic: RelicDef | null;
  currentRank: number;
  shards: number;
  pending?: boolean;
  onConfirm: () => void;
}

const FORMAT_RULES: Record<string, (v: number) => string> = {
  // Multipliers — show as ×1.55
  ember_edge:        (v) => `×${v.toFixed(2)}`,
  crimson_tide:      (v) => `×${v.toFixed(2)}`,
  executioners_mark: (v) => `×${v.toFixed(2)}`,
  desperate_surge:   (v) => `×${v.toFixed(2)}`,
  momentum:          (v) => `×${v.toFixed(2)}`,
  shrine_ward:       (v) => `×${v.toFixed(2)}`,
  wanderers_compass: (v) => `×${v.toFixed(2)}`,
  cracked_crown:     (v) => `×${v.toFixed(2)}`,
  verdant_heart:     (v) => `${v.toFixed(1)}× length`,
  // Flat ints
  aether_spark:      (v) => `${Math.round(v)} mana`,
  sapphire_flow:     (v) => `+${Math.round(v)} mana`,
  first_light:       (v) => `${Math.round(v)} free use${v > 1 ? 's' : ''}`,
  iron_resolve:      (v) => `${Math.round(v)} turn${v > 1 ? 's' : ''}`,
  bloodbond:         (v) => `${Math.round(v)} HP`,
  last_stand:        (v) => `${Math.round(v)} use${v > 1 ? 's' : ''}`,
  bulwark:           (v) => `+${Math.round(v)} turn${v > 1 ? 's' : ''}`,
  keysight:          (v) => `${Math.round(v)} turn${v > 1 ? 's' : ''}`,
  cleansing_touch:   (v) => `${Math.round(v)} clear${v > 1 ? 's' : ''}`,
  quickstep:         (v) => `+${Math.round(v)} length`,
  foresight:         (v) => `${Math.round(v)} turn${v > 1 ? 's' : ''}`,
};

function formatEffect(relicId: string, value: number): string {
  const fn = FORMAT_RULES[relicId];
  return fn ? fn(value) : String(value);
}

export function RelicUpgradeSheet({
  open,
  onOpenChange,
  relic,
  currentRank,
  shards,
  pending,
  onConfirm,
}: Props) {
  if (!relic) return null;
  const cur = clampRank(currentRank);
  const next = Math.min(MAX_RANK, cur + 1);
  const isMax = cur >= MAX_RANK;
  const cost = isMax ? 0 : rankCost(relic.cost, next);
  const canAfford = shards >= cost;
  const cat = CATEGORY_META[relic.category];

  const hasEffectTable = !!RANK_EFFECTS[relic.id];
  const curVal = hasEffectTable ? effectValue(relic.id, cur) : null;
  const nextVal = hasEffectTable && !isMax ? effectValue(relic.id, next) : null;

  const tierColor =
    relic.tier === 1 ? 'hsl(var(--primary))' :
    relic.tier === 2 ? 'hsl(var(--accent))' :
    'hsl(var(--gold))';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-t border-border/60 px-5 pt-5 pb-7 max-h-[88vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <div className="flex items-start gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{
                background: `linear-gradient(135deg, ${tierColor.replace(')', ' / 0.20)')}, hsl(var(--card)))`,
                border: `1px solid ${tierColor.replace(')', ' / 0.4)')}`,
              }}
              aria-hidden
            >
              {relic.icon}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="rd-title text-[18px] font-extrabold tracking-wide leading-tight">
                {relic.name}
              </SheetTitle>
              <SheetDescription className="text-[12px] mt-0.5">
                {cat.emoji} {cat.label} · Tier {relic.tier}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <p className="text-[12px] text-foreground/85 leading-snug mt-3">{relic.description}</p>

        {/* Rank dots */}
        <div className="mt-4 flex items-center gap-1.5">
          {Array.from({ length: MAX_RANK }).map((_, i) => {
            const r = i + 1;
            const filled = r <= cur;
            const isNext = !isMax && r === next;
            return (
              <span
                key={r}
                className={cn(
                  'w-3 h-3 rounded-full transition-colors',
                  filled ? 'bg-gold' : isNext ? 'bg-gold/30 ring-2 ring-gold/40' : 'bg-muted/50',
                )}
                aria-hidden
              />
            );
          })}
          <span className="ml-2 text-[11px] font-extrabold text-foreground/80 tabular-nums">
            R{cur}/{MAX_RANK}
          </span>
        </div>

        {/* Effect delta */}
        {hasEffectTable && (
          <div className="mt-4 rounded-xl border border-border/50 bg-card/60 p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">
              Effect
            </p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Current · R{cur}</p>
                <p className="rd-title text-[16px] font-extrabold tabular-nums text-foreground">
                  {formatEffect(relic.id, curVal!)}
                </p>
              </div>
              <ArrowRight className={cn('w-4 h-4 shrink-0', isMax ? 'opacity-30' : 'text-gold')} />
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">{isMax ? 'Maxed' : `Next · R${next}`}</p>
                <p
                  className={cn(
                    'rd-title text-[16px] font-extrabold tabular-nums',
                    isMax ? 'text-muted-foreground' : 'text-gold',
                  )}
                >
                  {isMax ? '—' : formatEffect(relic.id, nextVal!)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-5 space-y-2">
          {isMax ? (
            <div className="rounded-xl border border-gold/40 bg-gold/10 p-3 flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-gold" />
              <p className="text-[13px] font-extrabold text-gold">Max rank reached</p>
            </div>
          ) : (
            <>
              <Button
                onClick={onConfirm}
                disabled={!canAfford || pending}
                className="w-full h-12 rounded-xl text-[14px] font-extrabold gap-2"
                style={
                  canAfford
                    ? { background: 'hsl(var(--gold))', color: 'hsl(var(--background))' }
                    : undefined
                }
                variant={canAfford ? 'default' : 'secondary'}
              >
                <Sparkles className="w-4 h-4" />
                {pending ? 'Upgrading…' : `Upgrade to R${next} · ${cost}`}
              </Button>
              {!canAfford && (
                <p className="text-center text-[11px] font-bold text-destructive">
                  Need {cost - shards} more shards
                </p>
              )}
              <p className="text-center text-[10px] text-muted-foreground">
                Your balance: <span className="tabular-nums font-bold">{shards}</span> ✦
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
