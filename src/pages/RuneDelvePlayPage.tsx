import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, HelpCircle, Trophy, Skull, Hourglass } from 'lucide-react';
import { useRuneDelveHero, useUpdateHero } from '@/hooks/useRuneDelveHero';
import { useAllClassProgress, useUpdateClassProgress } from '@/hooks/useRuneDelveClassProgress';
import { useLevel, useMyLevelRun, useSubmitLevelRun, useAdvanceProgress, useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { mulberry32 } from '@/lib/runedelve/prng';
import { generateBoard, type RuneType, type Enemy } from '@/lib/runedelve/dungeonGenerator';
import { isValidChain, resolveBoard, type Cell } from '@/lib/runedelve/boardEngine';
import { applyChain, enemiesAttack, endTurn, initialCombat, isRunOver, useAbility, type CombatState } from '@/lib/runedelve/combatEngine';
import { calculateScore, xpForRun } from '@/lib/runedelve/scoring';
import { levelFromXp, newTitleUnlocked, titleForLevel } from '@/lib/runedelve/classConfig';
import { useLoadout } from '@/hooks/useLoadout';
import { useEarnShards, useFailureRow, useBumpFailure, useResetFailure, useRuneWallet, useUnlockSlot } from '@/hooks/useRuneShards';
import { buildActive, getStartingMana, getStartingShieldTurns, has, onEnemyKilled, tryLastStand } from '@/lib/runedelve/relicEffects';
import { computeClearShards, computeFailureShards, slotsForClassLevels } from '@/lib/runedelve/shardEconomy';
import { getBossRule as _getBossRuleEcon } from '@/lib/runedelve/bossRules';
import { objectiveLabel, type ObjectiveType } from '@/lib/runedelve/levelGenerator';
import {
  mechanicsForLevel,
  introMechanicForLevel,
  seenMechanicKey,
  type MechanicId,
} from '@/lib/runedelve/mechanics';
import { buildInitialSeals, sealsBrokenByChain } from '@/lib/runedelve/sealedTiles';
import { applyInitialIntents } from '@/lib/runedelve/telegraph';
import {
  buildInitialCorruption,
  spreadCorruption,
  resolveChainAgainstCorruption,
  emptyCorruption,
  type CorruptionState,
} from '@/lib/runedelve/corruptedTiles';
import { secondaryMet, secondaryShort, secondaryLabel, type SecondaryObjective } from '@/lib/runedelve/layeredGoals';
import { getBossRule, type BossRuleId } from '@/lib/runedelve/bossRules';
import { Crown, Target } from 'lucide-react';
import { RuneBoard } from '@/components/runedelve/RuneBoard';
import { EnemyDisplay } from '@/components/runedelve/EnemyDisplay';
import { HeroStatusBar } from '@/components/runedelve/HeroStatusBar';
import { HowToPlaySheet } from '@/components/runedelve/HowToPlaySheet';
import { MechanicIntroSheet } from '@/components/runedelve/MechanicIntroSheet';
import { MechanicBanner } from '@/components/runedelve/MechanicBanner';
import { format } from 'date-fns';

export default function RuneDelvePlayPage() {
  const navigate = useNavigate();
  const { levelNumber: levelParam } = useParams<{ levelNumber: string }>();
  const levelNumber = Math.max(1, parseInt(levelParam ?? '1', 10) || 1);

  const { data: hero } = useRuneDelveHero();
  const { data: progress } = useMyProgress();
  const { data: level } = useLevel(levelNumber);
  const { data: existingRun } = useMyLevelRun(level?.id);
  const { data: classTracks } = useAllClassProgress();
  const submit = useSubmitLevelRun();
  const advance = useAdvanceProgress();
  const updateHero = useUpdateHero();
  const updateClass = useUpdateClassProgress();
  const { data: loadout } = useLoadout(hero?.class);
  const { data: wallet } = useRuneWallet();
  const { data: failureRow } = useFailureRow(level?.level_number ?? null);
  const earnShards = useEarnShards();
  const bumpFailure = useBumpFailure();
  const resetFailure = useResetFailure();
  const unlockSlot = useUnlockSlot();

  const [grid, setGrid] = useState<RuneType[][] | null>(null);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [seals, setSeals] = useState<Set<string>>(new Set());
  const [rngTick, setRngTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [introMechanic, setIntroMechanic] = useState<MechanicId | null>(null);
  const [endState, setEndState] = useState<null | { cleared: boolean; reason: 'cleared' | 'defeated' | 'timeout'; score: number; isNewBest: boolean; shards: number }>(null);
  const [lastStandUsed, setLastStandUsed] = useState(false);
  const [corruption, setCorruption] = useState<CorruptionState>(emptyCorruption);

  // Active relic loadout for this run.
  const activeRelics = useMemo(() => buildActive([loadout?.slot_1, loadout?.slot_2, loadout?.slot_3]), [loadout]);

  // Resolve mechanics for this level. Prefer the persisted row, fall back
  // to the deterministic helper so legacy/transient rows still work.
  const activeMechanics = useMemo<MechanicId[]>(() => {
    const stored = (level?.modifiers as any)?.mechanics as MechanicId[] | undefined;
    if (stored?.length) return stored;
    return level ? mechanicsForLevel(level.level_number) : [];
  }, [level]);
  const sealedTilesActive = activeMechanics.includes('sealed_tiles');
  const telegraphActive = activeMechanics.includes('telegraphed_attacks');
  const corruptionActive = activeMechanics.includes('corrupted_tiles');
  const secondaryObjective = ((level?.modifiers as any)?.secondary_objective ?? null) as SecondaryObjective | null;
  const bossRule = ((level?.modifiers as any)?.boss_rule ?? null) as BossRuleId | null;

  // Build deterministic state.
  useEffect(() => {
    if (!level || !hero) return;
    const rng = mulberry32(level.generation_seed);
    setGrid(generateBoard(rng));
    const seals = buildInitialSeals(level.generation_seed, sealedTilesActive);
    setSeals(seals);
    setCorruption(buildInitialCorruption(level.generation_seed, corruptionActive, level.level_number, seals));
    let enemies: Enemy[] = (level.enemy_config ?? []).map((e: any, i: number) => ({
      id: e.id ?? `e${i}`, name: e.name, emoji: e.emoji, hp: e.hp, maxHp: e.maxHp ?? e.hp, damage: e.damage,
    }));
    if (telegraphActive) enemies = applyInitialIntents(enemies, level.generation_seed, level.level_number);
    setCombat(initialCombat(enemies, level.turn_limit));
  }, [level, hero, sealedTilesActive, telegraphActive, corruptionActive]);

  // One-time intro modal for any brand-new mechanic taught at this level.
  useEffect(() => {
    if (!level || !hero) return;
    const intro = (level.modifiers as any)?.intro_mechanic ?? introMechanicForLevel(level.level_number);
    if (!intro) return;
    try {
      if (!localStorage.getItem(seenMechanicKey(intro))) setIntroMechanic(intro);
    } catch {}
  }, [level, hero]);

  const refillRng = useMemo(() => {
    if (!level) return null;
    return mulberry32(level.generation_seed + 1000 + rngTick);
  }, [level, rngTick]);

  // Lock guard: if user navigates to a locked level via URL.
  if (progress && levelNumber > progress.highest_unlocked_level) {
    return (
      <div className="space-y-4">
        <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Back</Link>
        <div className="glass-card p-6 text-center space-y-2">
          <p className="text-2xl">🔒</p>
          <h2 className="font-extrabold text-base">Level Locked</h2>
          <p className="text-xs text-muted-foreground">Clear Level {progress.highest_unlocked_level} first.</p>
          <button onClick={() => navigate(`/rune-delve/play/${progress.highest_unlocked_level}`)} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold btn-press">
            Go to Level {progress.highest_unlocked_level}
          </button>
        </div>
      </div>
    );
  }

  if (!hero || !level || !grid || !combat || !refillRng) {
    return <div className="h-64 rounded-2xl skeleton-shimmer" />;
  }

  const objType = level.objective_type as ObjectiveType;

  const handleChain = (chain: Cell[]) => {
    if (!isValidChain(grid, chain, seals)) return;
    const type = grid[chain[0].r][chain[0].c];
    const { next, resolution } = applyChain(combat, type, chain.length, hero.class, bossRule);
    if (resolution.enemyKills.length) setFlashId(resolution.enemyKills[0]);

    // Last Stand feedback: red chain landed but the boss is shielded → 0 dmg.
    if (
      bossRule === 'last_stand' &&
      type === 'red' &&
      resolution.damageDealt === 0 &&
      combat.enemies.some(e => e.hp > 0)
    ) {
      toast('🛡️ Boss is shielded — defeat the others first', { duration: 1600 });
    }

    // Apply corruption: HP cost for matching corrupted cells, then strip them.
    let nextCorruption = corruption;
    if (corruptionActive && corruption.cells.size) {
      const r = resolveChainAgainstCorruption(corruption, chain);
      if (r.hpCost > 0) {
        next.hp = Math.max(0, next.hp - r.hpCost);
        toast.error(`☠️ -${r.hpCost} HP from corruption`, { duration: 1100 });
      }
      if (r.sourcesCleared > 0) {
        toast.success(r.sourcesCleared > 1 ? `Sources cleansed!` : `Source cleansed!`, { duration: 1200 });
      }
      nextCorruption = r.next;
    }

    // enemiesAttack already runs applyBossTurnEffects internally — do NOT call it again here.
    const afterEnemies = next.enemies.some(e => e.hp > 0)
      ? enemiesAttack(next, telegraphActive, bossRule)
      : endTurn(next);
    if ((afterEnemies as any).heavyFired) toast.error('⚡ Heavy strike!', { duration: 1200 });
    const newGrid = resolveBoard(grid, chain, refillRng, seals);

    // Break any seals adjacent to the matched cells.
    if (seals.size) {
      const broken = sealsBrokenByChain(seals, chain);
      if (broken.length) {
        const nextSeals = new Set(seals);
        broken.forEach(k => nextSeals.delete(k));
        setSeals(nextSeals);
      }
    }

    // Spread corruption AFTER the chain resolves (player's turn ended).
    if (corruptionActive && nextCorruption.sources.size) {
      nextCorruption = spreadCorruption(nextCorruption, rngTick, level.generation_seed, seals);
    }
    setCorruption(nextCorruption);

    setRngTick(t => t + 1);
    setGrid(newGrid);
    setCombat(afterEnemies);

    const status = checkObjective(afterEnemies, level.turn_limit, objType, level.objective_target, secondaryObjective);
    if (status.over) void finalize(afterEnemies, status.cleared);
  };

  const handleAbility = () => {
    const { next, ok } = useAbility(combat, hero.class, bossRule);
    if (!ok) {
      toast.info('Ability not ready — fill mana orbs first.');
      return;
    }
    // enemiesAttack already runs applyBossTurnEffects internally.
    const after = next.enemies.some(e => e.hp > 0)
      ? enemiesAttack(next, telegraphActive, bossRule)
      : endTurn(next);
    if ((after as any).heavyFired) toast.error('⚡ Heavy strike!', { duration: 1200 });
    // Ability still consumes a turn — corruption advances.
    if (corruptionActive && corruption.sources.size) {
      setCorruption(spreadCorruption(corruption, rngTick, level.generation_seed, seals));
      setRngTick(t => t + 1);
    }
    setCombat(after);
    const status = checkObjective(after, level.turn_limit, objType, level.objective_target, secondaryObjective);
    if (status.over) void finalize(after, status.cleared);
  };

  async function finalize(final: CombatState, cleared: boolean) {
    if (submitting || !level || !hero) return;
    setSubmitting(true);
    const turnsUsed = level.turn_limit - final.turnsRemaining;
    const breakdown = calculateScore({
      totalDamage: final.totalDamage,
      enemiesDefeated: final.enemiesDefeated,
      hpRemaining: final.hp,
      turnsRemaining: final.turnsRemaining,
      longestChain: final.longestChain,
      cleared,
      rogueBonus: final.rogueBonusTriggered && hero.class === 'rogue',
      secondaryBonus: cleared && secondaryObjective
        ? secondaryMet(secondaryObjective, final, level.turn_limit)
        : false,
    });
    const xp = xpForRun(breakdown.total, cleared);
    const reason: 'cleared' | 'defeated' | 'timeout' = cleared ? 'cleared' : final.hp <= 0 ? 'defeated' : 'timeout';
    const isNewBest = !existingRun || breakdown.total > (existingRun.score ?? 0);
    setEndState({ cleared, reason, score: breakdown.total, isNewBest });
    try {
      // Don't submit transient levels (admin hasn't seeded them yet).
      if (!level.id.startsWith('transient-')) {
        await submit.mutateAsync({
          level_id: level.id,
          level_number: level.level_number,
          score: breakdown.total,
          enemies_defeated: final.enemiesDefeated,
          dungeon_cleared: cleared,
          turns_used: turnsUsed,
          total_damage: final.totalDamage,
          longest_chain: final.longestChain,
          hp_remaining: final.hp,
          xp_earned: xp,
          ability_used: final.abilityUsed,
          hero_class: hero.class,
        });
        if (cleared) await advance.mutateAsync(level.level_number);
      }
      // Hero progression — XP only on new best to keep grinding fair.
      if (isNewBest) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const yesterday = format(new Date(Date.now() - 86_400_000), 'yyyy-MM-dd');
        const continued = hero.last_run_date === yesterday;
        const newStreak = continued ? hero.current_streak + 1 : hero.last_run_date === today ? hero.current_streak : 1;

        // ── Per-class progression ──────────────────────────────────────
        // XP, level, and class title belong to the ACTIVE CLASS track only.
        // Other classes' saved progress is untouched.
        const activeTrack = classTracks?.find(t => t.class === hero.class);
        const prevClassXp = activeTrack?.xp ?? hero.xp;
        const prevClassLevel = activeTrack?.level ?? hero.level;
        const newClassXp = prevClassXp + xp;
        const newClassLevel = levelFromXp(newClassXp).level;
        const equippedClassTitle = titleForLevel(newClassLevel, hero.class) ?? activeTrack?.cosmetic_title ?? null;
        const titleUnlock = newTitleUnlocked(hero.class, prevClassLevel, newClassLevel);

        await updateClass.mutateAsync({
          cls: hero.class,
          patch: {
            xp: newClassXp,
            level: newClassLevel,
            cosmetic_title: equippedClassTitle,
            lifetime_runs: (activeTrack?.lifetime_runs ?? 0) + 1,
            lifetime_score: (activeTrack?.lifetime_score ?? 0) + breakdown.total,
          },
        });

        // Hero record holds persistent identity + global lifetime totals only.
        // Mirror the active class's level/xp/title so legacy leaderboard
        // queries that read from `rune_delve_heroes` still show the right
        // active-class snapshot.
        await updateHero.mutateAsync({
          xp: newClassXp,
          level: newClassLevel,
          cosmetic_title: equippedClassTitle,
          current_streak: newStreak,
          best_streak: Math.max(hero.best_streak, newStreak),
          lifetime_runs: hero.lifetime_runs + 1,
          lifetime_score: hero.lifetime_score + breakdown.total,
          last_run_date: today,
        } as any);

        if (titleUnlock) {
          toast.success(`✨ New Title Unlocked — ${titleUnlock.next}`, {
            description: titleUnlock.previous
              ? `From ${titleUnlock.previous} · ${hero.class} Lv ${newClassLevel}`
              : `Equipped at ${hero.class} Lv ${newClassLevel}`,
            duration: 6000,
          });
        }
      }
      setTimeout(() => navigate(`/rune-delve/results/${level.level_number}`), 2500);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save run');
      setSubmitting(false);
      setEndState(null);
    }
  }

  const status = checkObjective(combat, level.turn_limit, objType, level.objective_target, secondaryObjective);
  const turnDisplay = Math.min(
    level.turn_limit,
    Math.max(1, level.turn_limit - combat.turnsRemaining + (status.over ? 0 : 1)),
  );

  return (
    <div className="space-y-4 pb-8 relative">
      <div className="flex items-center justify-between">
        <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Exit</Link>
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-bold text-muted-foreground tabular-nums">
            Lv {level.level_number} · Turn {turnDisplay}/{level.turn_limit}
          </div>
          <button
            onClick={() => setHelpOpen(true)}
            aria-label="How to play"
            className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary btn-press"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active mechanics strip — only when this level uses any mechanic */}
      {activeMechanics.length > 0 && <MechanicBanner mechanics={activeMechanics} />}

      {/* Objective banner */}
      <div className="glass-card px-3 py-2 flex items-center gap-2">
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-primary px-2 py-0.5 rounded-md bg-primary/15">Goal</span>
        <span className="text-[12px] font-bold flex-1 truncate">
          {objectiveLabel(objType)}
          {objType === 'reach_score' && <span className="text-muted-foreground"> · {level.objective_target.toLocaleString()}</span>}
        </span>
        {existingRun && <span className="text-[10px] font-mono font-bold tabular-nums text-muted-foreground">Best {existingRun.score.toLocaleString()}</span>}
      </div>

      {/* Layered Goals — secondary objective pill (Band 4). */}
      {secondaryObjective && (() => {
        const met = secondaryMet(secondaryObjective, combat, level.turn_limit);
        return (
          <div
            className="glass-card px-3 py-2 flex items-center gap-2"
            style={{ borderColor: met ? 'hsl(var(--primary) / 0.45)' : undefined }}
          >
            <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1"
              style={{ background: 'hsl(var(--accent) / 0.18)', color: 'hsl(var(--accent-foreground, var(--foreground)))' }}>
              <Target className="w-3 h-3" /> Bonus
            </span>
            <span className="text-[12px] font-bold flex-1 truncate">{secondaryLabel(secondaryObjective)}</span>
            <span className={`text-[10px] font-extrabold tabular-nums ${met ? 'text-primary' : 'text-muted-foreground'}`}>
              {met ? '✓ Met' : secondaryShort(secondaryObjective)}
            </span>
          </div>
        );
      })()}

      {/* Boss-rule banner — Band 5 milestone levels. */}
      {bossRule && (
        <div
          className="glass-card px-3 py-2 flex items-start gap-2"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.14), hsl(var(--gold) / 0.08))',
            borderColor: 'hsl(var(--destructive) / 0.4)',
          }}
        >
          <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 mt-0.5"
            style={{ background: 'hsl(var(--destructive) / 0.2)', color: 'hsl(var(--destructive))' }}>
            <Crown className="w-3 h-3" /> {getBossRule(bossRule).label}
          </span>
          <span className="text-[11px] font-semibold flex-1 min-w-0 leading-snug">{getBossRule(bossRule).rule}</span>
        </div>
      )}
      <EnemyDisplay enemies={combat.enemies} flashId={flashId} />
      <HeroStatusBar state={combat} cls={hero.class} onAbility={handleAbility} />

      <RuneBoard
        grid={grid}
        disabled={status.over || submitting}
        onChainComplete={handleChain}
        seals={seals}
        corruptedCells={corruption.cells}
        corruptionSources={corruption.sources}
      />

      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card p-2 text-center">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Damage</p>
          <p className="text-sm font-extrabold tabular-nums">{combat.totalDamage}</p>
        </div>
        <div className="glass-card p-2 text-center">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Defeated</p>
          <p className="text-sm font-extrabold tabular-nums">{combat.enemiesDefeated}</p>
        </div>
        <div className="glass-card p-2 text-center">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Best Chain</p>
          <p className="text-sm font-extrabold tabular-nums">{combat.longestChain}</p>
        </div>
      </div>

      <HowToPlaySheet open={helpOpen} onOpenChange={setHelpOpen} heroClass={hero.class} />

      {/* One-time intro for a brand-new mechanic taught at this level. */}
      {introMechanic && (
        <MechanicIntroSheet
          open={!!introMechanic}
          onOpenChange={(o) => { if (!o) setIntroMechanic(null); }}
          mechanicId={introMechanic}
          levelNumber={level.level_number}
          onBegin={() => {
            try { localStorage.setItem(seenMechanicKey(introMechanic), '1'); } catch {}
            setIntroMechanic(null);
          }}
        />
      )}

      {endState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6 backdrop-blur-md bg-background/70 animate-in fade-in"
          // Don't allow tap-outside to navigate while the run is still being saved —
          // prevents an orphaned in-flight write and a missed leaderboard update.
          onClick={() => { if (!submitting) navigate(`/rune-delve/results/${level.level_number}`); }}
        >
          <div className="glass-card p-6 max-w-sm w-full text-center space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center">
              {endState.reason === 'cleared' && <Trophy className="w-12 h-12" style={{ color: 'hsl(var(--gold))' }} />}
              {endState.reason === 'defeated' && <Skull className="w-12 h-12 text-destructive" />}
              {endState.reason === 'timeout' && <Hourglass className="w-12 h-12 text-muted-foreground" />}
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                {endState.reason === 'cleared' && `Level ${level.level_number} Cleared!`}
                {endState.reason === 'defeated' && 'Defeated'}
                {endState.reason === 'timeout' && 'Out of Turns'}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {endState.reason === 'cleared' && (endState.isNewBest ? 'New best score!' : 'Run complete.')}
                {endState.reason === 'defeated' && 'Your hero fell in battle.'}
                {endState.reason === 'timeout' && 'Try a different chain strategy.'}
              </p>
            </div>
            <div className="py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Final Score</p>
              <p className="text-3xl font-extrabold font-mono tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                {endState.score.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => navigate(`/rune-delve/results/${level.level_number}`)}
              className="w-full h-11 rounded-xl font-extrabold text-sm btn-press"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
                color: 'white',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              View Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Objective-aware end check. Layered goals (Band 4) require BOTH primary and
// secondary to be satisfied for a clear; primary failure is still a fail.
function checkObjective(
  state: CombatState,
  maxTurns: number,
  type: ObjectiveType,
  target: number,
  secondary: SecondaryObjective | null,
) {
  const wrap = (r: { over: boolean; cleared: boolean }) => {
    if (!r.over || !r.cleared || !secondary) return r;
    return { over: true, cleared: secondaryMet(secondary, state, maxTurns) };
  };
  const base = isRunOver(state);
  if (type === 'survive') {
    // Defeat is defeat (HP gone). Surviving the full turn budget = clear.
    // ALSO: if the player happens to wipe every enemy, that's a clear too —
    // otherwise the run drags on with nothing to do.
    if (state.hp <= 0) return { over: true, cleared: false };
    if (state.enemies.every(e => e.hp <= 0)) return wrap({ over: true, cleared: true });
    if (state.turnsRemaining <= 0) return wrap({ over: true, cleared: true });
    return { over: false, cleared: false };
  }
  if (type === 'reach_score') {
    // Use the same shape as calculateScore (without clear/secondary/rogue
    // bonuses, which only apply at finalize time). Keeps the in-play check
    // honest with the score the player actually sees on the results screen.
    const liveScore =
      state.totalDamage +
      state.enemiesDefeated * 200 +
      Math.max(0, state.hp) * 5 +
      Math.max(0, state.turnsRemaining) * 50 +
      state.longestChain * 25;
    if (liveScore >= target) {
      return wrap({ over: true, cleared: true });
    }
    return wrap(base);
  }
  return wrap(base);
}
