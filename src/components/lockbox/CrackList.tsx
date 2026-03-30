import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Unlock, ChevronRight, AlertCircle, Swords } from 'lucide-react';

interface Props {
  locks: any[];
  weekId: string | undefined;
}

export function CrackList({ locks, weekId }: Props) {
  if (locks.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
        <h3 className="font-bold text-sm mb-1">No Locks Yet</h3>
        <p className="text-[11px] text-muted-foreground">Waiting for other players to create their locks this week</p>
      </div>
    );
  }

  const sorted = [...locks].sort((a, b) => {
    // Unsolved first, then in-progress, then cracked
    const aScore = a.myAttempt?.is_solved ? 2 : a.myAttempt ? 1 : 0;
    const bScore = b.myAttempt?.is_solved ? 2 : b.myAttempt ? 1 : 0;
    return aScore - bScore;
  });

  return (
    <div className="space-y-2">
      {sorted.map((lock: any, i: number) => {
        const attempt = lock.myAttempt;
        const isSolved = attempt?.is_solved;
        const phase = attempt?.phase || 'number';
        const attempts = attempt?.total_attempts || 0;
        const isCrackedByOther = lock.is_cracked && !isSolved;

        let statusBg = 'hsl(var(--muted) / 0.15)';
        let statusIcon = 'hsl(var(--muted-foreground))';
        let statusText = 'Unattempted';
        let StatusIcon = Lock;

        if (isSolved) {
          statusBg = 'hsl(var(--primary) / 0.12)';
          statusIcon = 'hsl(var(--primary))';
          statusText = `Cracked · ${attempts} tries`;
          StatusIcon = Unlock;
        } else if (attempt) {
          statusBg = 'hsl(45 93% 52% / 0.12)';
          statusIcon = 'hsl(45 93% 52%)';
          statusText = `In progress · ${phase}`;
          StatusIcon = Swords;
        } else if (isCrackedByOther) {
          statusText = 'Cracked by other';
        }

        // Phase dots for in-progress
        const phaseIdx = phase === 'number' ? 0 : phase === 'color' ? 1 : 2;

        return (
          <motion.div key={lock.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link to={`/lockbox/${lock.id}`}>
              <div className="glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: statusBg }}>
                  <StatusIcon className="w-5 h-5" style={{ color: statusIcon }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] truncate">{lock.profiles?.display_name || 'Player'}</div>
                  <div className="text-[10px] font-semibold text-muted-foreground">{statusText}</div>
                  {/* Phase progress dots for in-progress locks */}
                  {attempt && !isSolved && (
                    <div className="flex gap-1 mt-1.5">
                      {[0, 1, 2].map(p => (
                        <div key={p} className={`h-1 flex-1 rounded-full ${p < phaseIdx ? 'bg-primary' : p === phaseIdx ? 'bg-primary/40' : 'bg-muted/20'}`} />
                      ))}
                    </div>
                  )}
                </div>
                {attempt && !isSolved && (
                  <div className="text-right mr-1">
                    <div className="text-sm font-black text-foreground">{attempts}</div>
                    <div className="text-[9px] text-muted-foreground">tries</div>
                  </div>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
