import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Unlock, ChevronRight, Swords, Shield } from 'lucide-react';

interface Props {
  locks: any[];
  weekId: string | undefined;
}

export function CrackList({ locks, weekId }: Props) {
  if (locks.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Swords className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
        <h3 className="font-bold text-sm mb-1">No Locks to Crack</h3>
        <p className="text-[11px] text-muted-foreground">Waiting for other players to set their locks today</p>
      </div>
    );
  }

  // Sort: unattempted first, then in-progress, then solved
  const sorted = [...locks].sort((a, b) => {
    const score = (l: any) => {
      if (l.myAttempt?.is_solved) return 2;
      if (l.myAttempt) return 0; // in-progress first after unattempted
      return 1; // unattempted
    };
    return score(a) - score(b);
  });

  const phaseLabels: Record<string, string> = {
    number: 'Numbers',
    color: 'Colors',
    maze: 'Maze',
  };

  const crackedCount = locks.filter((l: any) => l.myAttempt?.is_solved).length;
  const inProgressCount = locks.filter((l: any) => l.myAttempt && !l.myAttempt.is_solved).length;

  return (
    <div className="space-y-2">
      {/* Quick summary */}
      <div className="flex gap-3 mb-1 px-1">
        <span className="text-[10px] text-muted-foreground">
          {locks.length} lock{locks.length !== 1 ? 's' : ''}
        </span>
        {crackedCount > 0 && (
          <span className="text-[10px] text-primary font-semibold">
            {crackedCount} cracked
          </span>
        )}
        {inProgressCount > 0 && (
          <span className="text-[10px] text-amber-400 font-semibold">
            {inProgressCount} in progress
          </span>
        )}
      </div>

      {sorted.map((lock: any, i: number) => {
        const attempt = lock.myAttempt;
        const isSolved = attempt?.is_solved;
        const phase = attempt?.phase || 'number';
        const attempts = attempt?.total_attempts || 0;
        const isCrackedByOther = lock.is_cracked;
        const phaseIdx = phase === 'number' ? 0 : phase === 'color' ? 1 : 2;

        let statusText = 'Unattempted';
        let statusStyle: 'solved' | 'inprogress' | 'default' = 'default';

        if (isSolved) {
          statusText = `Cracked · ${attempts} tries`;
          statusStyle = 'solved';
        } else if (attempt) {
          statusText = `${phaseLabels[phase]} phase · ${attempts} tries`;
          statusStyle = 'inprogress';
        } else if (isCrackedByOther) {
          statusText = 'Cracked by someone else';
        }

        const iconBg = statusStyle === 'solved'
          ? 'hsl(var(--primary) / 0.12)'
          : statusStyle === 'inprogress'
          ? 'hsl(45 93% 52% / 0.12)'
          : 'hsl(var(--muted) / 0.15)';

        const iconColor = statusStyle === 'solved'
          ? 'hsl(var(--primary))'
          : statusStyle === 'inprogress'
          ? 'hsl(45 93% 52%)'
          : 'hsl(var(--muted-foreground))';

        const StatusIcon = isSolved ? Unlock : (attempt ? Swords : (isCrackedByOther ? Unlock : Lock));

        return (
          <motion.div
            key={lock.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link to={`/lockbox/${lock.id}`}>
              <div className={`glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform ${
                statusStyle === 'solved' ? 'border border-primary/10' : statusStyle === 'inprogress' ? 'border border-amber-400/10' : ''
              }`}>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: iconBg }}
                >
                  <StatusIcon className="w-5 h-5" style={{ color: iconColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] truncate">
                    {lock.profiles?.display_name || 'Player'}
                    {isCrackedByOther && !isSolved && !attempt && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground font-semibold align-middle">
                        CRACKED
                      </span>
                    )}
                    {isCrackedByOther && attempt && !isSolved && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground font-semibold align-middle">
                        CRACKED
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-semibold text-muted-foreground">{statusText}</div>
                  {/* Phase progress for in-progress */}
                  {attempt && !isSolved && (
                    <div className="flex gap-1 mt-1.5">
                      {['Numbers', 'Colors', 'Maze'].map((label, p) => (
                        <div key={p} className="flex-1">
                          <div className={`h-1 rounded-full transition-all ${
                            p < phaseIdx ? 'bg-primary' : p === phaseIdx ? 'bg-primary/40 animate-pulse' : 'bg-muted/20'
                          }`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {(attempt || isSolved) && (
                  <div className="text-right mr-1">
                    <div className={`text-sm font-black ${isSolved ? 'text-primary' : ''}`}>{attempts}</div>
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
