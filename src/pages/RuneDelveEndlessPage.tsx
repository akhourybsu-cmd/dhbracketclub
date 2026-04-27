import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Timer, Skull, Trophy, Sparkles as SparklesIcon } from 'lucide-react';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import { useEarnShards } from '@/hooks/useRuneShards';
import { useSubmitDailyRun, useMyDailyRun } from '@/hooks/useDailyChallenge';
import {
  ENDLESS_TIME_LIMIT_SEC,
  endlessRewardFor,
  endlessScore,
  enemyTickIntervalMs,
  spawnBatch,
  spawnEnemy,
  waveForElapsed,
} from '@/lib/runedelve/endlessMode';
import { mulberry32 } from '@/lib/runedelve/prng';
import { generateBoard, type RuneType } from '@/lib/runedelve/dungeonGenerator';
import { isValidChain, resolveBoard, type Cell } from '@/lib/runedelve/boardEngine';
import {
  applyChain,
  initialCombat,
  useAbility,
  MAX_MANA,
  type CombatState,
} from '@/lib/runedelve/combatEngine';
import { RuneBoard } from '@/components/runedelve/RuneBoard';
import { EnemyDisplay } from '@/components/runedelve/EnemyDisplay';
import { HeroStatusBar } from '@/components/runedelve/HeroStatusBar';
import { applyArmorToDamage } from '@/lib/runedelve/enemyAbilities';

/**
 * Endless Survival — the daily challenge.
 *
 * 2-minute timed arena. Player chains runes freely (no turn limit). Enemies
 * spawn continuously and ramp every 20s. Run ends when timer hits 0 or HP
 * reaches 0. Rewards scale with kill count.
 *
 * This page intentionally does NOT use the campaign play page's heavy
 * relic/mastery/mechanics stack — endless is a pure combat-loop experience
 * focused on raw class power. Class chain damage and abilities still apply
 * (via combatEngine), so investing in your hero meaningfully matters.
 */
export default function RuneDelveEndlessPage() {
  const navigate = useNavigate();
  const { data: hero } = useRuneDelveHero();
  const { data: existingRun } = useMyDailyRun();
  const submitDaily = useSubmitDailyRun();
  const earnShards = useEarnShards();

  // ── Run state ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const [grid, setGrid] = useState<RuneType[][] | null>(null);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [kills, setKills] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [endResult, setEndResult] = useState<null | {
    kills: number;
    score: number;
    reward: ReturnType<typeof endlessRewardFor>;
    stars: number;
    reason: 'timeout' | 'defeated';
  }>(null);
  const [submitting, setSubmitting] = useState(false);

  const seedRef = useRef<number>(Date.now() & 0xffffffff);
  const startTimeRef = useRef<number>(0);
  const enemySpawnSeqRef = useRef(0);
  const elapsedRef = useRef(0);
  const phaseRef = useRef<'ready' | 'playing' | 'over'>('ready');
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { elapsedRef.current = elapsedSec; }, [elapsedSec]);

  const heroClass = hero?.class ?? 'warrior';

  // ── Start / restart ──────────────────────────────────────────────────────
  function startRun() {
    if (existingRun) {
      toast('You already played today\'s daily.');
      return;
    }
    seedRef.current = Date.now() & 0xffffffff;
    enemySpawnSeqRef.current = 0;
    const rng = mulberry32(seedRef.current);
    setGrid(generateBoard(rng));
    const initialEnemies = spawnBatch(0, seedRef.current);
    setCombat(initialCombat(initialEnemies, 9999));
    setKills(0);
    setElapsedSec(0);
    setEndResult(null);
    startTimeRef.current = performance.now();
    setPhase('playing');
  }

  // ── Timer tick ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      setElapsedSec(elapsed);
      if (elapsed >= ENDLESS_TIME_LIMIT_SEC) {
        endRun('timeout');
      }
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Enemy attack tick — interval scales with current wave ────────────────
  // Use refs (not elapsedSec/combat in deps) so the 250ms timer tick doesn't
  // keep cancelling the attack timeout before it fires.
  useEffect(() => {
    if (phase !== 'playing') return;
    let cancelled = false;
    let timeoutId: number | null = null;
    const schedule = () => {
      if (cancelled) return;
      const interval = enemyTickIntervalMs(elapsedRef.current);
      timeoutId = window.setTimeout(() => {
        if (cancelled || phaseRef.current !== 'playing') return;
        setCombat(prev => {
          if (!prev) return prev;
          let incoming = 0;
          for (const e of prev.enemies) if (e.hp > 0) incoming += e.damage;
          if (incoming === 0) return prev;
          const guarded = prev.shieldTurns > 0 ? Math.round(incoming * 0.4) : incoming;
          const nextHp = Math.max(0, prev.hp - guarded);
          return { ...prev, hp: nextHp, shieldTurns: Math.max(0, prev.shieldTurns - 1) };
        });
        schedule();
      }, interval);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [phase]);

  // ── Continuous spawning — refill when field gets empty ───────────────────
  // Only depend on whether the field is empty, not on elapsedSec, so the
  // respawn timeout isn't cancelled four times per second by the timer tick.
  const aliveCount = combat?.enemies.filter(e => e.hp > 0).length ?? 0;
  useEffect(() => {
    if (phase !== 'playing' || !combat) return;
    if (aliveCount > 0) return;
    const wave = waveForElapsed(elapsedRef.current);
    const id = window.setTimeout(() => {
      if (phaseRef.current !== 'playing') return;
      setCombat(prev => {
        if (!prev) return prev;
        enemySpawnSeqRef.current += 1;
        const fresh = spawnBatch(elapsedRef.current, seedRef.current ^ enemySpawnSeqRef.current);
        const alive = prev.enemies.filter(e => e.hp > 0);
        return { ...prev, enemies: [...alive, ...fresh] };
      });
    }, wave.respawnDelayMs);
    return () => window.clearTimeout(id);
  }, [phase, aliveCount, combat]);

  // ── Death check ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'playing' && combat && combat.hp <= 0) {
      endRun('defeated');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.hp, phase]);

  // ── Chain resolution ─────────────────────────────────────────────────────
  function handleChain(chain: Cell[]) {
    if (phase !== 'playing' || !grid || !combat) return;
    if (!isValidChain(grid, chain)) return;
    const type = grid[chain[0].r][chain[0].c];
    const { next, resolution } = applyChain(combat, type, chain.length, heroClass);
    if (resolution.enemyKills.length > 0) {
      setKills(k => k + resolution.enemyKills.length);
    }
    setCombat(next);
    const rng = mulberry32((seedRef.current ^ Math.floor(performance.now())) >>> 0);
    setGrid(g => (g ? resolveBoard(g, chain, rng) : g));
  }

  function handleAbility() {
    if (phase !== 'playing' || !combat) return;
    if (combat.mana < MAX_MANA) return;
    const before = combat.enemiesDefeated;
    const { next, ok } = useAbility(combat, heroClass);
    if (!ok) return;
    const newKills = next.enemiesDefeated - before;
    if (newKills > 0) setKills(k => k + newKills);
    setCombat(next);
  }

  // ── Run end + submission ─────────────────────────────────────────────────
  function endRun(reason: 'timeout' | 'defeated') {
    if (phase === 'over') return;
    setPhase('over');
    setCombat(prev => prev); // freeze
    const finalKills = kills;
    setTimeout(() => {
      // Read freshest values via setState callback to avoid stale closure.
      setKills(k => {
        setCombat(c => {
          submitFinal(k, c?.totalDamage ?? 0, reason);
          return c;
        });
        return k;
      });
    }, 50);
    void finalKills;
  }

  async function submitFinal(finalKills: number, totalDamage: number, reason: 'timeout' | 'defeated') {
    if (submitting || !hero) return;
    setSubmitting(true);
    const score = endlessScore(finalKills, totalDamage);
    const reward = endlessRewardFor(finalKills);
    const stars = (finalKills >= 25 ? 3 : finalKills >= 15 ? 2 : finalKills >= 5 ? 1 : 0) as 0 | 1 | 2 | 3;
    setEndResult({ kills: finalKills, score, reward, stars, reason });
    try {
      await submitDaily.mutateAsync({ kills: finalKills, score, heroClass: hero.class });
      if (reward.shards > 0) {
        try { await earnShards.mutateAsync(reward.shards); } catch { /* best-effort */ }
      }
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      toast.success(`${starStr} · ${finalKills} kills`, {
        description: `+${reward.shards} shards · +${reward.xp} XP${reward.title ? ` · 🏆 ${reward.title}` : ''}`,
        duration: 6000,
      });
    } catch (e: any) {
      toast.error(`Couldn't save run: ${e?.message ?? 'unknown'}`);
    } finally {
      setSubmitting(false);
    }
  }

  const remainingSec = Math.max(0, ENDLESS_TIME_LIMIT_SEC - Math.floor(elapsedSec));
  const wave = waveForElapsed(elapsedSec);
  const timePct = Math.max(0, Math.min(100, (remainingSec / ENDLESS_TIME_LIMIT_SEC) * 100));

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 pb-8">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/rune-delve/daily')}
          className="flex items-center gap-1 text-[12px] font-bold text-foreground/75 btn-press"
        >
          <ArrowLeft className="w-4 h-4" /> Daily
        </button>
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'hsl(var(--gold))' }}>
          <Timer className="w-3.5 h-3.5" /> Endless · {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')}
        </div>
      </div>

      {phase === 'ready' && (
        <div className="glass-card p-5 text-center space-y-3" style={{
          background: 'linear-gradient(160deg, hsl(var(--gold) / 0.10), hsl(var(--primary) / 0.06))',
          borderColor: 'hsl(var(--gold) / 0.25)',
        }}>
          <h2 className="rd-title text-2xl">Endless Arena</h2>
          <p className="text-[12px] text-foreground/80 leading-snug">
            You have <span className="font-extrabold text-foreground">{ENDLESS_TIME_LIMIT_SEC / 60} minutes</span>.
            Chain runes, kill enemies, stay alive. No move limit. Stronger relics + masteries → more kills.
          </p>
          {existingRun ? (
            <p className="text-[11px] text-muted-foreground">
              You already played today. Best: {existingRun.kills_count} kills · {existingRun.score.toLocaleString()} pts.
            </p>
          ) : (
            <button
              onClick={startRun}
              disabled={!hero}
              className="w-full h-12 rounded-xl font-extrabold text-sm btn-press flex items-center justify-center gap-2 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold)), hsl(var(--primary-glow)))',
                color: 'hsl(var(--background))',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <SparklesIcon className="w-4 h-4" /> Start Run
            </button>
          )}
        </div>
      )}

      {phase === 'playing' && combat && grid && (
        <>
          {/* Timer + wave HUD */}
          <div className="glass-card p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-extrabold uppercase tracking-wider" style={{ color: 'hsl(var(--gold))' }}>
                Wave {wave.index} · {wave.label}
              </span>
              <span className="font-mono font-extrabold tabular-nums">
                {kills} kills
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${timePct}%`,
                  background: timePct > 25
                    ? 'linear-gradient(90deg, hsl(var(--gold)), hsl(var(--primary-glow)))'
                    : 'linear-gradient(90deg, hsl(var(--destructive)), hsl(var(--destructive) / 0.7))',
                }}
              />
            </div>
          </div>

          <EnemyDisplay enemies={combat.enemies} />
          <HeroStatusBar state={combat} cls={heroClass} onAbility={handleAbility} />
          <RuneBoard grid={grid} onChainComplete={handleChain} />
        </>
      )}

      {phase === 'over' && endResult && (
        <div className="glass-card p-5 text-center space-y-3" style={{
          background: 'linear-gradient(160deg, hsl(var(--gold) / 0.12), hsl(var(--primary) / 0.08))',
          borderColor: 'hsl(var(--gold) / 0.25)',
        }}>
          <div className="flex items-center justify-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-foreground/70">
            {endResult.reason === 'defeated' ? <Skull className="w-3.5 h-3.5" /> : <Timer className="w-3.5 h-3.5" />}
            {endResult.reason === 'defeated' ? 'Defeated' : 'Time\'s Up'}
          </div>
          <h2 className="rd-title text-3xl" style={{ color: 'hsl(var(--gold))' }}>
            {'★'.repeat(endResult.stars)}{'☆'.repeat(3 - endResult.stars)}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Kills" value={endResult.kills.toString()} />
            <Stat label="Score" value={endResult.score.toLocaleString()} />
            <Stat label="Shards" value={`+${endResult.reward.shards}`} highlight />
            <Stat label="XP" value={`+${endResult.reward.xp}`} />
          </div>
          {endResult.reward.title && (
            <div className="rounded-xl border border-gold/40 bg-gold/10 p-2.5 text-[11px] font-extrabold flex items-center justify-center gap-1.5" style={{ color: 'hsl(var(--gold))' }}>
              <Trophy className="w-3.5 h-3.5" /> Title Earned: {endResult.reward.title}
            </div>
          )}
          <button
            onClick={() => navigate('/rune-delve/daily')}
            className="w-full h-11 rounded-xl font-extrabold text-sm btn-press"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
              color: 'hsl(var(--background))',
            }}
          >
            Back to Daily
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="glass-card p-2.5 text-center" style={highlight ? { borderColor: 'hsl(var(--gold) / 0.3)' } : undefined}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono font-extrabold text-base tabular-nums mt-0.5" style={highlight ? { color: 'hsl(var(--gold))' } : undefined}>
        {value}
      </p>
    </div>
  );
}
