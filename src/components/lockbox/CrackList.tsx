import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Unlock, ChevronRight, AlertCircle } from 'lucide-react';

interface Props {
  locks: any[];
  weekId: string | undefined;
}

export function CrackList({ locks, weekId }: Props) {
  if (locks.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
        <h3 className="font-bold text-sm mb-1">No Locks Yet</h3>
        <p className="text-[11px] text-muted-foreground">Waiting for other players to create their locks</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {locks.map((lock: any, i: number) => {
        const attempt = lock.myAttempt;
        const isSolved = attempt?.is_solved;
        const phase = attempt?.phase || 'number';
        const attempts = attempt?.total_attempts || 0;

        let statusColor = 'muted-foreground';
        let statusText = 'Unattempted';
        let StatusIcon = Lock;

        if (isSolved) {
          statusColor = 'primary';
          statusText = `Cracked in ${attempts}`;
          StatusIcon = Unlock;
        } else if (attempt) {
          statusColor = 'warning';
          statusText = `Phase: ${phase} • ${attempts} tries`;
          StatusIcon = Lock;
        }

        return (
          <motion.div key={lock.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link to={`/lockbox/${lock.id}`}>
              <div className="glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center`}
                  style={{ background: `hsl(var(--${isSolved ? 'primary' : 'destructive'}) / 0.12)` }}>
                  <StatusIcon className="w-5 h-5" style={{ color: `hsl(var(--${isSolved ? 'primary' : 'destructive'}))` }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] truncate">{lock.profiles?.display_name || 'Player'}</div>
                  <div className="text-[10px] font-semibold" style={{ color: `hsl(var(--${statusColor}))` }}>
                    {statusText}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
