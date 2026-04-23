// Admin-only headless playtest simulator for Rune Delve.
//
// Drives the real combat/board engines via `simulator.ts` to stress-test any
// level (1-150) without ever touching player records. Runs entirely in the
// browser; no DB writes. Hidden behind the global admin role gate.

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Play, Loader2, Sparkles, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CLASS_LIST, type HeroClass } from '@/lib/runedelve/classConfig';
import { simulateBand, type SimAggregate } from '@/lib/runedelve/simulator';
import { generateLevel } from '@/lib/runedelve/levelGenerator';
import { bossKindForLevel } from '@/lib/runedelve/bossRules';
import { cn } from '@/lib/utils';

const VERDICT_COLORS: Record<SimAggregate['verdict'], string> = {
  Brutal:   'text-destructive border-destructive/50 bg-destructive/10',
  Hard:     'text-gold border-gold/50 bg-gold/10',
  Balanced: 'text-success border-success/50 bg-success/10',
  Easy:     'text-accent border-accent/50 bg-accent/10',
  Trivial:  'text-muted-foreground border-border bg-muted/30',
};

export default function RuneDelveSimulatorPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Form state
  const [startLevel, setStartLevel] = useState(25);
  const [endLevel, setEndLevel] = useState(27);
  const [cls, setCls] = useState<HeroClass>('warrior');
  const [runsPerLevel, setRunsPerLevel] = useState(100);

  // Run state
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [results, setResults] = useState<SimAggregate[]>([]);
  const [meta, setMeta] = useState<string>('');

  // Admin gate
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }: any) => setIsAdmin(!!data));
  }, [user]);

  const totalRuns = useMemo(
    () => Math.max(0, endLevel - startLevel + 1) * runsPerLevel,
    [startLevel, endLevel, runsPerLevel],
  );

  if (isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (isAdmin === false) return <Navigate to="/rune-delve" replace />;

  async function run() {
    if (running) return;
    if (endLevel < startLevel) return;
    setRunning(true);
    setResults([]);
    setMeta('');
    const total = endLevel - startLevel + 1;
    setProgress({ done: 0, total });

    // Run one level at a time, yielding to the event loop between levels so
    // the UI can repaint progress. Total runs scale ≤ 150 levels × 200 runs,
    // typically completing in a few seconds.
    const acc: SimAggregate[] = [];
    const t0 = performance.now();
    for (let lvl = startLevel; lvl <= endLevel; lvl++) {
      const band = simulateBand(lvl, lvl, cls, runsPerLevel);
      acc.push(...band);
      setResults([...acc]);
      setProgress({ done: lvl - startLevel + 1, total });
      // Yield so the browser can paint the progress bar.
      await new Promise(r => setTimeout(r, 0));
    }
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    setMeta(`${total} levels × ${runsPerLevel} runs · ${elapsed}s`);
    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/rune-delve/analytics" className="p-2 rounded-lg hover:bg-muted/50">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-extrabold tracking-tight">Rune Delve · Playtest Simulator</h1>
            <p className="text-[11px] text-muted-foreground">Stress-test any level before players touch it. Admin-only · no DB writes.</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {/* Controls */}
        <div className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">From level</div>
              <input
                type="number" min={1} max={150} value={startLevel}
                onChange={e => setStartLevel(Math.max(1, Math.min(150, +e.target.value || 1)))}
                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border font-mono text-sm tabular-nums"
                disabled={running}
              />
            </label>
            <label className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">To level</div>
              <input
                type="number" min={1} max={150} value={endLevel}
                onChange={e => setEndLevel(Math.max(1, Math.min(150, +e.target.value || 1)))}
                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border font-mono text-sm tabular-nums"
                disabled={running}
              />
            </label>
            <label className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">Runs per level</div>
              <select
                value={runsPerLevel}
                onChange={e => setRunsPerLevel(+e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border text-sm"
                disabled={running}
              >
                {[25, 50, 100, 200, 400].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">Class</div>
              <select
                value={cls}
                onChange={e => setCls(e.target.value as HeroClass)}
                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border text-sm"
                disabled={running}
              >
                {CLASS_LIST.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground">
              {totalRuns.toLocaleString()} simulated runs · seed-deterministic AI player
            </div>
            <button
              onClick={run}
              disabled={running || endLevel < startLevel}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground font-extrabold text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? `Running L${startLevel + progress.done - 1 || startLevel}…` : 'Run simulation'}
            </button>
          </div>

          {running && (
            <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <>
            {meta && (
              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-3 h-3" /> {meta}
              </div>
            )}
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider text-[9px] font-extrabold">
                    <tr>
                      <th className="text-left p-2 sticky left-0 bg-muted/40">Lvl</th>
                      <th className="text-left p-2">Verdict</th>
                      <th className="text-right p-2">Win %</th>
                      <th className="text-right p-2">Avg Turns</th>
                      <th className="text-right p-2">HP/Turn Need</th>
                      <th className="text-right p-2">Avg Dmg Out</th>
                      <th className="text-right p-2">Avg Dmg In</th>
                      <th className="text-right p-2">Near-Death %</th>
                      <th className="text-right p-2">Min HP</th>
                      <th className="text-right p-2">Abil/Run</th>
                      <th className="text-right p-2">Heavy/Run</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => {
                      const def = generateLevel(r.level);
                      const kind = bossKindForLevel(r.level);
                      return (
                        <tr key={r.level} className="border-t border-border/40 hover:bg-muted/20">
                          <td className="p-2 sticky left-0 bg-background/95 font-extrabold tabular-nums">
                            <div className="flex items-center gap-1">
                              {r.level}
                              {kind === 'mini' && <span title="Mini-boss" className="text-gold">★</span>}
                              {kind === 'mid' && <span title="Mid-boss" className="text-gold">★★</span>}
                              {kind === 'chapter' && <span title="Chapter boss" className="text-gold">★★★</span>}
                            </div>
                            <div className="text-[9px] text-muted-foreground font-normal">
                              T{def.turn_limit} · {def.enemy_config.length}e
                              {def.modifiers?.boss_rule && ` · ${def.modifiers.boss_rule}`}
                            </div>
                          </td>
                          <td className="p-2">
                            <span className={cn('px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase tracking-wider', VERDICT_COLORS[r.verdict])}>
                              {r.verdict}
                            </span>
                          </td>
                          <td className="p-2 text-right tabular-nums font-extrabold">{(r.clearRate * 100).toFixed(1)}%</td>
                          <td className="p-2 text-right tabular-nums">{r.avgTurnsUsed.toFixed(1)}</td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">{r.hpPerTurnBudget.toFixed(1)}</td>
                          <td className="p-2 text-right tabular-nums">{r.avgDamageDealt.toFixed(0)}</td>
                          <td className="p-2 text-right tabular-nums text-destructive/80">{r.avgDamageTaken.toFixed(1)}</td>
                          <td className="p-2 text-right tabular-nums">{(r.nearDeathRate * 100).toFixed(0)}%</td>
                          <td className="p-2 text-right tabular-nums">{r.avgMinHp.toFixed(0)}</td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">{r.avgEnemyAbilityFires.toFixed(1)}</td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">{r.avgHeavyStrikeFires.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tuning hints */}
            <div className="glass-card p-3 text-[11px] space-y-1 text-muted-foreground">
              <div className="flex items-center gap-2 font-extrabold text-foreground"><Activity className="w-3 h-3" /> Tuning hints</div>
              <div>• <span className="text-destructive font-bold">Brutal</span> (&lt;15% wins): probably mathematically impossible — bump turns or shave boss HP.</div>
              <div>• <span className="text-gold font-bold">Hard</span> (15-45%): tense — verify near-death % isn't above 80% (means survival is luck-based).</div>
              <div>• <span className="text-success font-bold">Balanced</span> (45-80%): the sweet spot — keep it here.</div>
              <div>• <span className="text-accent font-bold">Easy / Trivial</span> (&gt;80%): consider tightening turns or adding a mechanic.</div>
              <div>• <span className="text-foreground font-bold">HP/Turn Need</span> &gt; 30 with low Avg Dmg Out flags an unreachable DPS budget.</div>
            </div>
          </>
        )}

        {!running && results.length === 0 && (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">
            Pick a level range, class, and run count, then hit <span className="font-bold text-foreground">Run simulation</span>.
            Future levels (locked to players) are fully testable — generation is deterministic from the level number.
          </div>
        )}
      </div>
    </div>
  );
}
