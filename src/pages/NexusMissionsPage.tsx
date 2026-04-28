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
    <div className="max-w-md mx-auto pb-6 px-1">
      <div className="mb-4 mt-1">
        <h1 className="text-2xl font-black">Outer Rim</h1>
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
                  'block p-3 nx-clip-sm transition active:scale-[0.99]',
                  !unlocked && 'opacity-45 pointer-events-none',
                )}
                style={{
                  background: m.isBoss && unlocked
                    ? 'linear-gradient(180deg, hsl(350 60% 14%), hsl(350 70% 8%))'
                    : 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
                  border: m.isBoss && unlocked
                    ? '1px solid hsl(350 85% 62% / 0.55)'
                    : unlocked
                      ? '1px solid hsl(var(--nx-cyan) / 0.3)'
                      : '1px solid hsl(0 0% 100% / 0.06)',
                  boxShadow: unlocked ? 'inset 0 1px 0 hsl(0 0% 100% / 0.05)' : undefined,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 nx-clip-sm flex items-center justify-center font-black text-sm shrink-0"
                    style={{
                      background: cleared
                        ? 'hsl(150 80% 60% / 0.18)'
                        : unlocked
                          ? (m.isBoss ? 'hsl(350 85% 62% / 0.18)' : 'hsl(var(--nx-cyan) / 0.18)')
                          : 'hsl(0 0% 100% / 0.05)',
                      border: cleared
                        ? '1.5px solid hsl(150 80% 60%)'
                        : unlocked
                          ? (m.isBoss ? '1.5px solid hsl(350 85% 62%)' : '1.5px solid hsl(var(--nx-cyan))')
                          : '1px solid hsl(0 0% 100% / 0.1)',
                      color: cleared
                        ? 'hsl(150 80% 75%)'
                        : unlocked
                          ? (m.isBoss ? 'hsl(350 85% 78%)' : 'hsl(var(--nx-cyan))')
                          : 'hsl(0 0% 100% / 0.4)',
                    }}
                  >
                    {cleared ? <Check className="w-4 h-4" /> : !unlocked ? <Lock className="w-4 h-4" /> : m.isBoss ? <Skull className="w-4 h-4" /> : m.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black truncate">{m.name}</div>
                    <div className="nx-title text-[9px] mt-0.5" style={{ color: 'hsl(0 0% 100% / 0.55)' }}>
                      {m.waves.length} WAVES · {m.rewardCores} CORES
                    </div>
                  </div>
                  {m.modifier && unlocked && (
                    <div
                      className="nx-title text-[8px] px-1.5 py-0.5 max-w-[90px] text-right"
                      style={{
                        color: 'hsl(var(--nx-amber))',
                        background: 'hsl(var(--nx-amber) / 0.12)',
                        border: '1px solid hsl(var(--nx-amber) / 0.35)',
                      }}
                    >
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

