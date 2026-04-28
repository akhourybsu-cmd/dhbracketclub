import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useResolvedMission } from '@/hooks/useMissionCalibrations';
import { TOWERS, TOWER_LIST } from '@/lib/nexus/towers';
import { ABILITIES, ABILITY_LIST } from '@/lib/nexus/abilities';
import { cn } from '@/lib/utils';

export default function NexusLoadoutPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const navigate = useNavigate();
  const id = parseInt(missionId || '1', 10);
  const { mission, loading } = useResolvedMission(id);
  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading mission…</div>;
  if (!mission) return <div className="p-6">Mission not found.</div>;

  return (
    <div className="max-w-md mx-auto pb-6 px-1">
      <div className="mb-4 mt-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Mission {mission.id}</div>
        <h1 className="text-2xl font-black">{mission.name}</h1>
        {mission.modifier && (
          <div className="mt-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">{mission.modifier.label}</div>
            <div className="text-xs text-amber-100/80 mt-0.5">{mission.modifier.description}</div>
          </div>
        )}
      </div>

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Tower Loadout · all 4 unlocked</h2>
        <div className="grid grid-cols-2 gap-2">
          {TOWER_LIST.map(t => (
            <div key={t.kind} className={cn('p-2.5 rounded-lg border-2 border-cyan-500/30 bg-card')}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-md bg-cyan-500/20 border border-cyan-400 flex items-center justify-center font-black text-cyan-300 text-sm">{t.glyph}</div>
                <div className="text-xs font-bold">{t.name}</div>
              </div>
              <div className="text-[10px] text-muted-foreground leading-snug">{t.tagline}</div>
              <div className="text-[10px] mt-1.5 text-amber-300">⚡{t.cost}</div>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="mb-4">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Commander Abilities</h2>
        <div className="grid grid-cols-2 gap-2">
          {ABILITY_LIST.map(a => (
            <div key={a.kind} className="p-2.5 rounded-lg border-2 border-amber-500/30 bg-card">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-md bg-amber-500/20 border border-amber-400 flex items-center justify-center font-black text-amber-300 text-sm">{a.glyph}</div>
                <div className="text-xs font-bold">{a.name}</div>
              </div>
              <div className="text-[10px] text-muted-foreground leading-snug">{a.tagline}</div>
              <div className="text-[10px] mt-1.5 text-cyan-300">CD {a.cooldownMs / 1000}s</div>
            </div>
          ))}
        </div>
      </motion.section>

      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        <Stat label="Start ⚡" value={mission.startEnergy} />
        <Stat label="Base HP" value={mission.baseHp} />
        <Stat label="Waves" value={mission.waves.length} />
      </div>

      <button
        onClick={() => navigate(`/nexus/battle/${mission.id}`)}
        className="w-full py-3.5 rounded-xl bg-emerald-500 text-emerald-950 font-black text-sm shadow-lg shadow-emerald-500/30 active:scale-95"
      >
        DEPLOY
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2.5 rounded-lg bg-card border border-border">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-black tabular-nums">{value}</div>
    </div>
  );
}
