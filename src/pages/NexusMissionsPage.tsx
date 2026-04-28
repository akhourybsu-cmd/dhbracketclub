import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Check, Skull } from 'lucide-react';
import { useResolvedMissions } from '@/hooks/useMissionCalibrations';
import { useNexusProgress } from '@/hooks/useNexusProgress';
import { cn } from '@/lib/utils';

export default function NexusMissionsPage() {
  const { progress } = useNexusProgress();
  const { missions: MISSIONS } = useResolvedMissions();
  return (
    <div className="max-w-md mx-auto pb-24 px-1">
      <div className="mb-4 mt-2">
        <Link to="/nexus" className="text-xs text-muted-foreground">← Hub</Link>
        <h1 className="text-2xl font-black mt-1">Outer Rim</h1>
        <p className="text-sm text-muted-foreground">Sector I · 6 missions</p>
      </div>

      <div className="space-y-2">
        {MISSIONS.map((m, idx) => {
          const unlocked = m.id <= progress.highest_mission;
          const cleared = m.id < progress.highest_mission;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Link
                to={unlocked ? `/nexus/loadout/${m.id}` : '#'}
                className={cn(
                  'block p-3 rounded-xl border bg-card transition',
                  unlocked ? 'border-cyan-500/30 hover:bg-secondary active:scale-[0.99]' : 'border-border opacity-50 pointer-events-none',
                  m.isBoss && unlocked && 'border-red-500/40 bg-red-950/20',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm',
                    cleared ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                    unlocked ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                    'bg-muted text-muted-foreground border border-border',
                  )}>
                    {cleared ? <Check className="w-4 h-4" /> : !unlocked ? <Lock className="w-4 h-4" /> : m.isBoss ? <Skull className="w-4 h-4" /> : m.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {m.waves.length} waves · {m.rewardCores} cores
                    </div>
                  </div>
                  {m.modifier && unlocked && (
                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 max-w-[90px] text-right">
                      {m.modifier.label}
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
