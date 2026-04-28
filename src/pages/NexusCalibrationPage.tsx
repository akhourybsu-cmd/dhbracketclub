import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sliders, RotateCcw, Save, AlertTriangle, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MISSIONS } from '@/lib/nexus/missions';
import { TOWERS } from '@/lib/nexus/towers';
import {
  CALIBRATION_BOUNDS,
  CalibrationField,
  DEFAULT_CALIBRATION,
  isOverridden,
  MissionCalibration,
  withDefaults,
  applyCalibration,
} from '@/lib/nexus/calibration';
import { resetCalibration, saveCalibration } from '@/hooks/useMissionCalibrations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type RunRow = {
  mission_id: number;
  victory: boolean;
  waves_cleared: number;
  base_hp_remaining: number;
  duration_seconds: number;
  failed_wave: number | null;
  tower_usage: Record<string, number>;
  energy_starved_ms: number;
  user_id: string;
};

const TOWER_KINDS: Array<keyof typeof TOWERS> = ['pulse', 'arc', 'cryo', 'rail'];

const FIELD_GROUPS: Array<{ title: string; fields: CalibrationField[] }> = [
  { title: 'Mission economy', fields: ['start_energy_delta', 'base_hp_delta', 'reward_cores_delta', 'wave_reward_mult'] },
  { title: 'Enemy scaling', fields: ['enemy_hp_mult', 'enemy_shield_mult', 'enemy_speed_mult'] },
  { title: 'Boss scaling', fields: ['boss_hp_mult', 'boss_shield_mult'] },
  { title: 'Spawn pacing', fields: ['spawn_count_mult', 'spawn_interval_mult', 'spawn_delay_mult'] },
];

const FIELD_LABELS: Record<CalibrationField, { label: string; hint: string; isMult: boolean }> = {
  start_energy_delta: { label: 'Start energy Δ', hint: 'Added to baseline starting energy', isMult: false },
  base_hp_delta: { label: 'Base HP Δ', hint: 'Added to nexus HP', isMult: false },
  reward_cores_delta: { label: 'Reward cores Δ', hint: 'Added to victory cores', isMult: false },
  wave_reward_mult: { label: 'Wave reward ×', hint: 'Scales energy granted between waves', isMult: true },
  enemy_hp_mult: { label: 'Enemy HP ×', hint: 'All non-boss enemy HP', isMult: true },
  enemy_shield_mult: { label: 'Enemy shield ×', hint: 'All non-boss shielded HP', isMult: true },
  enemy_speed_mult: { label: 'Enemy speed ×', hint: 'Movement speed (use carefully)', isMult: true },
  boss_hp_mult: { label: 'Boss HP ×', hint: 'Boss HP scaling', isMult: true },
  boss_shield_mult: { label: 'Boss shield ×', hint: 'Boss shield scaling', isMult: true },
  spawn_count_mult: { label: 'Spawn count ×', hint: 'Enemies per group (min 1)', isMult: true },
  spawn_interval_mult: { label: 'Spawn interval ×', hint: 'Time between spawns (>1 slower)', isMult: true },
  spawn_delay_mult: { label: 'Spawn delay ×', hint: 'Initial group delay scaling', isMult: true },
};

export default function NexusCalibrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [calibrations, setCalibrations] = useState<MissionCalibration[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [missionId, setMissionId] = useState<number>(1);
  const [draft, setDraft] = useState<MissionCalibration>(() => withDefaults(1));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
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

  // Load calibrations + telemetry
  useEffect(() => {
    if (!authorized) return;
    (async () => {
      const [{ data: calRows }, { data: runRows }] = await Promise.all([
        (supabase as any).from('nexus_mission_calibrations').select('*'),
        (supabase as any).from('nexus_runs').select('mission_id,victory,waves_cleared,base_hp_remaining,duration_seconds,failed_wave,tower_usage,energy_starved_ms,user_id').limit(2000),
      ]);
      setCalibrations((calRows as MissionCalibration[]) ?? []);
      setRuns((runRows as RunRow[]) ?? []);
      setLoading(false);
    })();
  }, [authorized]);

  // Sync draft when mission changes or calibrations load
  useEffect(() => {
    const existing = calibrations.find(c => c.mission_id === missionId);
    setDraft(existing ?? withDefaults(missionId));
  }, [missionId, calibrations]);

  const baseMission = useMemo(() => MISSIONS.find(m => m.id === missionId)!, [missionId]);
  const previewMission = useMemo(() => applyCalibration(baseMission, draft), [baseMission, draft]);

  const missionRuns = useMemo(() => runs.filter(r => r.mission_id === missionId), [runs, missionId]);
  const telemetry = useMemo(() => {
    const attempts = missionRuns.length;
    const wins = missionRuns.filter(r => r.victory).length;
    const winRate = attempts ? wins / attempts : 0;
    const players = new Set(missionRuns.map(r => r.user_id)).size;
    const avgRetries = players ? attempts / players : 0;
    const avgDur = attempts ? Math.round(missionRuns.reduce((a, r) => a + r.duration_seconds, 0) / attempts) : 0;
    const avgHp = wins ? Math.round(missionRuns.filter(r => r.victory).reduce((a, r) => a + r.base_hp_remaining, 0) / wins) : 0;
    const starvedAvg = attempts ? Math.round(missionRuns.reduce((a, r) => a + r.energy_starved_ms, 0) / attempts / 1000) : 0;
    const waveCounts = new Map<number, number>();
    missionRuns.filter(r => !r.victory).forEach(r => {
      const w = r.failed_wave ?? r.waves_cleared + 1;
      waveCounts.set(w, (waveCounts.get(w) || 0) + 1);
    });
    const failWave = [...waveCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const towerSum: Record<string, number> = {};
    TOWER_KINDS.forEach(k => towerSum[k] = 0);
    missionRuns.forEach(r => TOWER_KINDS.forEach(k => towerSum[k] += r.tower_usage?.[k] || 0));
    const totalTowers = Object.values(towerSum).reduce((a, b) => a + b, 0);
    const dominantTower = totalTowers
      ? TOWER_KINDS.reduce((best, k) => towerSum[k] > towerSum[best] ? k : best, TOWER_KINDS[0])
      : null;
    const dominantPct = totalTowers && dominantTower ? Math.round(100 * towerSum[dominantTower] / totalTowers) : 0;
    return { attempts, wins, winRate, players, avgRetries, avgDur, avgHp, starvedAvg, failWave, dominantTower, dominantPct };
  }, [missionRuns]);

  const overrideCount = useMemo(
    () => (Object.keys(CALIBRATION_BOUNDS) as CalibrationField[]).filter(f => isOverridden(draft, f)).length,
    [draft]
  );

  const dirty = useMemo(() => {
    const existing = calibrations.find(c => c.mission_id === missionId);
    const ref = existing ?? withDefaults(missionId);
    return (Object.keys(CALIBRATION_BOUNDS) as CalibrationField[]).some(f => Math.abs((draft[f] as number) - (ref[f] as number)) > 1e-6);
  }, [draft, calibrations, missionId]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const res = await saveCalibration(draft, user.id);
    setSaving(false);
    if (!res.ok) { toast.error(res.error || 'Save failed'); return; }
    toast.success(`Mission ${missionId} calibration saved`);
    // Refresh local list
    const { data } = await (supabase as any).from('nexus_mission_calibrations').select('*');
    setCalibrations((data as MissionCalibration[]) ?? []);
  };

  const handleReset = async () => {
    setResetting(true);
    const res = await resetCalibration(missionId);
    setResetting(false);
    if (!res.ok) { toast.error(res.error || 'Reset failed'); return; }
    toast.success(`Mission ${missionId} reset to defaults`);
    setCalibrations(prev => prev.filter(c => c.mission_id !== missionId));
    setDraft(withDefaults(missionId));
  };

  const updateField = (field: CalibrationField, raw: string) => {
    const n = parseFloat(raw);
    const b = CALIBRATION_BOUNDS[field];
    const def = DEFAULT_CALIBRATION[field as keyof typeof DEFAULT_CALIBRATION] as number;
    if (Number.isNaN(n)) {
      setDraft(d => ({ ...d, [field]: def }));
      return;
    }
    const clamped = Math.min(b.max, Math.max(b.min, n));
    setDraft(d => ({ ...d, [field]: clamped }));
  };

  if (authorized === null || loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading calibration…</div>;
  }
  if (!authorized) return null;

  const wavesNote = previewMission.waves.map((w, i) => {
    const baseWave = baseMission.waves[i];
    const totalCount = w.spawns.reduce((a, s) => a + s.count, 0);
    const baseCount = baseWave.spawns.reduce((a, s) => a + s.count, 0);
    return { i: i + 1, totalCount, baseCount, reward: w.rewardEnergy, baseReward: baseWave.rewardEnergy };
  });

  return (
    <div className="max-w-2xl mx-auto pb-32 px-3 pt-4">
      <Link to="/nexus/balance" className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to balance review
      </Link>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
          <Sliders className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Admin · Nexus</div>
          <h1 className="text-xl font-black leading-tight">Mission Calibration</h1>
        </div>
      </div>

      {/* Mission picker */}
      <div className="mb-4">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Mission</Label>
        <div className="relative mt-1">
          <select
            value={missionId}
            onChange={e => setMissionId(parseInt(e.target.value, 10))}
            className="w-full h-12 rounded-xl bg-card border border-border px-3 pr-10 text-base font-semibold appearance-none focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          >
            {MISSIONS.map(m => {
              const hasCal = calibrations.some(c => c.mission_id === m.id);
              return (
                <option key={m.id} value={m.id}>
                  Mission {m.id} — {m.name}{hasCal ? ' • tuned' : ''}
                </option>
              );
            })}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Telemetry summary */}
      <section className="rounded-xl border border-border bg-card p-3 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Telemetry context</h2>
          <span className="text-[10px] text-muted-foreground tabular-nums">{telemetry.attempts} attempt{telemetry.attempts === 1 ? '' : 's'}</span>
        </div>
        {telemetry.attempts === 0 ? (
          <p className="text-xs text-muted-foreground">No telemetry yet for this mission.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Win rate" value={`${Math.round(100 * telemetry.winRate)}%`} accent={telemetry.winRate >= 0.5 ? 'good' : telemetry.winRate >= 0.25 ? 'warn' : 'bad'} />
            <Stat label="Players" value={telemetry.players} />
            <Stat label="Avg retries" value={telemetry.avgRetries.toFixed(1)} />
            <Stat label="Avg dur" value={telemetry.avgDur ? `${Math.floor(telemetry.avgDur / 60)}:${String(telemetry.avgDur % 60).padStart(2, '0')}` : '—'} />
            <Stat label="Fail wave" value={telemetry.failWave ?? '—'} />
            <Stat label="Avg HP win" value={telemetry.wins ? telemetry.avgHp : '—'} />
            <Stat label="Starved" value={telemetry.starvedAvg ? `${telemetry.starvedAvg}s` : '—'} />
            <Stat label="Top tower" value={telemetry.dominantTower ? `${TOWERS[telemetry.dominantTower].name.split(' ')[0]} ${telemetry.dominantPct}%` : '—'} />
            <Stat label="Wins" value={`${telemetry.wins}/${telemetry.attempts}`} />
          </div>
        )}
      </section>

      {/* Override badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-muted-foreground">
          {overrideCount > 0
            ? <span className="text-amber-300 font-semibold">{overrideCount} override{overrideCount === 1 ? '' : 's'} active</span>
            : <span>All values default</span>}
        </div>
        {dirty && <span className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Unsaved</span>}
      </div>

      {/* Field groups */}
      {FIELD_GROUPS.map(group => (
        <section key={group.title} className="mb-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">{group.title}</h3>
          <div className="space-y-2">
            {group.fields.map(field => {
              const meta = FIELD_LABELS[field];
              const bounds = CALIBRATION_BOUNDS[field];
              const def = DEFAULT_CALIBRATION[field as keyof typeof DEFAULT_CALIBRATION] as number;
              const overridden = isOverridden(draft, field);
              return (
                <div
                  key={field}
                  className={`rounded-xl border p-3 ${overridden ? 'border-amber-400/50 bg-amber-500/5' : 'border-border bg-card'}`}
                >
                  <div className="flex items-baseline justify-between mb-1.5">
                    <Label className="text-sm font-semibold">{meta.label}</Label>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      default {meta.isMult ? `${def}×` : def}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={draft[field] as number}
                      step={bounds.step}
                      min={bounds.min}
                      max={bounds.max}
                      onChange={e => updateField(field, e.target.value)}
                      className="h-11 text-base font-bold tabular-nums"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-11 px-3 text-[11px]"
                      onClick={() => setDraft(d => ({ ...d, [field]: def }))}
                      disabled={!overridden}
                    >
                      Reset
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {meta.hint} · range {bounds.min}–{bounds.max}{meta.isMult ? '×' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Resolved preview */}
      <section className="mb-5 rounded-xl border border-border bg-card p-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Resolved live mission</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-2">
          <Compare label="Start energy" base={baseMission.startEnergy} now={previewMission.startEnergy} />
          <Compare label="Base HP" base={baseMission.baseHp} now={previewMission.baseHp} />
          <Compare label="Cores reward" base={baseMission.rewardCores} now={previewMission.rewardCores} />
        </div>
        <div className="space-y-1">
          {wavesNote.map(w => (
            <div key={w.i} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Wave {w.i}</span>
              <span className="tabular-nums">
                {w.totalCount} foes
                {w.totalCount !== w.baseCount && <span className="text-amber-300"> (was {w.baseCount})</span>}
                {' · '}
                +{w.reward} energy
                {w.reward !== w.baseReward && <span className="text-amber-300"> (was {w.baseReward})</span>}
              </span>
            </div>
          ))}
        </div>
        {(draft.enemy_hp_mult !== 1 || draft.enemy_shield_mult !== 1 || draft.enemy_speed_mult !== 1 || draft.boss_hp_mult !== 1 || draft.boss_shield_mult !== 1) && (
          <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-200">
            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>Enemy stat multipliers apply at spawn time and aren't reflected in the wave preview above.</span>
          </div>
        )}
      </section>

      {/* Notes */}
      <div className="mb-5">
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Notes (optional)</Label>
        <Input
          value={draft.notes ?? ''}
          onChange={e => setDraft(d => ({ ...d, notes: e.target.value.slice(0, 200) }))}
          placeholder="Reason for tuning…"
          className="mt-1 h-11"
          maxLength={200}
        />
      </div>

      {/* Save / reset action bar (sticky) */}
      <div className="fixed left-0 right-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-background via-background/95 to-transparent">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={resetting || !calibrations.some(c => c.mission_id === missionId)}
            className="h-12 flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset to defaults
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="h-12 flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving…' : 'Save calibration'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: 'good' | 'warn' | 'bad' }) {
  const color = accent === 'good' ? 'text-emerald-400' : accent === 'warn' ? 'text-amber-300' : accent === 'bad' ? 'text-rose-400' : '';
  return (
    <div className="rounded-md bg-muted/30 px-1.5 py-1.5">
      <div className={`text-sm font-black tabular-nums ${color}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Compare({ label, base, now }: { label: string; base: number; now: number }) {
  const changed = base !== now;
  return (
    <div className="rounded-md bg-muted/30 px-1.5 py-1.5">
      <div className={`text-sm font-black tabular-nums ${changed ? 'text-amber-300' : ''}`}>
        {now}{changed && <span className="text-[9px] text-muted-foreground font-normal"> /{base}</span>}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
