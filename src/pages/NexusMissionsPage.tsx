import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Check, Skull, Users, Infinity as InfinityIcon, ChevronRight } from 'lucide-react';
import { useResolvedMissions } from '@/hooks/useMissionCalibrations';
import { useNexusProgress } from '@/hooks/useNexusProgress';
import { resolveModifiers, modifierTone } from '@/lib/nexus/modifiers';
import { useActiveOperation } from '@/hooks/useNexusOperation';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';
import { cn } from '@/lib/utils';

export default function NexusMissionsPage() {
  const { progress } = useNexusProgress();
  const { missions: MISSIONS } = useResolvedMissions();
  const { operation } = useActiveOperation();
  // Endless lives outside the campaign list; always exclude here.
  const campaign = MISSIONS.filter(m => m.id !== ENDLESS_MISSION_ID);
  return (
    <div className="max-w-md mx-auto pb-6 px-1">
      <div className="mb-4 mt-1">
        <h1 className="text-2xl font-black">Outer Rim</h1>
        <p className="text-sm text-muted-foreground">Sector I · {campaign.length} missions</p>
      </div>

      {/* ── Special Operations: Endless (solo) + Co-op hub ── */}
      <div className="mb-4">
        <h2 className="nx-title text-[9px] mb-2" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.22em' }}>
          ◢ SPECIAL OPERATIONS
        </h2>
        <div className="space-y-2">
          {/* Co-op Operation */}
          <Link
            to="/nexus/operation"
            className="block p-3 nx-clip-sm active:scale-[0.99] transition"
            style={{
              background: operation
                ? 'linear-gradient(180deg, hsl(280 50% 14%), hsl(280 60% 8%))'
                : 'linear-gradient(180deg, hsl(280 25% 10%), hsl(280 35% 6%))',
              border: operation
                ? '1px solid hsl(280 80% 65% / 0.5)'
                : '1px dashed hsl(280 80% 65% / 0.4)',
              boxShadow: operation ? '0 0 14px -6px hsl(280 80% 60% / 0.5)' : undefined,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 nx-clip-sm flex items-center justify-center shrink-0"
                style={{
                  background: 'hsl(280 80% 65% / 0.18)',
                  border: '1.5px solid hsl(280 80% 65%)',
                  color: 'hsl(280 90% 80%)',
                }}
              >
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black truncate">Club Co-op Operation</div>
                <div className="nx-title text-[9px] mt-0.5" style={{ color: operation ? 'hsl(280 90% 78%)' : 'hsl(280 70% 70% / 0.7)' }}>
                  {operation
                    ? `PHASE ${operation.current_phase} · ${operation.total_contributors} ALL${operation.total_contributors === 1 ? 'Y' : 'IES'}`
                    : 'STANDBY · NO ACTIVE OP'}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/50 shrink-0" />
            </div>
          </Link>

          {/* Endless Solo */}
          <Link
            to={`/nexus/loadout/${ENDLESS_MISSION_ID}`}
            className="block p-3 nx-clip-sm active:scale-[0.99] transition"
            style={{
              background: 'linear-gradient(180deg, hsl(38 50% 12%), hsl(38 60% 6%))',
              border: '1px solid hsl(var(--nx-amber) / 0.5)',
              boxShadow: '0 0 14px -6px hsl(var(--nx-amber) / 0.45)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 nx-clip-sm flex items-center justify-center shrink-0"
                style={{
                  background: 'hsl(var(--nx-amber) / 0.18)',
                  border: '1.5px solid hsl(var(--nx-amber))',
                  color: 'hsl(var(--nx-amber))',
                }}
              >
                <InfinityIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black truncate">Endless Defense</div>
                <div className="nx-title text-[9px] mt-0.5" style={{ color: 'hsl(var(--nx-amber))' }}>
                  SOLO · STANDALONE LEADERBOARD
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/50 shrink-0" />
            </div>
          </Link>
        </div>
      </div>

      <h2 className="nx-title text-[9px] mb-2" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.22em' }}>
        ◢ CAMPAIGN MISSIONS
      </h2>
      <div className="space-y-2">
        {campaign.map((m, idx) => {
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
                  {unlocked && (() => {
                    const mods = resolveModifiers(m.modifierIds);
                    if (mods.length === 0) return null;
                    return (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {mods.slice(0, 3).map(mod => {
                          const t = modifierTone(mod.tone);
                          return (
                            <span
                              key={mod.id}
                              title={`${mod.label} — ${mod.short}`}
                              className="inline-flex items-center justify-center w-5 h-5 nx-clip-sm text-[10px] font-black"
                              style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.fg }}
                            >
                              {mod.glyph}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

