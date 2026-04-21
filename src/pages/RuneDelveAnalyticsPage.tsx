import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, TrendingDown, Activity, Users, Target, Loader2, Copy, Download, Flame, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
interface RunRow {
  id: string;
  user_id: string;
  level_number: number;
  score: number;
  enemies_defeated: number;
  dungeon_cleared: boolean;
  turns_used: number;
  total_damage: number;
  longest_chain: number;
  hp_remaining: number;
  xp_earned: number;
  ability_used: boolean;
  hero_class: string | null;
  completed_at: string;
}

interface LevelRow {
  level_number: number;
  chapter: number;
  difficulty_tier: number;
  turn_limit: number;
  objective_type: string;
  objective_target: number;
  enemy_config: Array<{ hp: number; damage: number; name: string }>;
  modifiers: any;
}

interface LevelStats {
  level: number;
  chapter: number;
  tier: number;
  attempts: number;
  clears: number;
  clearRate: number; // 0..1
  uniquePlayers: number;
  avgTurnsUsed: number;
  avgHpRemaining: number;
  avgDamage: number;
  avgChain: number;
  abilityUsageRate: number;
  totalEnemyHp: number;
  totalEnemyDps: number;
  turnLimit: number;
  requiredDps: number;
  pressureScore: number; // requiredDps / turnLimit weighted
  // Diagnostic flags
  isCliff: boolean;
  isStall: boolean;
  isUnderTuned: boolean;
}

interface ClassStats {
  hero_class: string;
  attempts: number;
  clearRate: number;
  avgScore: number;
  avgTurnsUsed: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function pct(n: number) { return `${Math.round(n * 100)}%`; }
function num(n: number, digits = 1) { return Number.isFinite(n) ? n.toFixed(digits) : '—'; }

function colorForClearRate(rate: number, attempts: number): string {
  if (attempts === 0) return 'hsl(var(--muted-foreground) / 0.5)';
  if (rate >= 0.7) return 'hsl(142 76% 50%)'; // green
  if (rate >= 0.4) return 'hsl(48 96% 60%)';  // yellow
  if (rate >= 0.2) return 'hsl(28 96% 60%)';  // orange
  return 'hsl(0 84% 60%)';                    // red
}

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────
export default function RuneDelveAnalyticsPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

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

  // Fetch
  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([
      (supabase as any).from('rune_delve_runs').select('*').order('completed_at', { ascending: false }).limit(5000),
      (supabase as any).from('rune_delve_levels').select('*').order('level_number'),
    ]).then(([runRes, lvlRes]: any[]) => {
      setRuns(runRes.data ?? []);
      setLevels(lvlRes.data ?? []);
      setLoading(false);
    });
  }, [isAdmin, refreshKey]);

  // Per-level aggregation
  const levelStats: LevelStats[] = useMemo(() => {
    const byLevel = new Map<number, RunRow[]>();
    for (const r of runs) {
      if (!byLevel.has(r.level_number)) byLevel.set(r.level_number, []);
      byLevel.get(r.level_number)!.push(r);
    }
    const lvlByNum = new Map(levels.map(l => [l.level_number, l]));

    const stats: LevelStats[] = [];
    const allLvlNumbers = new Set<number>([
      ...byLevel.keys(),
      ...levels.map(l => l.level_number),
    ]);

    for (const n of Array.from(allLvlNumbers).sort((a, b) => a - b)) {
      const rs = byLevel.get(n) ?? [];
      const lvl = lvlByNum.get(n);
      const enemies = (lvl?.enemy_config ?? []) as Array<{ hp: number; damage: number }>;
      const totalHp = enemies.reduce((s, e) => s + (e.hp ?? 0), 0);
      const totalDps = enemies.reduce((s, e) => s + (e.damage ?? 0), 0);
      const tLimit = lvl?.turn_limit ?? 12;
      const requiredDps = totalHp / Math.max(tLimit, 1);

      const attempts = rs.length;
      const clears = rs.filter(r => r.dungeon_cleared).length;
      const clearRate = attempts ? clears / attempts : 0;
      const uniquePlayers = new Set(rs.map(r => r.user_id)).size;
      const avg = (sel: (r: RunRow) => number) => attempts ? rs.reduce((s, r) => s + sel(r), 0) / attempts : 0;

      const pressureScore = (requiredDps / Math.max(tLimit, 1)) * (totalDps / 5);

      stats.push({
        level: n,
        chapter: lvl?.chapter ?? Math.ceil(n / 50),
        tier: lvl?.difficulty_tier ?? 1,
        attempts,
        clears,
        clearRate,
        uniquePlayers,
        avgTurnsUsed: avg(r => r.turns_used),
        avgHpRemaining: avg(r => r.hp_remaining),
        avgDamage: avg(r => r.total_damage),
        avgChain: avg(r => r.longest_chain),
        abilityUsageRate: attempts ? rs.filter(r => r.ability_used).length / attempts : 0,
        totalEnemyHp: totalHp,
        totalEnemyDps: totalDps,
        turnLimit: tLimit,
        requiredDps,
        pressureScore,
        isCliff: false,    // filled in next pass
        isStall: attempts >= 2 && rs.every(r => r.turns_used >= tLimit - 1),
        isUnderTuned: attempts >= 3 && clearRate >= 0.95 && (avg(r => r.turns_used) <= tLimit * 0.5),
      });
    }

    // Cliff detection: clearRate drops by ≥ 40 pts vs prior level (with min 2 attempts on current)
    for (let i = 1; i < stats.length; i++) {
      const prev = stats[i - 1];
      const cur = stats[i];
      if (cur.attempts >= 2 && prev.attempts >= 1) {
        if (prev.clearRate - cur.clearRate >= 0.4) cur.isCliff = true;
        if (cur.clearRate === 0 && cur.attempts >= 2) cur.isCliff = true;
      }
    }
    return stats;
  }, [runs, levels]);

  // Class breakdown
  const classStats: ClassStats[] = useMemo(() => {
    const map = new Map<string, RunRow[]>();
    for (const r of runs) {
      const k = r.hero_class ?? 'unknown';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries()).map(([hero_class, rs]) => ({
      hero_class,
      attempts: rs.length,
      clearRate: rs.length ? rs.filter(r => r.dungeon_cleared).length / rs.length : 0,
      avgScore: rs.length ? rs.reduce((s, r) => s + r.score, 0) / rs.length : 0,
      avgTurnsUsed: rs.length ? rs.reduce((s, r) => s + r.turns_used, 0) / rs.length : 0,
    })).sort((a, b) => b.attempts - a.attempts);
  }, [runs]);

  // Topline
  const topline = useMemo(() => {
    const total = runs.length;
    const cleared = runs.filter(r => r.dungeon_cleared).length;
    const players = new Set(runs.map(r => r.user_id)).size;
    const cliffs = levelStats.filter(s => s.isCliff);
    const stalls = levelStats.filter(s => s.isStall);
    const deepest = Math.max(0, ...runs.map(r => r.level_number));
    const avgFurthest = (() => {
      const byUser = new Map<string, number>();
      for (const r of runs) {
        const cur = byUser.get(r.user_id) ?? 0;
        if (r.level_number > cur) byUser.set(r.user_id, r.level_number);
      }
      const vals = Array.from(byUser.values());
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    })();
    return {
      total, cleared, clearRate: total ? cleared / total : 0,
      players, cliffs: cliffs.length, stalls: stalls.length,
      deepest, avgFurthest,
    };
  }, [runs, levelStats]);

  // ────────── AI prompt export ──────────
  const aiPromptExport = useMemo(() => {
    const lines: string[] = [];
    lines.push('# Rune Delve — Telemetry Snapshot');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Players: ${topline.players}  Total runs: ${topline.total}  Overall clear rate: ${pct(topline.clearRate)}`);
    lines.push(`Deepest level reached: ${topline.deepest}  Avg furthest per player: ${num(topline.avgFurthest)}`);
    lines.push('');
    lines.push('## Per-level table');
    lines.push('| Lvl | Tier | Attempts | Clears | Clear% | Players | AvgTurns/Limit | AvgHP | AvgChain | Ability% | EnemyHP | EnemyDPS | ReqDPS | Flags |');
    lines.push('|----:|----:|--------:|------:|------:|-------:|------:|----:|---:|----:|----:|----:|----:|------|');
    for (const s of levelStats) {
      const flags = [s.isCliff ? 'CLIFF' : '', s.isStall ? 'STALL' : '', s.isUnderTuned ? 'TOO-EASY' : ''].filter(Boolean).join(',');
      lines.push(
        `| ${s.level} | ${s.tier} | ${s.attempts} | ${s.clears} | ${pct(s.clearRate)} | ${s.uniquePlayers} | ${num(s.avgTurnsUsed)}/${s.turnLimit} | ${num(s.avgHpRemaining, 0)} | ${num(s.avgChain)} | ${pct(s.abilityUsageRate)} | ${s.totalEnemyHp} | ${s.totalEnemyDps} | ${num(s.requiredDps)} | ${flags || '—'} |`
      );
    }
    lines.push('');
    lines.push('## Class performance');
    lines.push('| Class | Attempts | Clear% | AvgScore | AvgTurnsUsed |');
    lines.push('|------|--------:|-------:|--------:|-------:|');
    for (const c of classStats) {
      lines.push(`| ${c.hero_class} | ${c.attempts} | ${pct(c.clearRate)} | ${num(c.avgScore, 0)} | ${num(c.avgTurnsUsed)} |`);
    }
    lines.push('');
    lines.push('## Suggested questions to ask the AI');
    lines.push('- Which levels need rebalancing and what specific changes (HP/DPS/turn limit/enemy count)?');
    lines.push('- Are any classes under- or over-performing? Suggest tuning.');
    lines.push('- Are turn limits too tight on cliff levels? Propose targeted increases.');
    lines.push('- Do mechanics introduced at flagged levels need a softer onboarding?');
    return lines.join('\n');
  }, [levelStats, classStats, topline]);

  if (isAdmin === false) return <Navigate to="/" replace />;
  if (isAdmin === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cliffs = levelStats.filter(s => s.isCliff);
  const stalls = levelStats.filter(s => s.isStall);
  const underTuned = levelStats.filter(s => s.isUnderTuned);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to="/profile"
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted btn-press"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'hsl(var(--gold))' }}>
              Rune Delve · Admin
            </p>
            <h1 className="text-base font-extrabold leading-tight">Analytics Hub</h1>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey(k => k + 1)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg btn-press"
            style={{
              color: 'hsl(var(--primary))',
              background: 'hsl(var(--primary) / 0.1)',
              border: '1px solid hsl(var(--primary) / 0.3)',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* Topline cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ToplineCard icon={Users} label="Players" value={String(topline.players)} hint={`${topline.total} runs`} color="primary" />
          <ToplineCard icon={Target} label="Overall clear" value={pct(topline.clearRate)} hint={`${topline.cleared}/${topline.total}`} color="gold" />
          <ToplineCard icon={Activity} label="Avg furthest" value={`L${num(topline.avgFurthest, 1)}`} hint={`Deepest L${topline.deepest}`} color="accent" />
          <ToplineCard icon={AlertTriangle} label="Cliffs / Stalls" value={`${topline.cliffs} / ${topline.stalls}`} hint="needs tuning" color="warning" />
        </div>

        {/* Diagnostic callouts */}
        {(cliffs.length > 0 || stalls.length > 0 || underTuned.length > 0) && (
          <div className="grid md:grid-cols-3 gap-3">
            <DiagCallout
              icon={TrendingDown}
              title="Difficulty Cliffs"
              tone="destructive"
              items={cliffs.map(c => `L${c.level} · ${pct(c.clearRate)} (${c.attempts} att)`)}
              empty="No cliffs detected."
            />
            <DiagCallout
              icon={Flame}
              title="Stalls (max-turn pattern)"
              tone="warning"
              items={stalls.map(c => `L${c.level} · avg ${num(c.avgTurnsUsed)}/${c.turnLimit}`)}
              empty="No stalls detected."
            />
            <DiagCallout
              icon={Shield}
              title="Likely Under-Tuned"
              tone="muted"
              items={underTuned.map(c => `L${c.level} · ${pct(c.clearRate)} in ${num(c.avgTurnsUsed)} turns`)}
              empty="No under-tuned levels."
            />
          </div>
        )}

        {/* Per-level table */}
        <section
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border) / 0.6)',
          }}
        >
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Per-level breakdown</p>
              <p className="text-sm font-bold">All levels with telemetry</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Sorted by level</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/30">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground/80">
                  <th className="px-3 py-2">Lvl</th>
                  <th className="px-3 py-2">Att</th>
                  <th className="px-3 py-2">Clr%</th>
                  <th className="px-3 py-2">Players</th>
                  <th className="px-3 py-2">Turns/Lim</th>
                  <th className="px-3 py-2">HP left</th>
                  <th className="px-3 py-2">Chain</th>
                  <th className="px-3 py-2">Ability%</th>
                  <th className="px-3 py-2">EnemyHP</th>
                  <th className="px-3 py-2">EnemyDPS</th>
                  <th className="px-3 py-2">ReqDPS</th>
                  <th className="px-3 py-2">Flag</th>
                </tr>
              </thead>
              <tbody>
                {levelStats.map(s => (
                  <tr key={s.level} className="border-t border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2 font-bold">{s.level}</td>
                    <td className="px-3 py-2">{s.attempts}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: colorForClearRate(s.clearRate, s.attempts) }}>
                      {s.attempts ? pct(s.clearRate) : '—'}
                    </td>
                    <td className="px-3 py-2">{s.uniquePlayers}</td>
                    <td className="px-3 py-2">{s.attempts ? `${num(s.avgTurnsUsed)}/${s.turnLimit}` : `—/${s.turnLimit}`}</td>
                    <td className="px-3 py-2">{s.attempts ? num(s.avgHpRemaining, 0) : '—'}</td>
                    <td className="px-3 py-2">{s.attempts ? num(s.avgChain) : '—'}</td>
                    <td className="px-3 py-2">{s.attempts ? pct(s.abilityUsageRate) : '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.totalEnemyHp}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.totalEnemyDps}</td>
                    <td className="px-3 py-2 text-muted-foreground">{num(s.requiredDps)}</td>
                    <td className="px-3 py-2">
                      {s.isCliff && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mr-1" style={{ background: 'hsl(0 84% 60% / 0.15)', color: 'hsl(0 84% 70%)' }}>CLIFF</span>}
                      {s.isStall && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mr-1" style={{ background: 'hsl(28 96% 60% / 0.15)', color: 'hsl(28 96% 70%)' }}>STALL</span>}
                      {s.isUnderTuned && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsl(142 76% 50% / 0.15)', color: 'hsl(142 76% 60%)' }}>EASY</span>}
                    </td>
                  </tr>
                ))}
                {levelStats.length === 0 && (
                  <tr><td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">No data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Class breakdown */}
        <section
          className="rounded-2xl overflow-hidden"
          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.6)' }}
        >
          <div className="px-4 py-3 border-b border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Class performance</p>
            <p className="text-sm font-bold">Aggregated across all runs</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                <tr><th className="px-3 py-2 text-left">Class</th><th className="px-3 py-2 text-left">Attempts</th><th className="px-3 py-2 text-left">Clear%</th><th className="px-3 py-2 text-left">Avg Score</th><th className="px-3 py-2 text-left">Avg Turns</th></tr>
              </thead>
              <tbody>
                {classStats.map(c => (
                  <tr key={c.hero_class} className="border-t border-border/30">
                    <td className="px-3 py-2 font-semibold capitalize">{c.hero_class}</td>
                    <td className="px-3 py-2">{c.attempts}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: colorForClearRate(c.clearRate, c.attempts) }}>{pct(c.clearRate)}</td>
                    <td className="px-3 py-2">{num(c.avgScore, 0)}</td>
                    <td className="px-3 py-2">{num(c.avgTurnsUsed)}</td>
                  </tr>
                ))}
                {classStats.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No class data yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* AI prompt export */}
        <section
          className="rounded-2xl p-4 space-y-3"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.06), hsl(var(--gold) / 0.02))',
            border: '1px solid hsl(var(--gold) / 0.3)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(var(--gold))' }}>AI handoff</p>
              <p className="text-sm font-bold">Telemetry snapshot for prompts</p>
              <p className="text-[11px] text-muted-foreground mt-1">Copy and paste into a Lovable prompt to ask for tuning recommendations.</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(aiPromptExport); toast.success('Snapshot copied'); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 btn-press"
                style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.4)' }}
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([aiPromptExport], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `rune-delve-telemetry-${new Date().toISOString().slice(0,10)}.md`;
                  a.click(); URL.revokeObjectURL(url);
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 btn-press"
                style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}
              >
                <Download className="w-3.5 h-3.5" /> .md
              </button>
            </div>
          </div>
          <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-72 overflow-auto p-3 rounded-lg" style={{ background: 'hsl(var(--background) / 0.6)', border: '1px solid hsl(var(--border) / 0.5)' }}>
            {aiPromptExport}
          </pre>
        </section>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────────────────
function ToplineCard({ icon: Icon, label, value, hint, color }: { icon: any; label: string; value: string; hint: string; color: string }) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: `linear-gradient(135deg, hsl(var(--${color}) / 0.10), hsl(var(--${color}) / 0.02))`,
        border: `1px solid hsl(var(--${color}) / 0.25)`,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: `hsl(var(--${color}))` }} />
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">{label}</p>
      </div>
      <p className="text-xl font-extrabold leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

function DiagCallout({ icon: Icon, title, tone, items, empty }: { icon: any; title: string; tone: 'destructive' | 'warning' | 'muted'; items: string[]; empty: string }) {
  const colorVar = tone === 'destructive' ? '0 84% 60%' : tone === 'warning' ? '28 96% 60%' : '142 76% 50%';
  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: `hsl(${colorVar} / 0.06)`,
        border: `1px solid hsl(${colorVar} / 0.3)`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color: `hsl(${colorVar})` }} />
        <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: `hsl(${colorVar})` }}>{title}</p>
      </div>
      {items.length === 0
        ? <p className="text-[11px] text-muted-foreground">{empty}</p>
        : (
          <ul className="text-[11px] space-y-1">
            {items.slice(0, 6).map((s, i) => <li key={i} className="font-mono">• {s}</li>)}
            {items.length > 6 && <li className="text-muted-foreground">+ {items.length - 6} more…</li>}
          </ul>
        )
      }
    </div>
  );
}
