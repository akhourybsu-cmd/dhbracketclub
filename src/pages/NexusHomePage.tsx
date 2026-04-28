import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Zap, Trophy, Target, Cpu } from 'lucide-react';
import { useNexusProgress } from '@/hooks/useNexusProgress';
import { useResolvedMissions } from '@/hooks/useMissionCalibrations';

export default function NexusHomePage() {
  const { progress } = useNexusProgress();
  const { missions } = useResolvedMissions();
  const nextMission = missions.find(m => m.id === progress.highest_mission) ?? missions[0];

  return (
    <div className="max-w-md mx-auto pb-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl mt-2 mb-4 p-5 border border-cyan-500/30 bg-[radial-gradient(circle_at_30%_20%,hsl(190_80%_25%/0.5),hsl(220_60%_8%))]"
      >
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300 mb-1">Outer Rim · Sector I</div>
          <h1 className="text-3xl font-black text-foreground mb-1">Nexus Defense</h1>
          <p className="text-sm text-muted-foreground mb-5 max-w-[260px]">Defend the energy core. Engineer your grid. Survive the swarm.</p>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-300 tabular-nums">{progress.cores}</span>
              <span className="text-[10px] text-amber-300/70">CORES</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300 tabular-nums">{Math.min(progress.highest_mission - 1, 6)}/6</span>
            </div>
          </div>

          <Link
            to={`/nexus/loadout/${nextMission.id}`}
            className="block w-full text-center px-4 py-3 rounded-xl bg-emerald-500 text-emerald-950 font-black active:scale-95 transition shadow-lg shadow-emerald-500/30"
          >
            DEPLOY · Mission {nextMission.id}: {nextMission.name}
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
      className="aspect-square rounded-xl border border-border bg-card hover:bg-secondary flex flex-col items-center justify-center gap-1.5 active:scale-95 transition"
    >
      <span className="text-cyan-400">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </Link>
  );
}
