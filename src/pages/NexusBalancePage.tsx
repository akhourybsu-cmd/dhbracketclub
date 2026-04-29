import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, AlertTriangle, TrendingUp, TrendingDown, ShieldQuestion } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MISSIONS } from '@/lib/nexus/missions';
import { TOWERS } from '@/lib/nexus/towers';
import { ABILITIES } from '@/lib/nexus/abilities';
import { MODIFIERS, ModifierDef } from '@/lib/nexus/modifiers';
import { ModifierPill } from '@/components/nexus/ModifierPill';
import {
  computeModifierMetrics,
  computeStackMetrics,
  computeMissionModifierBreakdown,
  ModifierMetrics,
  StackMetrics,
  InsightFlag,
  TOWER_KINDS as MOD_TOWER_KINDS,
  RunRow as AnalyticsRunRow,
} from '@/lib/nexus/modifierAnalytics';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type RunRow = AnalyticsRunRow;

const TOWER_KINDS: Array<keyof typeof TOWERS> = ['pulse', 'arc', 'cryo', 'rail'];
const ABILITY_KINDS: Array<keyof typeof ABILITIES> = ['orbital', 'emp'];

type Tab = 'missions' | 'modifiers' | 'stacks';

export default function NexusBalancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('missions');
  const [modFilter, setModFilter] = useState<string>('all');
  const [missionFilter, setMissionFilter] = useState<number | 'all'>('all');
  const [hideLowSample, setHideLowSample] = useState(false);

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
        .select('mission_id,victory,score,waves_cleared,base_hp_remaining,duration_seconds,failed_wave,tower_usage,tower_upgrades,tower_sells,ability_usage,energy_starved_ms,leaks,user_id,created_at,loadout')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) { toast.error(error.message); return; }
      setRuns((data as RunRow[]) || []);
      setLoading(false);
    })();
  }, [authorized]);

  /* ───── Aggregations ───── */

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
        towerTotals[k].upgraded += (r as any).tower_upgrades?.[k] || 0;
        towerTotals[k].sold += (r as any).tower_sells?.[k] || 0;
      });
      ABILITY_KINDS.forEach(k => abilityTotals[k] += r.ability_usage?.[k] || 0);
    });

    return { byMission, towerTotals, abilityTotals };
  }, [runs]);

  const modMetrics = useMemo(() => computeModifierMetrics(runs), [runs]);
  const stackMetrics = useMemo(() => computeStackMetrics(runs, 1), [runs]);
  const missionBreakdown = useMemo(() => computeMissionModifierBreakdown(runs), [runs]);

  const filteredMods = useMemo(() => {
    let xs = modMetrics;
    if (modFilter !== 'all') xs = xs.filter(m => m.id === modFilter);
    if (missionFilter !== 'all') {
      // restrict modifiers to those that appear on the chosen mission
      const ids = new Set(MISSIONS.find(m => m.id === missionFilter)?.modifierIds || []);
      xs = xs.filter(m => ids.has(m.id));
    }
    if (hideLowSample) xs = xs.filter(m => m.attempts >= 6);
    return xs;
  }, [modMetrics, modFilter, missionFilter, hideLowSample]);

  const filteredStacks = useMemo(() => {
    let xs = stackMetrics;
    if (modFilter !== 'all') xs = xs.filter(s => s.ids.includes(modFilter));
    if (missionFilter !== 'all') {
      xs = xs.filter(s => s.missionIds.includes(missionFilter));
    }
    if (hideLowSample) xs = xs.filter(s => s.attempts >= 6);
    return xs;
  }, [stackMetrics, modFilter, missionFilter, hideLowSample]);

  if (authorized === null || loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading balance data…</div>;
  }
  if (!authorized) return null;

  const totalRuns = runs.length;
  const uniquePlayers = new Set(runs.map(r => r.user_id)).size;
  const totalWins = runs.filter(r => r.victory).length;
  const runsWithMods = runs.filter(r => Array.isArray(r.loadout?.modifierIds) && r.loadout.modifierIds.length).length;

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

      <Link
        to="/nexus/calibration"
        className="flex items-center justify-between rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5 mb-4 active:bg-amber-500/20"
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Tune missions</div>
          <div className="text-sm font-bold">Open mission calibration →</div>
        </div>
        <span className="text-amber-300 text-lg">⚙</span>
      </Link>

      {/* Overview chips */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <Chip label="Runs" value={totalRuns} />
        <Chip label="Players" value={uniquePlayers} />
        <Chip label="Win rate" value={totalRuns ? `${Math.round(100 * totalWins / totalRuns)}%` : '—'} />
        <Chip label="w/ Mods" value={runsWithMods} />
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 mb-3 rounded-xl border border-border bg-card/60">
        {(['missions', 'modifiers', 'stacks'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 text-[11px] font-bold uppercase tracking-widest py-1.5 rounded-lg transition-colors',
              tab === t ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40' : 'text-muted-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filters (modifiers + stacks tabs) */}
      {tab !== 'missions' && (
        <div className="mb-4 space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            <FilterPill
              active={modFilter === 'all'}
              onClick={() => setModFilter('all')}
              label="All modifiers"
            />
            {Object.values(MODIFIERS).map(m => (
              <FilterPill
                key={m.id}
                active={modFilter === m.id}
                onClick={() => setModFilter(m.id)}
                label={`${m.glyph} ${m.label}`}
              />
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            <FilterPill
              active={missionFilter === 'all'}
              onClick={() => setMissionFilter('all')}
              label="All missions"
            />
            {MISSIONS.map(m => (
              <FilterPill
                key={m.id}
                active={missionFilter === m.id}
                onClick={() => setMissionFilter(m.id)}
                label={`M${m.id}`}
              />
            ))}
          </div>
          <button
            onClick={() => setHideLowSample(s => !s)}
            className={cn(
              'text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border',
              hideLowSample
                ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                : 'bg-muted/30 border-border text-muted-foreground'
            )}
          >
            {hideLowSample ? '✓ ' : ''}Hide low-sample (&lt;6)
          </button>
        </div>
      )}

      {totalRuns === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No runs recorded yet. Telemetry will populate once players attempt missions.
        </div>
      )}

      {/* ───── MISSIONS TAB ───── */}
      {tab === 'missions' && totalRuns > 0 && (
        <>
          <MissionList overall={overall} />
          <MissionModifierCrossRead breakdown={missionBreakdown} />
          <TowerRosterSection towerTotals={overall.towerTotals} />
          <AbilitySection abilityTotals={overall.abilityTotals} totalRuns={totalRuns} />
        </>
      )}

      {/* ───── MODIFIERS TAB ───── */}
      {tab === 'modifiers' && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Per Modifier</h2>
          {filteredMods.length === 0 && (
            <EmptyHint text="No modifiers match these filters." />
          )}
          {filteredMods.map(m => <ModifierCard key={m.id} m={m} />)}
        </section>
      )}

      {/* ───── STACKS TAB ───── */}
      {tab === 'stacks' && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Modifier Stacks</h2>
          {filteredStacks.length === 0 && (
            <EmptyHint text="No stacks observed for these filters yet." />
          )}
          {filteredStacks.map(s => <StackCard key={s.key} s={s} />)}
        </section>
      )}
    </div>
  );
}

/* ───────── Mission list (existing view, preserved) ───────── */

function MissionList({ overall }: { overall: { byMission: Map<number, RunRow[]> } }) {
  return (
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
          const waveCounts = new Map<number, number>();
          losses.forEach(r => {
            const w = r.failed_wave ?? r.waves_cleared + 1;
            waveCounts.set(w, (waveCounts.get(w) || 0) + 1);
          });
          const commonFailWave = [...waveCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
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
  );
}

/* ───────── Mission × Modifier cross-read ───────── */

function MissionModifierCrossRead({
  breakdown,
}: {
  breakdown: ReturnType<typeof computeMissionModifierBreakdown>;
}) {
  if (!breakdown.length) return null;
  return (
    <section className="mb-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        Mission × Modifier
      </h2>
      <div className="space-y-2">
        {breakdown.map(b => {
          const mission = MISSIONS.find(m => m.id === b.missionId);
          if (!mission) return null;
          return (
            <div key={b.missionId} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-sm font-bold">M{mission.id} · {mission.name}</div>
                {b.stackMetrics && (
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {b.stackMetrics.attempts} runs · {Math.round(b.stackMetrics.winRate * 100)}% win
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {b.perModifier.map(pm => pm.def && (
                  <ModifierPill key={pm.id} mod={pm.def} size="xs" compact />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {b.perModifier.map(pm => pm.def && (
                  <div key={pm.id} className="rounded-md bg-muted/30 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">
                      {pm.def.label}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div className="text-[11px] font-black tabular-nums">
                        {pm.attempts ? `${Math.round(pm.winRate * 100)}%` : '—'}
                      </div>
                      <div className="text-[9px] text-muted-foreground tabular-nums">
                        {pm.attempts}r
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Lightweight hint: which modifier in this stack drives difficulty */}
              {b.perModifier.length > 1 && b.perModifier.every(pm => pm.attempts >= 6) && (() => {
                const sorted = [...b.perModifier].sort((a, b) => a.winRate - b.winRate);
                const hardest = sorted[0];
                if (!hardest?.def) return null;
                return (
                  <div className="mt-2 text-[10px] text-amber-300/90">
                    Hardest contributor: <span className="font-bold">{hardest.def.label}</span> ({Math.round(hardest.winRate * 100)}% win rate across all missions)
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────── Modifier card ───────── */

function ModifierCard({ m }: { m: ModifierMetrics }) {
  const def = m.def;
  if (!def) return null;
  const winColor = m.attempts < 6
    ? 'text-muted-foreground'
    : m.winRate >= 0.55 ? 'text-emerald-400'
    : m.winRate >= 0.3 ? 'text-amber-300'
    : 'text-rose-400';

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <ModifierPill mod={def} size="xs" />
          <div className="text-[10px] text-muted-foreground mt-1">{def.short}</div>
        </div>
        <div className="text-right shrink-0">
          <div className={cn('text-base font-black tabular-nums', winColor)}>
            {m.attempts ? `${Math.round(m.winRate * 100)}%` : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {m.wins}W / {m.losses}L · {m.attempts}r
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-2">
        <Mini label="Players" value={m.players || '—'} />
        <Mini label="Retries" value={m.attempts ? m.avgRetries.toFixed(1) : '—'} />
        <Mini label="Avg Leaks" value={m.attempts ? m.avgLeaks.toFixed(1) : '—'} />
        <Mini label="HP on win" value={m.wins ? Math.round(m.avgBaseHpOnWin) : '—'} />
      </div>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        <Mini label="Avg Time" value={m.attempts ? fmtDur(m.avgDurationSec) : '—'} />
        <Mini label="Starved" value={m.attempts ? `${Math.round(m.avgEnergyStarvedSec)}s` : '—'} />
        <Mini
          label="Top Tower"
          value={m.dominantTower ? `${TOWERS[m.dominantTower].name.split(' ')[0]} ${m.dominantTowerPct}%` : '—'}
        />
        <Mini
          label="Top Mission"
          value={m.topMissionId ? `M${m.topMissionId} ${m.topMissionPct}%` : '—'}
        />
      </div>

      {/* Tower share bar */}
      {m.attempts > 0 && (() => {
        const total = MOD_TOWER_KINDS.reduce((a, k) => a + m.towerShare[k], 0);
        if (!total) return null;
        return (
          <div className="mt-1">
            <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted/40">
              {MOD_TOWER_KINDS.map(k => {
                const pct = (m.towerShare[k] / total) * 100;
                if (pct < 0.5) return null;
                return <div key={k} style={{ width: `${pct}%`, background: `hsl(var(--${towerColorVar(k)}))` }} />;
              })}
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1 tabular-nums">
              {MOD_TOWER_KINDS.map(k => (
                <span key={k}>{TOWERS[k].name.split(' ')[0]} {Math.round((m.towerShare[k] / total) * 100)}%</span>
              ))}
            </div>
          </div>
        );
      })()}

      <FlagsRow flags={m.flags} />
    </div>
  );
}

/* ───────── Stack card ───────── */

function StackCard({ s }: { s: StackMetrics }) {
  const winColor = s.attempts < 6
    ? 'text-muted-foreground'
    : s.winRate >= 0.55 ? 'text-emerald-400'
    : s.winRate >= 0.3 ? 'text-amber-300'
    : 'text-rose-400';
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap gap-1 min-w-0">
          {s.defs.map((d: ModifierDef) => <ModifierPill key={d.id} mod={d} size="xs" compact />)}
        </div>
        <div className="text-right shrink-0">
          <div className={cn('text-base font-black tabular-nums', winColor)}>
            {Math.round(s.winRate * 100)}%
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {s.wins}W / {s.losses}L · {s.attempts}r
          </div>
        </div>
      </div>
      {s.missionIds.length > 0 && (
        <div className="text-[10px] text-cyan-300/90 mb-1.5">
          Mission stack: {s.missionIds.map(id => `M${id}`).join(', ')}
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        <Mini label="Players" value={s.players || '—'} />
        <Mini label="Retries" value={s.avgRetries.toFixed(1)} />
        <Mini label="Avg Leaks" value={s.avgLeaks.toFixed(1)} />
        <Mini label="Starved" value={`${Math.round(s.avgEnergyStarvedSec)}s`} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Mini label="Avg Time" value={fmtDur(s.avgDurationSec)} />
        <Mini label="Fail Wave" value={s.commonFailWave ?? '—'} />
        <Mini
          label="Top Tower"
          value={s.dominantTower ? `${TOWERS[s.dominantTower].name.split(' ')[0]} ${s.dominantTowerPct}%` : '—'}
        />
      </div>
      <FlagsRow flags={s.flags} />
    </div>
  );
}

/* ───────── Tower / ability sections (preserved from prior page) ───────── */

function TowerRosterSection({ towerTotals }: { towerTotals: Record<string, { built: number; upgraded: number; sold: number }> }) {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Tower Usage (all runs)</h2>
      <div className="grid grid-cols-2 gap-2">
        {TOWER_KINDS.map(k => {
          const t = towerTotals[k];
          const totalAll = TOWER_KINDS.reduce((a, kk) => a + towerTotals[kk].built, 0);
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
  );
}

function AbilitySection({ abilityTotals, totalRuns }: { abilityTotals: Record<string, number>; totalRuns: number }) {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Abilities</h2>
      <div className="grid grid-cols-2 gap-2">
        {ABILITY_KINDS.map(k => {
          const uses = abilityTotals[k];
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
  );
}

/* ───────── Shared atoms ───────── */

function FlagsRow({ flags }: { flags: InsightFlag[] }) {
  if (!flags.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {flags.map(f => {
        const cls =
          f.severity === 'bad' ? 'bg-rose-500/15 border-rose-400/40 text-rose-200' :
          f.severity === 'warn' ? 'bg-amber-500/15 border-amber-400/40 text-amber-200' :
          f.severity === 'good' ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200' :
          'bg-muted/40 border-border text-muted-foreground';
        const Icon = f.severity === 'bad' ? TrendingDown
          : f.severity === 'good' ? TrendingUp
          : f.severity === 'info' ? ShieldQuestion
          : AlertTriangle;
        return (
          <span key={f.id} className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border', cls)}>
            <Icon className="w-3 h-3" />
            {f.label}
          </span>
        );
      })}
    </div>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border whitespace-nowrap',
        active
          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
          : 'bg-muted/30 border-border text-muted-foreground'
      )}
    >
      {label}
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function fmtDur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
