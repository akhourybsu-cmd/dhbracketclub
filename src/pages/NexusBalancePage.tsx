import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, AlertTriangle, TrendingUp, TrendingDown, Cpu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MISSIONS } from '@/lib/nexus/missions';
import { TOWERS } from '@/lib/nexus/towers';
import { ABILITIES } from '@/lib/nexus/abilities';
import { toast } from 'sonner';

type RunRow = {
  mission_id: number;
  victory: boolean;
  score: number;
  waves_cleared: number;
  base_hp_remaining: number;
  duration_seconds: number;
  failed_wave: number | null;
  tower_usage: Record<string, number>;
  tower_upgrades: Record<string, number>;
  tower_sells: Record<string, number>;
  ability_usage: Record<string, number>;
  energy_starved_ms: number;
  leaks: number;
  user_id: string;
  created_at: string;
};

const TOWER_KINDS: Array<keyof typeof TOWERS> = ['pulse', 'arc', 'cryo', 'rail'];
const ABILITY_KINDS: Array<keyof typeof ABILITIES> = ['orbital', 'emp'];

export default function NexusBalancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin guard
  useEffect(() => {
    if (!user) return;
    (supabase as any).from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }: any) => {
        if (data) setAuthorized(true);
        else { setAuthorized(false); toast.error('Admin only'); navigate('/nexus', { replace: true }); }
      });
  }, [user, navigate]);

  useEffect(() => {
    if (!authorized) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('nexus_runs')
        .select('mission_id,victory,score,waves_cleared,base_hp_remaining,duration_seconds,failed_wave,tower_usage,tower_upgrades,tower_sells,ability_usage,energy_starved_ms,leaks,user_id,created_at')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) { toast.error(error.message); return; }
      setRuns((data as RunRow[]) || []);
      setLoading(false);
    })();
  }, [authorized]);

  const overall = useMemo(() => {
    const byMission = new Map<number, RunRow[]>();
    runs.forEach(r => {
      const arr = byMission.get(r.mission_id) || [];
      arr.push(r);
      byMission.set(r.mission_id, arr);
    });

    const towerTotals: Record<string, { built: number; upgraded: number; sold: number }> = {};
    const abilityTotals: Record<string, number> = {};
    TOWER_KINDS.forEach(k => towerTotals[k] = { built: 0, upgraded: 0, sold: 0 });
    ABILITY_KINDS.forEach(k => abilityTotals[k] = 0);
    runs.forEach(r => {
      TOWER_KINDS.forEach(k => {
        towerTotals[k].built += r.tower_usage?.[k] || 0;
        towerTotals[k].upgraded += r.tower_upgrades?.[k] || 0;
        towerTotals[k].sold += r.tower_sells?.[k] || 0;
      });
      ABILITY_KINDS.forEach(k => abilityTotals[k] += r.ability_usage?.[k] || 0);
    });

    return { byMission, towerTotals, abilityTotals };
  }, [runs]);

  if (authorized === null || loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading balance data…</div>;
  }
  if (!authorized) return null;

  const totalRuns = runs.length;
  const uniquePlayers = new Set(runs.map(r => r.user_id)).size;
  const totalWins = runs.filter(r => r.victory).length;

  return (
    <div className="max-w-2xl mx-auto pb-24 px-3 pt-4">
      <Link to="/nexus" className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to Nexus
      </Link>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-cyan-300" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Admin · Nexus</div>
          <h1 className="text-xl font-black leading-tight">Balance Review</h1>
        </div>
      </div>

      {/* Overview chips */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Chip label="Total runs" value={totalRuns} />
        <Chip label="Players" value={uniquePlayers} />
        <Chip label="Win rate" value={totalRuns ? `${Math.round(100 * totalWins / totalRuns)}%` : '—'} />
      </div>

      {totalRuns === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No runs recorded yet. Telemetry will populate once players attempt missions.
        </div>
      )}

      {/* ───── Mission breakdown ───── */}
      {totalRuns > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Per Mission</h2>
          <div className="space-y-2">
            {MISSIONS.map(m => {
              const rs = overall.byMission.get(m.id) || [];
              const attempts = rs.length;
              const wins = rs.filter(r => r.victory).length;
              const losses = rs.filter(r => !r.victory);
              const winRate = attempts ? wins / attempts : 0;
              const players = new Set(rs.map(r => r.user_id)).size;
              const avgRetries = players ? attempts / players : 0;
              const avgScore = wins ? Math.round(rs.filter(r => r.victory).reduce((a, r) => a + r.score, 0) / wins) : 0;
              const avgHp = wins ? Math.round(rs.filter(r => r.victory).reduce((a, r) => a + r.base_hp_remaining, 0) / wins) : 0;
              const avgDur = attempts ? Math.round(rs.reduce((a, r) => a + r.duration_seconds, 0) / attempts) : 0;
              // Most common failure wave
              const waveCounts = new Map<number, number>();
              losses.forEach(r => {
                const w = r.failed_wave ?? r.waves_cleared + 1;
                waveCounts.set(w, (waveCounts.get(w) || 0) + 1);
              });
              const commonFailWave = [...waveCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
              // Tower mix for this mission
              const towerSum: Record<string, number> = {};
              TOWER_KINDS.forEach(k => towerSum[k] = 0);
              rs.forEach(r => TOWER_KINDS.forEach(k => towerSum[k] += r.tower_usage?.[k] || 0));
              const totalTowers = Object.values(towerSum).reduce((a, b) => a + b, 0);
              const dominantTower = totalTowers
                ? TOWER_KINDS.reduce((best, k) => towerSum[k] > towerSum[best] ? k : best, TOWER_KINDS[0])
                : null;
              const dominantPct = totalTowers && dominantTower ? Math.round(100 * towerSum[dominantTower] / totalTowers) : 0;
              const starvedAvg = attempts ? Math.round(rs.reduce((a, r) => a + r.energy_starved_ms, 0) / attempts / 1000) : 0;

              const insights: { icon: 'down' | 'up' | 'warn'; text: string }[] = [];
              if (attempts >= 3) {
                if (winRate < 0.25) insights.push({ icon: 'down', text: 'Likely too hard' });
                else if (winRate > 0.9) insights.push({ icon: 'up', text: 'Possibly too easy' });
                if (avgRetries >= 2.5) insights.push({ icon: 'warn', text: 'High retry count' });
                if (avgDur > 360) insights.push({ icon: 'warn', text: 'Run feels long' });
                if (dominantPct >= 70) insights.push({ icon: 'warn', text: `${TOWERS[dominantTower!].name} dominant (${dominantPct}%)` });
                if (starvedAvg >= 8) insights.push({ icon: 'warn', text: `Energy starved ~${starvedAvg}s` });
              }

              return (
                <div key={m.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Mission {m.id}</div>
                      <div className="text-sm font-bold">{m.name}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-base font-black tabular-nums ${winRate >= 0.5 ? 'text-emerald-400' : winRate >= 0.25 ? 'text-amber-300' : 'text-rose-400'}`}>
                        {attempts ? `${Math.round(100 * winRate)}%` : '—'}
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">{wins}W / {attempts - wins}L</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-[10px] mb-2">
                    <Mini label="Players" value={players} />
                    <Mini label="Retries" value={avgRetries ? avgRetries.toFixed(1) : '—'} />
                    <Mini label="Avg Score" value={avgScore ? avgScore.toLocaleString() : '—'} />
                    <Mini label="Avg HP" value={wins ? avgHp : '—'} />
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-[10px] mb-2">
                    <Mini label="Avg Time" value={avgDur ? `${Math.floor(avgDur / 60)}:${String(avgDur % 60).padStart(2, '0')}` : '—'} />
                    <Mini label="Fail Wave" value={commonFailWave ?? '—'} />
                    <Mini label="Top Tower" value={dominantTower ? `${TOWERS[dominantTower].name.split(' ')[0]} ${dominantPct}%` : '—'} />
                    <Mini label="Starved" value={starvedAvg ? `${starvedAvg}s` : '—'} />
                  </div>

                  {/* Tower distribution bar */}
                  {totalTowers > 0 && (
                    <div className="mt-2">
                      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted/40">
                        {TOWER_KINDS.map(k => {
                          const pct = (towerSum[k] / totalTowers) * 100;
                          if (pct < 0.5) return null;
                          return <div key={k} style={{ width: `${pct}%`, background: `hsl(var(--${towerColorVar(k)}))` }} />;
                        })}
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-1 tabular-nums">
                        {TOWER_KINDS.map(k => (
                          <span key={k}>{TOWERS[k].name.split(' ')[0]} {Math.round((towerSum[k] / totalTowers) * 100)}%</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {insights.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {insights.map((ins, i) => (
                        <span key={i} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border
                          ${ins.icon === 'down' ? 'bg-rose-500/15 border-rose-400/40 text-rose-200' :
                            ins.icon === 'up' ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200' :
                            'bg-amber-500/15 border-amber-400/40 text-amber-200'}`}>
                          {ins.icon === 'down' ? <TrendingDown className="w-3 h-3" /> :
                            ins.icon === 'up' ? <TrendingUp className="w-3 h-3" /> :
                            <AlertTriangle className="w-3 h-3" />}
                          {ins.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ───── Tower roster usage ───── */}
      {totalRuns > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Tower Usage (all runs)</h2>
          <div className="grid grid-cols-2 gap-2">
            {TOWER_KINDS.map(k => {
              const t = overall.towerTotals[k];
              const totalAll = TOWER_KINDS.reduce((a, kk) => a + overall.towerTotals[kk].built, 0);
              const share = totalAll ? Math.round(100 * t.built / totalAll) : 0;
              return (
                <div key={k} className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{TOWERS[k].name}</div>
                  <div className="text-lg font-black tabular-nums">{t.built}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {share}% of all builds · {t.upgraded}↑ · {t.sold} sells
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ───── Ability usage ───── */}
      {totalRuns > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Abilities</h2>
          <div className="grid grid-cols-2 gap-2">
            {ABILITY_KINDS.map(k => {
              const uses = overall.abilityTotals[k];
              const perRun = totalRuns ? (uses / totalRuns).toFixed(1) : '0';
              return (
                <div key={k} className="rounded-xl border border-border bg-card p-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-200 text-sm">
                    {ABILITIES[k].glyph}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{ABILITIES[k].name}</div>
                    <div className="text-base font-black tabular-nums">{uses}</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">{perRun} per run</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function towerColorVar(k: string): string {
  switch (k) {
    case 'pulse': return 'primary';
    case 'arc': return 'gold';
    case 'cryo': return 'accent';
    case 'rail': return 'destructive';
    default: return 'primary';
  }
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
      <div className="text-base font-black tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/30 px-1.5 py-1 text-center">
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[11px] font-bold tabular-nums">{value}</div>
    </div>
  );
}
