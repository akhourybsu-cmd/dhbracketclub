import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, X, Cpu } from 'lucide-react';
import { getMission, MISSIONS } from '@/lib/nexus/missions';

export default function NexusResultsPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = parseInt(missionId || '1', 10);
  const mission = getMission(id);
  const won = params.get('win') === '1';
  const score = parseInt(params.get('score') || '0', 10);
  const hp = parseInt(params.get('hp') || '0', 10);
  const waves = parseInt(params.get('waves') || '0', 10);
  const cores = parseInt(params.get('cores') || '0', 10);
  const next = MISSIONS.find(m => m.id === id + 1);

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
