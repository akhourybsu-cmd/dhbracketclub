import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, HelpCircle, Trophy, Skull, Hourglass } from 'lucide-react';
import { useRuneDelveHero, useUpdateHero } from '@/hooks/useRuneDelveHero';
import { useLevel, useMyLevelRun, useSubmitLevelRun, useAdvanceProgress, useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { mulberry32 } from '@/lib/runedelve/prng';
import { generateBoard, type RuneType, type Enemy } from '@/lib/runedelve/dungeonGenerator';
import { isValidChain, resolveBoard, type Cell } from '@/lib/runedelve/boardEngine';
import { applyChain, enemiesAttack, endTurn, initialCombat, isRunOver, useAbility, type CombatState } from '@/lib/runedelve/combatEngine';
import { calculateScore, xpForRun } from '@/lib/runedelve/scoring';
import { levelFromXp } from '@/lib/runedelve/classConfig';
import { objectiveLabel, type ObjectiveType } from '@/lib/runedelve/levelGenerator';
import { RuneBoard } from '@/components/runedelve/RuneBoard';
import { EnemyDisplay } from '@/components/runedelve/EnemyDisplay';
import { HeroStatusBar } from '@/components/runedelve/HeroStatusBar';
import { HowToPlaySheet } from '@/components/runedelve/HowToPlaySheet';
import { format } from 'date-fns';

export default function RuneDelvePlayPage() {
  const navigate = useNavigate();
  const { levelNumber: levelParam } = useParams<{ levelNumber: string }>();
  const levelNumber = Math.max(1, parseInt(levelParam ?? '1', 10) || 1);

  const { data: hero } = useRuneDelveHero();
  const { data: progress } = useMyProgress();
  const { data: level } = useLevel(levelNumber);
  const { data: existingRun } = useMyLevelRun(level?.id);
  const submit = useSubmitLevelRun();
  const advance = useAdvanceProgress();
  const updateHero = useUpdateHero();

  const [grid, setGrid] = useState<RuneType[][] | null>(null);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [rngTick, setRngTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [endState, setEndState] = useState<null | { cleared: boolean; reason: 'cleared' | 'defeated' | 'timeout'; score: number; isNewBest: boolean }>(null);

  // Build deterministic state.
  useEffect(() => {
    if (!level || !hero) return;
    const rng = mulberry32(level.generation_seed);
    setGrid(generateBoard(rng));
    const enemies: Enemy[] = (level.enemy_config ?? []).map((e: any, i: number) => ({
      id: e.id ?? `e${i}`, name: e.name, emoji: e.emoji, hp: e.hp, maxHp: e.maxHp ?? e.hp, damage: e.damage,
    }));
    setCombat(initialCombat(enemies, level.turn_limit));
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
    if (!isValidChain(grid, chain)) return;
    const type = grid[chain[0].r][chain[0].c];
    const { next, resolution } = applyChain(combat, type, chain.length, hero.class);
    if (resolution.enemyKills.length) setFlashId(resolution.enemyKills[0]);
    const afterEnemies = next.enemies.some(e => e.hp > 0) ? enemiesAttack(next) : endTurn(next);
    const newGrid = resolveBoard(grid, chain, refillRng);
    setRngTick(t => t + 1);
    setGrid(newGrid);
    setCombat(afterEnemies);

    const status = checkObjective(afterEnemies, level.turn_limit, objType, level.objective_target);
    if (status.over) void finalize(afterEnemies, status.cleared);
  };

  const handleAbility = () => {
    const { next, ok } = useAbility(combat, hero.class);
    if (!ok) {
      toast.info('Ability not ready — fill mana orbs first.');
      return;
    }
    const after = next.enemies.some(e => e.hp > 0) ? enemiesAttack(next) : endTurn(next);
    setCombat(after);
    const status = checkObjective(after, level.turn_limit, objType, level.objective_target);
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
        const newXp = hero.xp + xp;
        const newLevel = levelFromXp(newXp).level;
        await updateHero.mutateAsync({
          xp: newXp,
          level: newLevel,
          current_streak: newStreak,
          best_streak: Math.max(hero.best_streak, newStreak),
          lifetime_runs: hero.lifetime_runs + 1,
          lifetime_score: hero.lifetime_score + breakdown.total,
          last_run_date: today,
        } as any);
      }
      setTimeout(() => navigate(`/rune-delve/results/${level.level_number}`), 2500);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save run');
      setSubmitting(false);
      setEndState(null);
    }
  }

  const status = checkObjective(combat, level.turn_limit, objType, level.objective_target);
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
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary btn-press"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Objective banner */}
      <div className="glass-card px-3 py-2 flex items-center gap-2">
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-primary px-2 py-0.5 rounded-md bg-primary/15">Goal</span>
        <span className="text-[12px] font-bold flex-1 truncate">
          {objectiveLabel(objType)}
          {objType === 'reach_score' && <span className="text-muted-foreground"> · {level.objective_target.toLocaleString()}</span>}
        </span>
        {existingRun && <span className="text-[10px] font-mono font-bold tabular-nums text-muted-foreground">Best {existingRun.score.toLocaleString()}</span>}
      </div>

      <EnemyDisplay enemies={combat.enemies} flashId={flashId} />
      <HeroStatusBar state={combat} cls={hero.class} onAbility={handleAbility} />

      <RuneBoard grid={grid} disabled={status.over || submitting} onChainComplete={handleChain} />

      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card p-2 text-center">
          <p className="text-[8px] font-bold text-muted-foreground uppercase">Damage</p>
          <p className="text-sm font-extrabold tabular-nums">{combat.totalDamage}</p>
        </div>
        <div className="glass-card p-2 text-center">
          <p className="text-[8px] font-bold text-muted-foreground uppercase">Defeated</p>
          <p className="text-sm font-extrabold tabular-nums">{combat.enemiesDefeated}</p>
        </div>
        <div className="glass-card p-2 text-center">
          <p className="text-[8px] font-bold text-muted-foreground uppercase">Best Chain</p>
          <p className="text-sm font-extrabold tabular-nums">{combat.longestChain}</p>
        </div>
      </div>

      <HowToPlaySheet open={helpOpen} onOpenChange={setHelpOpen} heroClass={hero.class} />

      {endState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6 backdrop-blur-md bg-background/70 animate-in fade-in"
          onClick={() => navigate(`/rune-delve/results/${level.level_number}`)}
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

// Objective-aware end check.
function checkObjective(state: CombatState, maxTurns: number, type: ObjectiveType, target: number) {
  const base = isRunOver(state);
  if (type === 'survive') {
    // Cleared if you outlast the move budget without dying. Defeated only if HP=0.
    if (state.hp <= 0) return { over: true, cleared: false };
    if (state.turnsRemaining <= 0) return { over: true, cleared: true };
    return { over: false, cleared: false };
  }
  if (type === 'reach_score') {
    if (state.totalDamage * 1 + state.enemiesDefeated * 200 + state.longestChain * 25 >= target) {
      return { over: true, cleared: true };
    }
    return base;
  }
  // defeat_all + defeat_elite both clear when every enemy is dead.
  return base;
}
