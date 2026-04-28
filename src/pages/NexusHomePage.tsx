import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Trophy, Target } from 'lucide-react';
import { useNexusProgress } from '@/hooks/useNexusProgress';
import { useResolvedMissions } from '@/hooks/useMissionCalibrations';

export default function NexusHomePage() {
  const { progress } = useNexusProgress();
  const { missions } = useResolvedMissions();
  const nextMission = missions.find(m => m.id === progress.highest_mission) ?? missions[0];
  const cleared = Math.min(progress.highest_mission - 1, 6);

  return (
    <div className="max-w-md mx-auto pb-6">
      {/* ───── Command panel hero ───── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden mt-2 mb-4 nx-clip nx-bracket"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 25% 15%, hsl(188 70% 22% / 0.55), transparent 60%),' +
            'linear-gradient(160deg, hsl(218 50% 10%), hsl(220 60% 5%))',
          border: '1px solid hsl(var(--nx-cyan) / 0.4)',
          boxShadow:
            '0 0 24px -8px hsl(var(--nx-cyan) / 0.55), inset 0 1px 0 hsl(var(--nx-cyan) / 0.18)',
        }}
      >
        {/* Decorative grid */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--nx-cyan)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--nx-cyan)) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 70% 70% at 80% 50%, black, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 80% 50%, black, transparent 80%)',
          }}
        />
        {/* Glow halo */}
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full" style={{ background: 'hsl(188 92% 56% / 0.18)', filter: 'blur(40px)' }} />

        <div className="relative p-5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="nx-pulse-dot inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--nx-cyan))', boxShadow: '0 0 6px hsl(var(--nx-cyan))' }} />
            <p className="nx-title text-[9px]" style={{ color: 'hsl(var(--nx-cyan))' }}>OUTER RIM · SECTOR I</p>
          </div>
          <h1 className="text-3xl font-black text-foreground mb-1.5 tracking-tight">Nexus Defense</h1>
          <p className="text-xs text-foreground/65 mb-5 max-w-[280px] leading-relaxed">
            Defend the energy core. Engineer your grid. Survive the swarm.
          </p>

          {/* Mini stats — tactical readouts */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            <div className="nx-clip-sm px-2.5 py-2" style={{ background: 'hsl(218 35% 7%)', border: '1px solid hsl(var(--nx-amber) / 0.3)' }}>
              <div className="flex items-center justify-between">
                <span className="nx-title text-[8px]" style={{ color: 'hsl(var(--nx-amber) / 0.85)' }}>CORES</span>
                <span className="text-[9px]" style={{ color: 'hsl(var(--nx-amber))' }}>⚡</span>
              </div>
              <div className="text-base font-black tabular-nums leading-none mt-0.5" style={{ color: 'hsl(var(--nx-amber))' }}>{progress.cores}</div>
            </div>
            <div className="nx-clip-sm px-2.5 py-2" style={{ background: 'hsl(218 35% 7%)', border: '1px solid hsl(150 80% 60% / 0.3)' }}>
              <div className="flex items-center justify-between">
                <span className="nx-title text-[8px]" style={{ color: 'hsl(150 80% 70% / 0.85)' }}>CLEARED</span>
                <Trophy className="w-2.5 h-2.5" style={{ color: 'hsl(150 80% 70%)' }} />
              </div>
              <div className="text-base font-black tabular-nums leading-none mt-0.5" style={{ color: 'hsl(150 80% 70%)' }}>{cleared}/6</div>
            </div>
          </div>

          <Link
            to={`/nexus/loadout/${nextMission.id}`}
            className="block w-full text-center px-4 py-3 nx-clip-sm font-black text-sm active:scale-95 transition nx-title relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, hsl(150 80% 55%), hsl(150 80% 42%))',
              color: 'hsl(150 30% 8%)',
              boxShadow: '0 0 18px hsl(150 80% 55% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.35)',
            }}
          >
            ▶  DEPLOY · M{nextMission.id} {nextMission.name.toUpperCase()}
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-2">
        <NavTile to="/nexus/missions" icon={<Target className="w-4 h-4" />} label="Sector Map" />
        <NavTile to="/nexus/leaderboard" icon={<Trophy className="w-4 h-4" />} label="Leaderboard" />
        <NavTile to="/nexus/codex" icon={<Shield className="w-4 h-4" />} label="Codex" />
      </div>
    </div>
  );
}

function NavTile({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="aspect-square nx-clip-sm flex flex-col items-center justify-center gap-1.5 active:scale-95 transition"
      style={{
        background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
        border: '1px solid hsl(var(--nx-cyan) / 0.2)',
        boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.04)',
      }}
    >
      <span style={{ color: 'hsl(var(--nx-cyan))' }}>{icon}</span>
      <span className="nx-title text-[9px]">{label}</span>
    </Link>
  );
}
