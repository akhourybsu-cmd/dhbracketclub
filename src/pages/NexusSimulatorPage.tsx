// Nexus Defense — Admin Endless Simulator
//
// Mobile-first admin tool that drives the headless simulator in batches and
// surfaces tuning recommendations. Read-only: no DB writes, no run records,
// no leaderboard impact.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Square, FlaskConical, Download, ChevronDown, ChevronUp, AlertTriangle, Wrench,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  STRATEGY_LABELS, StrategyId, SimRunResult, SimAggregate,
  runOne, aggregate, hasConverged,
} from '@/lib/nexus/simulator';
import { TOWERS } from '@/lib/nexus/towers';

type RunCountPreset = 50 | 250 | 1000 | 5000;
type Mode = 'fixed' | 'adaptive';

const RUN_PRESETS: RunCountPreset[] = [50, 250, 1000, 5000];
const STRATEGIES: StrategyId[] = [
  'realmix', 'tourist', 'hoarder', 'spammer', 'distracted', 'learner',
  'basic', 'balanced', 'optimizer', 'random',
];

const VERDICT_STYLES: Record<SimAggregate['verdict'], string> = {
  TooEasy: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  Easy: 'bg-amber-400/10 text-amber-200 border-amber-400/30',
  Balanced: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  Hard: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  Brutal: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
};

export default function NexusSimulatorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const workshopCtx = (location.state ?? {}) as { source?: string; draftId?: string; draftName?: string; kind?: string };
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [strategy, setStrategy] = useState<StrategyId>('realmix');
  const [mode, setMode] = useState<Mode>('fixed');
  const [runCount, setRunCount] = useState<RunCountPreset>(250);
  const [seed, setSeed] = useState<string>('42');
  const [maxAdaptive, setMaxAdaptive] = useState<number>(1000);

  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<SimAggregate | null>(null);
  const [openSection, setOpenSection] = useState<string | null>('summary');

  // Admin guard
  useEffect(() => {
    if (!user) return;
    (supabase as any).from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }: any) => {
        if (data) setAuthorized(true);
        else { setAuthorized(false); toast.error('Admin only'); navigate('/nexus', { replace: true }); }
      });
  }, [user, navigate]);

  const cancel = () => { cancelRef.current = true; };

  const start = async () => {
    cancelRef.current = false;
    setRunning(true);
    setResult(null);
    const baseSeed = parseInt(seed, 10) || 1;
    const target = mode === 'fixed' ? runCount : maxAdaptive;
    setProgress({ done: 0, total: target });

    const all: SimRunResult[] = [];
    const BATCH = 25;
    let prevAvg = 0;
    let convergedBatches = 0;

    try {
      for (let i = 0; i < target; i += BATCH) {
        if (cancelRef.current) break;
        const upper = Math.min(target, i + BATCH);
        // Run batch synchronously (each run is fast — ~5–50ms), then yield.
        for (let j = i; j < upper; j++) {
          all.push(runOne(strategy, baseSeed ^ (j * 0x9E3779B1)));
        }
        setProgress({ done: all.length, total: target });
        // Yield to UI
        await new Promise(r => setTimeout(r, 0));

        if (mode === 'adaptive' && all.length >= 100) {
          const currAvg = all.reduce((s, r) => s + r.wavesCleared, 0) / all.length;
          if (hasConverged(prevAvg, currAvg, 0.03)) {
            convergedBatches += 1;
            if (convergedBatches >= 3) break; // 3 consecutive stable batches
          } else {
            convergedBatches = 0;
          }
          prevAvg = currAvg;
        }
      }
      const agg = aggregate(strategy, all);
      setResult(agg);
      toast.success(`Simulation complete — ${all.length} runs`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Simulation failed');
    } finally {
      setRunning(false);
    }
  };

  const exportSummary = () => {
    if (!result) return;
    const txt = JSON.stringify(result, null, 2);
    navigator.clipboard?.writeText(txt).then(
      () => toast.success('Summary copied to clipboard'),
      () => toast.error('Copy failed'),
    );
  };

  const toggle = (id: string) => setOpenSection(s => s === id ? null : id);

  if (authorized === null) {
    return <div className="min-h-screen flex items-center justify-center"><div className="loading-spinner-ring" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 backdrop-blur border-b border-border/40 bg-background/80">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link to="/nexus/balance" className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted active:scale-95 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-emerald-400" />
              <h1 className="font-semibold truncate">Endless Simulator</h1>
            </div>
            <p className="text-xs text-muted-foreground truncate">Admin balance harness — no live data affected</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {workshopCtx.source === 'workshop' && workshopCtx.draftId && (
          <section className="rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-4 flex items-center gap-3">
            <Wrench className="w-4 h-4 text-cyan-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-cyan-100">Testing draft</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {workshopCtx.draftName} · {workshopCtx.kind}
                {workshopCtx.kind === 'endless' ? ' — apply to Live first to simulate against draft scaling.' : ''}
              </div>
            </div>
            <button
              onClick={() => navigate('/nexus/mission-workshop', { state: { returnedFromSim: true } })}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-100 text-xs flex items-center gap-1 active:scale-95"
            >
              ← Workshop
            </button>
          </section>
        )}
        {/* Controls */}
        <section className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Strategy profile</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {STRATEGIES.map(s => (
                <button
                  key={s}
                  disabled={running}
                  onClick={() => setStrategy(s)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm border transition active:scale-[0.98]',
                    strategy === s
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                      : 'border-border/60 bg-background/40 text-foreground/80',
                  )}
                >
                  {STRATEGY_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Sample size</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                disabled={running}
                onClick={() => setMode('fixed')}
                className={cn('px-3 py-2 rounded-lg text-sm border', mode === 'fixed' ? 'border-emerald-500/60 bg-emerald-500/15' : 'border-border/60 bg-background/40')}
              >
                Fixed
              </button>
              <button
                disabled={running}
                onClick={() => setMode('adaptive')}
                className={cn('px-3 py-2 rounded-lg text-sm border', mode === 'adaptive' ? 'border-emerald-500/60 bg-emerald-500/15' : 'border-border/60 bg-background/40')}
              >
                Adaptive
              </button>
            </div>
            {mode === 'fixed' ? (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {RUN_PRESETS.map(n => (
                  <button
                    key={n}
                    disabled={running}
                    onClick={() => setRunCount(n)}
                    className={cn(
                      'px-2 py-2 rounded-lg text-xs border',
                      runCount === n ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200' : 'border-border/60 bg-background/40',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2">
                <label className="text-[11px] text-muted-foreground">Max cap</label>
                <input
                  type="number"
                  min={100}
                  max={5000}
                  step={100}
                  value={maxAdaptive}
                  disabled={running}
                  onChange={e => setMaxAdaptive(Math.max(100, Math.min(5000, parseInt(e.target.value, 10) || 1000)))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-background/40 border border-border/60 text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Stops once avg-waves changes &lt;3% across 3 consecutive batches.</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Seed</label>
            <input
              type="text"
              value={seed}
              disabled={running}
              onChange={e => setSeed(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background/40 border border-border/60 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            {!running ? (
              <button
                onClick={start}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                <Play className="w-4 h-4" /> Run simulation
              </button>
            ) : (
              <button
                onClick={cancel}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Square className="w-4 h-4" /> Cancel
              </button>
            )}
          </div>

          {running && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Running…</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full bg-emerald-400 transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
        </section>

        {/* Results */}
        {result && (
          <>
            {/* Summary */}
            <Section
              id="summary"
              title="Diagnosis"
              open={openSection === 'summary'}
              onToggle={() => toggle('summary')}
            >
              <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', VERDICT_STYLES[result.verdict])}>
                {result.verdict === 'TooEasy' || result.verdict === 'Easy' ? <AlertTriangle className="w-3.5 h-3.5" /> : null}
                {result.verdict}
              </div>
              <p className="text-sm mt-2 text-foreground/85">
                {STRATEGY_LABELS[result.strategy]} · {result.runs} runs · seed {seed}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-foreground/80">
                {result.diagnostics.map((d, i) => <li key={i}>• {d}</li>)}
              </ul>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button onClick={exportSummary} className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border/60 text-xs flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Copy JSON
                </button>
                <button
                  onClick={() => navigate('/nexus/mission-workshop', {
                    state: {
                      source: 'simulator',
                      strategy: STRATEGY_LABELS[result.strategy],
                      verdict: result.verdict,
                      diagnostics: result.diagnostics,
                      recommendations: result.recommendations,
                      operationPacing: {
                        ...result.operationPacing,
                        avgKillsPerRun: result.avgKills,
                        avgScorePerRun: result.avgWaves > 0 ? Math.round(result.avgKills * 50) : 0,
                        avgBossDmgPerRun: result.avgBossDamage,
                      },
                      avgUnspentAtEnd: result.avgUnspentAtEnd,
                    },
                  })}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-100 text-xs font-semibold flex items-center gap-1.5 active:scale-95"
                >
                  <Wrench className="w-3.5 h-3.5" /> Tune in Workshop
                </button>
              </div>
            </Section>

            {/* Survival */}
            <Section id="survival" title="Survival curve" open={openSection === 'survival'} onToggle={() => toggle('survival')}>
              <Stat label="Avg waves" value={result.avgWaves.toFixed(2)} />
              <Stat label="Median waves" value={result.medianWaves.toFixed(0)} />
              <Stat label="Max waves" value={result.maxWaves.toFixed(0)} />
              <Stat label="Victory rate" value={`${(result.victoryRate * 100).toFixed(1)}%`} />
              <Stat label="Avg duration" value={`${(result.avgDurationSec / 60).toFixed(1)} min`} />
              <Stat label="Median duration" value={`${(result.medianDurationSec / 60).toFixed(1)} min`} />
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                {(['w5', 'w10', 'w15', 'w20'] as const).map(k => (
                  <div key={k} className="rounded-lg bg-background/40 border border-border/40 px-2 py-1.5 text-center">
                    <div className="text-[10px] text-muted-foreground">≥ {k.slice(1)}</div>
                    <div className="font-semibold">{(result.pctReached[k] * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Human realism — only meaningful when a profile/mix was used */}
            {(result.abandonRate > 0 || result.archetypeMix) && (
              <Section id="human" title="Human realism" open={openSection === 'human'} onToggle={() => toggle('human')}>
                <Stat label="Abandon rate" value={`${(result.abandonRate * 100).toFixed(1)}%`} />
                <p className="text-xs text-muted-foreground mt-1">
                  Share of runs that quit before defeat (boredom, rage-quit, distracted) — these still contribute partial Operation points based on what they accomplished.
                </p>
                {result.archetypeMix && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-1.5">Sampled archetype mix:</div>
                    <div className="space-y-1">
                      {Object.entries(result.archetypeMix).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                        <div key={k}>
                          <div className="flex justify-between text-xs">
                            <span className="capitalize">{k}</span>
                            <span className="text-muted-foreground">{(v * 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${v * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Economy */}
            <Section id="economy" title="Economy & combat" open={openSection === 'economy'} onToggle={() => toggle('economy')}>
              <Stat label="Avg kills" value={result.avgKills.toFixed(0)} />
              <Stat label="Avg leaks" value={result.avgLeaks.toFixed(1)} />
              <Stat label="Avg boss damage" value={result.avgBossDamage.toFixed(0)} />
              <Stat label="Avg energy starved" value={`${result.avgEnergyStarvedSec.toFixed(0)} s`} />
              <Stat label="Avg unspent at end" value={result.avgUnspentAtEnd.toFixed(0)} />
            </Section>

            {/* Towers */}
            <Section id="towers" title="Tower & ability balance" open={openSection === 'towers'} onToggle={() => toggle('towers')}>
              <div className="space-y-1.5">
                {(Object.keys(TOWERS) as Array<keyof typeof TOWERS>).map(k => (
                  <div key={k}>
                    <div className="flex justify-between text-xs">
                      <span className="capitalize">{k}</span>
                      <span className="text-muted-foreground">
                        Build {(result.towerBuildShare[k] * 100).toFixed(0)}% · Damage {(result.towerDamageShare[k] * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${result.towerDamageShare[k] * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Stat label="Orbital uses/run" value={result.abilityUsesAvg.orbital.toFixed(2)} />
                <Stat label="EMP uses/run" value={result.abilityUsesAvg.emp.toFixed(2)} />
              </div>
            </Section>

            {/* Operation pacing */}
            <Section id="op" title="Operation pacing" open={openSection === 'op'} onToggle={() => toggle('op')}>
              <Stat label="Avg contribution / run" value={result.avgContribution.toFixed(0)} />
              <Stat label="Median contribution" value={result.medianContribution.toFixed(0)} />
              <Stat label="Points / minute" value={result.contributionPerMinute.toFixed(1)} />
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span>Phase 1 ({result.operationPacing.phase1Target} kills)</span><span className="font-semibold">{Number.isFinite(result.operationPacing.runsToCompletePhase1) ? result.operationPacing.runsToCompletePhase1 : '∞'} runs</span></div>
                <div className="flex justify-between"><span>Phase 2 ({result.operationPacing.phase2Target.toLocaleString()} score)</span><span className="font-semibold">{Number.isFinite(result.operationPacing.runsToCompletePhase2) ? result.operationPacing.runsToCompletePhase2 : '∞'} runs</span></div>
                <div className="flex justify-between"><span>Phase 3 ({result.operationPacing.phase3Target.toLocaleString()} boss dmg)</span><span className="font-semibold">{Number.isFinite(result.operationPacing.runsToCompletePhase3) ? result.operationPacing.runsToCompletePhase3 : '∞'} runs</span></div>
                <div className="pt-2 mt-2 border-t border-border/40 flex justify-between"><span className="font-medium">Total runs</span><span className="font-semibold">{Number.isFinite(result.operationPacing.runsToCompleteOperation) ? result.operationPacing.runsToCompleteOperation : '∞'}</span></div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-muted-foreground mb-1.5">Runs per player by group size:</div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {Object.entries(result.operationPacing.perPlayerEstimate).map(([g, n]) => (
                    <div key={g} className="rounded-lg bg-background/40 border border-border/40 px-2 py-1.5 text-center">
                      <div className="text-[10px] text-muted-foreground">{g} players</div>
                      <div className="font-semibold">{Number.isFinite(n) ? n : '∞'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* Recommendations */}
            <Section id="reco" title={`Tuning recommendations (${result.recommendations.length})`} open={openSection === 'reco'} onToggle={() => toggle('reco')}>
              {result.recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tuning changes recommended at this time.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {result.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground mt-3">Recommendations are advisory — apply manually after review.</p>
            </Section>
          </>
        )}

        {!result && !running && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-6 text-center text-sm text-muted-foreground">
            Pick a strategy and sample size, then run a simulation. Nothing is written to live tables.
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 active:bg-muted/30">
        <span className="text-sm font-semibold">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
