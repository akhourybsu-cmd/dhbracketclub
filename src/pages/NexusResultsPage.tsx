import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, X, Cpu, Zap, ShieldOff, Clock } from 'lucide-react';
import { useResolvedMissions } from '@/hooks/useMissionCalibrations';
import { TOWERS } from '@/lib/nexus/towers';
import { ABILITIES } from '@/lib/nexus/abilities';
import type { TowerKind, AbilityKind } from '@/lib/nexus/types';

interface RunInsight {
  towerBuilds: Record<TowerKind, number>;
  towerUpgrades: Record<TowerKind, number>;
  towerSells: Record<TowerKind, number>;
  abilityUses: Record<AbilityKind, number>;
  energyStarvedMs: number;
  leaks: number;
  durationSeconds: number;
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
  const totalUpgrades = insight ? towerKinds.reduce((a, k) => a + (insight.towerUpgrades[k] || 0), 0) : 0;
  const totalSells = insight ? towerKinds.reduce((a, k) => a + (insight.towerSells[k] || 0), 0) : 0;
  const totalAbilities = insight ? abilityKinds.reduce((a, k) => a + (insight.abilityUses[k] || 0), 0) : 0;

  const mins = insight ? Math.floor(insight.durationSeconds / 60) : 0;
  const secs = insight ? insight.durationSeconds % 60 : 0;
  const starvedSec = insight ? Math.round(insight.energyStarvedMs / 1000) : 0;

  return (
    <div className="max-w-md mx-auto pb-24 px-3 pt-6 text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
          won ? 'bg-emerald-500/20 border-2 border-emerald-400' : 'bg-rose-500/20 border-2 border-rose-400'
        }`}
      >
        {won ? <Trophy className="w-10 h-10 text-emerald-400" /> : <X className="w-10 h-10 text-rose-400" />}
      </motion.div>

      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mission {id}</div>
      <h1 className="text-2xl font-black mb-1">{mission?.name}</h1>
      <div className={`text-lg font-black mb-5 ${won ? 'text-emerald-400' : 'text-rose-400'}`}>
        {won ? 'NEXUS HELD' : 'NEXUS BREACHED'}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-left">
        <Stat label="Score" value={score.toLocaleString()} />
        <Stat label="Waves cleared" value={`${waves}/${mission?.waves.length ?? 0}`} />
        <Stat label="Base HP" value={hp} />
        <Stat label="Cores earned" value={cores} icon={<Cpu className="w-3 h-3 text-amber-400" />} />
      </div>

      {/* ───── Run Insight (compact, mobile-first) ───── */}
      {insight && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-2 mb-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest font-bold text-cyan-300">Run Insight</div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
              <Clock className="w-3 h-3" /> {mins}:{String(secs).padStart(2, '0')}
            </div>
          </div>

          {/* Tower mix */}
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {towerKinds.map(k => {
              const built = insight.towerBuilds[k] || 0;
              const upg = insight.towerUpgrades[k] || 0;
              return (
                <div key={k} className="rounded-md bg-card/60 border border-border/60 px-1.5 py-1 text-center">
                  <div className="text-[9px] text-muted-foreground uppercase">{TOWERS[k].name.split(' ')[0]}</div>
                  <div className="text-sm font-black tabular-nums">{built}</div>
                  {upg > 0 && <div className="text-[9px] text-emerald-400 tabular-nums">+{upg}↑</div>}
                </div>
              );
            })}
          </div>

          {/* Footer micro-stats */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground gap-2">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Abilities {totalAbilities}
            </span>
            {totalSells > 0 && (
              <span>Sells {totalSells}</span>
            )}
            {insight.leaks > 0 && (
              <span className="flex items-center gap-1 text-rose-300">
                <ShieldOff className="w-3 h-3" /> {insight.leaks} leak{insight.leaks > 1 ? 's' : ''}
              </span>
            )}
            {starvedSec >= 3 && (
              <span className="text-amber-300">Low energy {starvedSec}s</span>
            )}
          </div>

          {/* Soft hint when only 1 tower type was used */}
          {totalBuilt > 0 && towerKinds.filter(k => (insight.towerBuilds[k] || 0) > 0).length === 1 && (
            <div className="mt-2 text-[10px] text-cyan-300/80">
              Tip: try mixing tower types — variety usually scores higher.
            </div>
          )}
        </motion.div>
      )}

      <div className="flex flex-col gap-2 mt-6">
        <button
          onClick={() => navigate(`/nexus/battle/${id}`)}
          className="w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-bold active:scale-95"
        >
          Retry
        </button>
        {won && next && (
          <button
            onClick={() => navigate(`/nexus/loadout/${next.id}`)}
            className="w-full py-3 rounded-xl bg-emerald-500 text-emerald-950 font-black active:scale-95"
          >
            Next Mission · {next.name}
          </button>
        )}
        <Link to="/nexus" className="text-xs text-muted-foreground py-2">Back to Hub</Link>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-card border border-border">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-base font-black tabular-nums">{value}</div>
    </div>
  );
}
