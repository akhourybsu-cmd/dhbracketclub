import { Sparkles } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { useRuneWallet, useSpendShards } from '@/hooks/useRuneShards';
import { useRelicCollection, useUnlockRelic, useUpgradeRelic } from '@/hooks/useRelicCollection';
import { useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import {
  RELIC_CATALOG,
  CATEGORY_META,
  tierUnlockedForChapter,
  rankCost,
  MAX_RANK,
  type RelicCategory,
  type RelicTier,
  type RelicDef,
} from '@/lib/runedelve/relics';
import { chapterFor } from '@/lib/runedelve/levelGenerator';
import { RelicCard } from '@/components/runedelve/RelicCard';
import { RelicUpgradeSheet } from '@/components/runedelve/RelicUpgradeSheet';
import { ShardBalance } from '@/components/runedelve/ShardBalance';
import { cn } from '@/lib/utils';

const TIERS: RelicTier[] = [1, 2, 3];
const CATS: (RelicCategory | 'all')[] = ['all', 'offense', 'mana', 'survival', 'board', 'tempo', 'objective'];

export default function RuneDelveShopPage() {
  const { data: wallet } = useRuneWallet();
  const { data: owned } = useRelicCollection();
  const { data: progress } = useMyProgress();
  const { data: hero } = useRuneDelveHero();
  const spend = useSpendShards();
  const unlock = useUnlockRelic();
  const upgrade = useUpgradeRelic();
  const sfx = useSoundEffect();

  const [tier, setTier] = useState<RelicTier>(1);
  const [cat, setCat] = useState<RelicCategory | 'all'>('all');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [upgradeRelic, setUpgradeRelic] = useState<RelicDef | null>(null);

  const ownedMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of owned ?? []) m.set(o.relic_id, o.rank ?? 1);
    return m;
  }, [owned]);
  const shards = wallet?.shards ?? 0;
  const currentChapter = chapterFor(progress?.highest_unlocked_level ?? 1);

  const visible = useMemo(() => {
    return RELIC_CATALOG
      .filter(r => r.tier === tier)
      .filter(r => cat === 'all' || r.category === cat)
      .sort((a, b) => a.cost - b.cost);
  }, [tier, cat]);

  const tierUnlocked = (t: RelicTier) => tierUnlockedForChapter(t, currentChapter);

  const buy = async (relicId: string) => {
    const r = RELIC_CATALOG.find(x => x.id === relicId);
    if (!r || pendingId) return;
    if (ownedMap.has(relicId)) return;
    if (shards < r.cost) {
      toast.error(`Not enough Rune Shards (need ${r.cost - shards} more)`);
      return;
    }
    setPendingId(relicId);
    try {
      await spend.mutateAsync(r.cost);
      await unlock.mutateAsync({ relic_id: relicId, level: hero?.level ?? 1 });
      sfx.play('achievement');
      toast.success(`✨ Unlocked ${r.name}`, { description: 'Equip it from the Armory' });
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not unlock relic');
    } finally {
      setPendingId(null);
    }
  };

  const handleCardClick = (r: RelicDef) => {
    if (ownedMap.has(r.id)) {
      setUpgradeRelic(r);
    } else {
      buy(r.id);
    }
  };

  const confirmUpgrade = async () => {
    if (!upgradeRelic) return;
    const curRank = ownedMap.get(upgradeRelic.id) ?? 1;
    if (curRank >= MAX_RANK) return;
    const cost = rankCost(upgradeRelic.cost, curRank + 1);
    if (shards < cost) {
      toast.error(`Need ${cost - shards} more shards`);
      return;
    }
    setPendingId(upgradeRelic.id);
    try {
      await spend.mutateAsync(cost);
      await upgrade.mutateAsync({ relic_id: upgradeRelic.id, expected_rank: curRank });
      toast.success(`⬆️ ${upgradeRelic.name} → R${curRank + 1}`);
      setUpgradeRelic(null);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not upgrade relic');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <ShardBalance shards={shards} />
      </div>

      <div className="text-center space-y-1">
        <h1 className="rd-title page-header-title flex items-center justify-center gap-2 text-2xl">
          <Sparkles className="w-5 h-5 text-primary" /> Relic Shop
        </h1>
        <p className="text-[12px] font-semibold text-foreground/80">Spend Rune Shards to permanently unlock relics. Equip them in the Armory.</p>
      </div>

      {/* Tier tabs */}
      <div className="grid grid-cols-3 gap-1.5 sticky top-0 z-10 py-1 bg-background/85 backdrop-blur-sm">
        {TIERS.map(t => {
          const unlocked = tierUnlocked(t);
          const active = tier === t;
          return (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={cn(
                'h-10 rounded-lg text-[11px] font-extrabold btn-press flex items-center justify-center gap-1',
                active ? 'bg-primary text-primary-foreground' : 'bg-muted/40',
                !unlocked && 'opacity-60',
              )}
            >
              Tier {t}
              {!unlocked && <span className="text-[9px] font-bold opacity-80">· locked</span>}
            </button>
          );
        })}
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 scrollbar-none">
        {CATS.map(c => {
          const meta = c === 'all' ? { label: 'All', emoji: '✦' } : CATEGORY_META[c];
          const active = cat === c;
          return (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                'shrink-0 h-8 px-3 rounded-full text-[11px] font-bold btn-press inline-flex items-center gap-1',
                active ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-muted/30 border border-transparent',
              )}
            >
              <span>{meta.emoji}</span> {meta.label}
            </button>
          );
        })}
      </div>

      {/* Tier-locked banner */}
      {!tierUnlocked(tier) && (
        <div className="glass-card p-4 text-center">
          <p className="rd-title text-[14px] font-extrabold mb-1 text-foreground">Tier {tier} sealed</p>
          <p className="text-[12px] font-semibold text-foreground/80">
            Reach Chapter {tier} to unlock these relics. You're in Chapter {currentChapter}.
          </p>
        </div>
      )}

      {/* Relic list */}
      {tierUnlocked(tier) && (
        <div className="space-y-2.5">
          {visible.map(r => {
            const ownedAlready = ownedMap.has(r.id);
            const rank = ownedMap.get(r.id);
            const state = ownedAlready
              ? 'owned'
              : shards >= r.cost ? 'affordable' : 'unaffordable';
            return (
              <RelicCard
                key={r.id}
                relic={r}
                state={state as any}
                shards={shards}
                rank={rank}
                onClick={() => handleCardClick(r)}
                disabled={pendingId === r.id}
              />
            );
          })}
          {visible.length === 0 && (
            <p className="text-center text-[11px] text-muted-foreground py-6">No relics in this filter.</p>
          )}
        </div>
      )}

      <RelicUpgradeSheet
        open={!!upgradeRelic}
        relic={upgradeRelic}
        currentRank={upgradeRelic ? (ownedMap.get(upgradeRelic.id) ?? 1) : 1}
        shards={shards}
        pending={!!pendingId}
        onConfirm={confirmUpgrade}
        onOpenChange={(o) => !o && setUpgradeRelic(null)}
      />
    </div>
  );
}
