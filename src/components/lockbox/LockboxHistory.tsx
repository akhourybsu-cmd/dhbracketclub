import { useState } from 'react';
import { motion } from 'framer-motion';
import { History, Trophy, ChevronRight, Lock, Calendar } from 'lucide-react';
import { usePastWeeks, useWeekScores, useAllWeekLocks } from '@/hooks/useLockbox';

function WeekDetail({ week }: { week: any }) {
  const { data: scores } = useWeekScores(week.id);
  const { data: locks } = useAllWeekLocks(week.id);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 space-y-2">
      {/* Winner + podium */}
      {scores && scores.length > 0 && (
        <div className="glass-card p-3.5">
          <div className="text-[10px] font-bold text-muted-foreground/60 mb-2 tracking-wider">FINAL STANDINGS</div>
          {scores.slice(0, 5).map((s: any, i: number) => (
            <div key={s.id} className={`flex items-center gap-2.5 py-1.5 ${i < scores.length - 1 ? 'border-b border-border/5' : ''}`}>
              <span className="w-6 text-center text-sm">{i < 3 ? medals[i] : `#${i + 1}`}</span>
              <span className="text-[12px] font-bold flex-1 truncate">{s.profiles?.display_name || 'Player'}</span>
              <span className="text-[10px] text-muted-foreground">🗡️{s.crack_points} 🛡️{s.defense_points}</span>
              <span className="font-bold text-sm">{s.total_points}</span>
            </div>
          ))}
        </div>
      )}

      {/* Lock summary */}
      {locks && locks.length > 0 && (
        <div className="glass-card p-3.5">
          <div className="text-[10px] font-bold text-muted-foreground/60 mb-2 tracking-wider">LOCKS</div>
          <div className="flex gap-3 text-[11px]">
            <span className="text-muted-foreground">{locks.length} total</span>
            <span className="text-destructive">{locks.filter((l: any) => l.is_cracked).length} cracked</span>
            <span className="text-primary">{locks.filter((l: any) => !l.is_cracked).length} defended</span>
          </div>
        </div>
      )}

      {(!scores || scores.length === 0) && (
        <div className="text-[11px] text-muted-foreground text-center py-3">No scores recorded for this week</div>
      )}
    </motion.div>
  );
}

export function LockboxHistory() {
  const { data: weeks, isLoading } = usePastWeeks();
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-card p-4 animate-pulse"><div className="h-8 bg-muted/20 rounded-lg" /></div>
        ))}
      </div>
    );
  }

  if (!weeks || weeks.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <History className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
        <h3 className="font-bold text-sm mb-1">No History Yet</h3>
        <p className="text-[11px] text-muted-foreground">Past weeks will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold text-muted-foreground/60 tracking-wider mb-2">WEEKLY ARCHIVE</div>
      {weeks.map((week: any) => {
        const isExpanded = expandedWeek === week.id;
        const startDate = new Date(week.starts_at);
        const dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return (
          <div key={week.id}>
            <button
              onClick={() => setExpandedWeek(isExpanded ? null : week.id)}
              className="w-full glass-card p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-muted/20 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px]">Week {week.week_number}</div>
                <div className="text-[10px] text-muted-foreground">{dateStr} • {week.year}</div>
              </div>
              <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                week.status === 'active' ? 'bg-primary/15 text-primary' : 'bg-muted/30 text-muted-foreground'
              }`}>
                {week.status === 'active' ? 'CURRENT' : 'COMPLETE'}
              </div>
              <ChevronRight className={`w-4 h-4 text-muted-foreground/30 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
            {isExpanded && <WeekDetail week={week} />}
          </div>
        );
      })}
    </div>
  );
}
