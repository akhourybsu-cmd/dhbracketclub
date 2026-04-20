import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, HelpCircle, Trophy, Skull, Hourglass } from 'lucide-react';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import { useTodayDungeon, useMyTodayRun, useSubmitRun } from '@/hooks/useRuneDelve';
import { mulberry32 } from '@/lib/runedelve/prng';
import { generateBoard, type RuneType, type Enemy } from '@/lib/runedelve/dungeonGenerator';
import { isValidChain, resolveBoard, type Cell } from '@/lib/runedelve/boardEngine';
import { applyChain, enemiesAttack, endTurn, initialCombat, isRunOver, useAbility, type CombatState } from '@/lib/runedelve/combatEngine';
import { calculateScore, xpForRun } from '@/lib/runedelve/scoring';
import { levelFromXp } from '@/lib/runedelve/classConfig';
import { RuneBoard } from '@/components/runedelve/RuneBoard';
import { EnemyDisplay } from '@/components/runedelve/EnemyDisplay';
import { HeroStatusBar } from '@/components/runedelve/HeroStatusBar';
import { HowToPlaySheet } from '@/components/runedelve/HowToPlaySheet';
import { useUpdateHero } from '@/hooks/useRuneDelveHero';
import { format } from 'date-fns';

export default function RuneDelvePlayPage() {
  const navigate = useNavigate();
  const { data: hero } = useRuneDelveHero();
  const { data: dungeon } = useTodayDungeon();
  const { data: myRun } = useMyTodayRun(dungeon?.id);
  const submit = useSubmitRun();
  const updateHero = useUpdateHero();

  const [grid, setGrid] = useState<RuneType[][] | null>(null);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [rngTick, setRngTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [endState, setEndState] = useState<null | { cleared: boolean; reason: 'cleared' | 'defeated' | 'timeout'; score: number }>(null);

  // Build deterministic state on first load.
  useEffect(() => {
    if (!dungeon || !hero) return;
    const rng = mulberry32(dungeon.seed);
    setGrid(generateBoard(rng));
    const enemies: Enemy[] = (dungeon.enemy_config ?? []).map((e: any, i: number) => ({
      id: e.id ?? `e${i}`, name: e.name, emoji: e.emoji, hp: e.hp, maxHp: e.maxHp ?? e.hp, damage: e.damage,
    }));
    setCombat(initialCombat(enemies, dungeon.max_turns));
  }, [dungeon, hero]);

  // Refill rng — derived from seed + turn so it's deterministic but advances.
  const refillRng = useMemo(() => {
    if (!dungeon) return null;
    return mulberry32(dungeon.seed + 1000 + rngTick);
  }, [dungeon, rngTick]);

  if (myRun) {
    return (
      <div className="space-y-4">
        <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Back</Link>
        <div className="glass-card p-6 text-center">
          <p className="text-2xl mb-2">🗝️</p>
          <h2 className="font-extrabold text-base mb-1">You've delved today</h2>
          <p className="text-xs text-muted-foreground mb-4">Today's score: <span className="font-mono font-bold text-gold">{myRun.score.toLocaleString()}</span></p>
          <button onClick={() => navigate('/rune-delve/results')} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold btn-press">View Results</button>
        </div>
      </div>
    );
  }

  if (!hero || !dungeon || !grid || !combat || !refillRng) {
    return <div className="h-64 rounded-2xl skeleton-shimmer" />;
  }

  const handleChain = (chain: Cell[]) => {
    if (!isValidChain(grid, chain)) return;
    const type = grid[chain[0].r][chain[0].c];
    const { next, resolution } = applyChain(combat, type, chain.length, hero.class);
    if (resolution.enemyKills.length) setFlashId(resolution.enemyKills[0]);
    // Enemies attack only if any are still alive; otherwise just consume the turn.
    const afterEnemies = next.enemies.some(e => e.hp > 0) ? enemiesAttack(next) : endTurn(next);
    const newGrid = resolveBoard(grid, chain, refillRng);
    setRngTick(t => t + 1);
    setGrid(newGrid);
    setCombat(afterEnemies);

    const status = isRunOver(afterEnemies);
    if (status.over) {
      void finalize(afterEnemies, status.cleared);
    }
  };

  const handleAbility = () => {
    const { next, ok } = useAbility(combat, hero.class);
    if (!ok) {
      toast.info('Ability not ready — fill mana orbs first.');
      return;
    }
    const after = next.enemies.some(e => e.hp > 0) ? enemiesAttack(next) : endTurn(next);
    setCombat(after);
    const status = isRunOver(after);
    if (status.over) void finalize(after, status.cleared);
  };

  async function finalize(final: CombatState, cleared: boolean) {
    if (submitting || !dungeon || !hero) return;
    setSubmitting(true);
    const turnsUsed = dungeon.max_turns - final.turnsRemaining;
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
    // Determine end reason for the overlay.
    const reason: 'cleared' | 'defeated' | 'timeout' = cleared ? 'cleared' : final.hp <= 0 ? 'defeated' : 'timeout';
    setEndState({ cleared, reason, score: breakdown.total });
    try {
      await submit.mutateAsync({
        dungeon_id: dungeon.id,
        run_date: format(new Date(), 'yyyy-MM-dd'),
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
        pick_log: [],
      });
      // Update hero progression.
      const today = format(new Date(), 'yyyy-MM-dd');
      const yesterday = format(new Date(Date.now() - 86_400_000), 'yyyy-MM-dd');
      const continued = hero.last_run_date === yesterday;
      const newStreak = continued ? hero.current_streak + 1 : 1;
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
      // Auto-advance after a brief beat so the player sees the outcome.
      setTimeout(() => navigate('/rune-delve/results'), 2500);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save run');
      setSubmitting(false);
      setEndState(null);
    }
  }

  const status = isRunOver(combat);
  // Turn counter: clamp to max_turns; show "10/10" while resolving the final turn.
  const turnDisplay = Math.min(
    dungeon.max_turns,
    Math.max(1, dungeon.max_turns - combat.turnsRemaining + (status.over ? 0 : 1)),
  );

  return (
    <div className="space-y-4 pb-8 relative">
      <div className="flex items-center justify-between">
        <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Exit</Link>
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-bold text-muted-foreground tabular-nums">
            Turn {turnDisplay} / {dungeon.max_turns}
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
          onClick={() => navigate('/rune-delve/results')}
        >
          <div className="glass-card p-6 max-w-sm w-full text-center space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center">
              {endState.reason === 'cleared' && <Trophy className="w-12 h-12" style={{ color: 'hsl(var(--gold))' }} />}
              {endState.reason === 'defeated' && <Skull className="w-12 h-12 text-destructive" />}
              {endState.reason === 'timeout' && <Hourglass className="w-12 h-12 text-muted-foreground" />}
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                {endState.reason === 'cleared' && 'Dungeon Cleared!'}
                {endState.reason === 'defeated' && 'Defeated'}
                {endState.reason === 'timeout' && 'Out of Turns'}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {endState.reason === 'cleared' && 'Every enemy fell to your blade.'}
                {endState.reason === 'defeated' && 'Your hero fell in battle.'}
                {endState.reason === 'timeout' && 'The dungeon outlasted you.'}
              </p>
            </div>
            <div className="py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Final Score</p>
              <p className="text-3xl font-extrabold font-mono tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                {endState.score.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => navigate('/rune-delve/results')}
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
