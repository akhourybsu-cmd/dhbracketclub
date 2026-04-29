import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, X, Cpu, Zap, ShieldOff, Clock, ChevronRight, Users } from 'lucide-react';
import { useResolvedMissions } from '@/hooks/useMissionCalibrations';
import { TOWERS } from '@/lib/nexus/towers';
import type { TowerKind, AbilityKind } from '@/lib/nexus/types';

interface RunInsight {
  towerBuilds: Record<TowerKind, number>;
  towerUpgrades: Record<TowerKind, number>;
  towerSells: Record<TowerKind, number>;
  abilityUses: Record<AbilityKind, number>;
  energyStarvedMs: number;
  leaks: number;
  durationSeconds: number;
  kills?: number;
  bossDamage?: number;
  endless?: boolean;
  operation?: {
    operationId: string;
    pointsAwarded: number;
    phase: number;
    status: string;
    duplicate: boolean;
  } | null;
}

export default function NexusResultsPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = parseInt(missionId || '1', 10);
  const { missions } = useResolvedMissions();
  const mission = missions.find(m => m.id === id);
  const won = params.get('win') === '1';
  const score = parseInt(params.get('score') || '0', 10);
  const hp = parseInt(params.get('hp') || '0', 10);
  const waves = parseInt(params.get('waves') || '0', 10);
  const cores = parseInt(params.get('cores') || '0', 10);
  const next = missions.find(m => m.id === id + 1);

  const insight = useMemo<RunInsight | null>(() => {
    try {
      const raw = sessionStorage.getItem(`nexus_run_${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [id]);

  const towerKinds: TowerKind[] = ['pulse', 'arc', 'cryo', 'rail'];
  const abilityKinds: AbilityKind[] = ['orbital', 'emp'];
  const totalBuilt = insight ? towerKinds.reduce((a, k) => a + (insight.towerBuilds[k] || 0), 0) : 0;
  const totalSells = insight ? towerKinds.reduce((a, k) => a + (insight.towerSells[k] || 0), 0) : 0;
  const totalAbilities = insight ? abilityKinds.reduce((a, k) => a + (insight.abilityUses[k] || 0), 0) : 0;

  const mins = insight ? Math.floor(insight.durationSeconds / 60) : 0;
  const secs = insight ? insight.durationSeconds % 60 : 0;
  const starvedSec = insight ? Math.round(insight.energyStarvedMs / 1000) : 0;

  const accent = won ? 'cyan' : 'rose';
  const ringHex = won ? 'hsl(188 92% 56%)' : 'hsl(350 90% 60%)';

  return (
    <div className="max-w-md mx-auto pb-6 px-3 pt-4">
      {/* Verdict seal */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 16 }}
        className="relative mx-auto w-28 h-28 mb-3"
      >
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, ${ringHex}, transparent 60%, ${ringHex})`,
            opacity: 0.45,
            filter: 'blur(1px)',
          }}
        />
        <div className="absolute inset-1 rounded-full bg-[hsl(218_45%_5%)] border border-white/10" />
        <div
          className={`absolute inset-3 rounded-full flex items-center justify-center border-2 ${
            won ? 'bg-cyan-500/15 border-cyan-400' : 'bg-rose-500/15 border-rose-400'
          }`}
        >
          {won ? <Trophy className="w-9 h-9 text-cyan-300" /> : <X className="w-9 h-9 text-rose-300" />}
        </div>
        {/* Tick marks */}
        {[0, 90, 180, 270].map(deg => (
          <div
            key={deg}
            className="absolute left-1/2 top-1/2 w-px h-2"
            style={{
              background: ringHex,
              transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-58px)`,
              opacity: 0.7,
            }}
          />
        ))}
      </motion.div>

      <div className="text-center mb-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300/70">
          Mission {id} · After-Action
        </div>
        <h1 className="text-2xl font-black mt-1 tracking-tight">{mission?.name}</h1>
        <div
          className={`inline-block mt-2 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] nx-clip ${
            won
              ? 'bg-cyan-500/15 border border-cyan-400/60 text-cyan-200'
              : 'bg-rose-500/15 border border-rose-400/60 text-rose-200'
          }`}
        >
          {won ? '◆ Nexus Held' : '◆ Nexus Breached'}
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat label="Score" value={score.toLocaleString()} accent={accent} />
        <Stat label="Waves" value={`${waves}/${mission?.waves.length ?? 0}`} accent={accent} />
        <Stat label="Base HP" value={hp} accent={accent} />
        <Stat label="Cores" value={cores} icon={<Cpu className="w-3 h-3 text-amber-400" />} accent="amber" />
      </div>

      {/* Run Insight */}
      {insight && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative nx-panel nx-clip p-3 mb-4"
        >
          <span className="nx-bracket nx-bracket-tl" />
          <span className="nx-bracket nx-bracket-br" />
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-cyan-300">
              ▌ Combat Telemetry
            </div>
            <div className="flex items-center gap-1 text-[10px] text-cyan-200/70 tabular-nums">
              <Clock className="w-3 h-3" /> {mins}:{String(secs).padStart(2, '0')}
            </div>
          </div>

          {/* Tower mix */}
          <div className="grid grid-cols-4 gap-1.5 mb-2.5">
            {towerKinds.map(k => {
              const built = insight.towerBuilds[k] || 0;
              const upg = insight.towerUpgrades[k] || 0;
              const active = built > 0;
              return (
                <div
                  key={k}
                  className={`relative rounded-md px-1 py-1.5 text-center border ${
                    active
                      ? 'bg-cyan-500/10 border-cyan-400/40'
                      : 'bg-white/[0.02] border-white/5'
                  }`}
                >
                  <div className={`text-[8px] uppercase tracking-wider ${active ? 'text-cyan-300' : 'text-muted-foreground'}`}>
                    {TOWERS[k].name.split(' ')[0]}
                  </div>
                  <div className={`text-base font-black tabular-nums ${active ? 'text-white' : 'text-muted-foreground'}`}>
                    {built}
                  </div>
                  {upg > 0 && (
                    <div className="text-[8px] text-amber-300 tabular-nums font-bold">+{upg}↑</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer micro-stats */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-cyan-100/70">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              ABILITIES <span className="text-white tabular-nums font-bold">{totalAbilities}</span>
            </span>
            {totalSells > 0 && (
              <span>SELLS <span className="text-white tabular-nums font-bold">{totalSells}</span></span>
            )}
            {insight.leaks > 0 && (
              <span className="flex items-center gap-1 text-rose-300">
                <ShieldOff className="w-3 h-3" /> {insight.leaks} LEAK{insight.leaks > 1 ? 'S' : ''}
              </span>
            )}
            {starvedSec >= 3 && (
              <span className="text-amber-300">⚠ LOW PWR {starvedSec}s</span>
            )}
          </div>

          {/* Tip */}
          {totalBuilt > 0 && towerKinds.filter(k => (insight.towerBuilds[k] || 0) > 0).length === 1 && (
            <div className="mt-2.5 pt-2 border-t border-cyan-500/15 text-[10px] text-cyan-300/80">
              ◆ TACTICAL: mix tower types — combined arms scores higher.
            </div>
          )}
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {won && next && (
          <button
            onClick={() => navigate(`/nexus/loadout/${next.id}`)}
            className="relative w-full py-3.5 nx-clip bg-gradient-to-r from-cyan-500 to-indigo-500 text-[hsl(218_45%_5%)] font-black uppercase tracking-wider text-sm active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Deploy Mission {next.id} <ChevronRight className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => navigate(`/nexus/battle/${id}`)}
          className="w-full py-3 nx-clip bg-cyan-500/10 border border-cyan-400/50 text-cyan-200 font-bold uppercase tracking-wider text-xs active:scale-[0.98]"
        >
          ↻ Retry Mission
        </button>
        <Link to="/nexus" className="text-[11px] text-muted-foreground py-2 text-center uppercase tracking-widest hover:text-cyan-300 transition-colors">
          ← Return to Hub
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label, value, icon, accent,
}: { label: string; value: string | number; icon?: React.ReactNode; accent: 'cyan' | 'rose' | 'amber' }) {
  const tint = {
    cyan: 'border-cyan-400/30 bg-cyan-500/5',
    rose: 'border-rose-400/30 bg-rose-500/5',
    amber: 'border-amber-400/30 bg-amber-500/5',
  }[accent];
  return (
    <div className={`relative p-2.5 nx-clip border ${tint}`}>
      <div className="text-[9px] uppercase tracking-[0.18em] text-cyan-200/60 flex items-center gap-1 mb-0.5">
        {icon}{label}
      </div>
      <div className="text-lg font-black tabular-nums text-white">{value}</div>
    </div>
  );
}
