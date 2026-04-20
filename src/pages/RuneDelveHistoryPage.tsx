import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useRunHistory } from '@/hooks/useRuneDelve';
import { format, parseISO } from 'date-fns';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import type { HeroClass } from '@/lib/runedelve/classConfig';

export default function RuneDelveHistoryPage() {
  const { data: runs, isLoading } = useRunHistory(30);

  return (
    <div className="space-y-4 pb-8">
      <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <h1 className="page-header-title">Delve History</h1>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}</div>
      ) : (runs ?? []).length === 0 ? (
        <div className="glass-card p-6 text-center text-xs text-muted-foreground">No runs yet — your delves will appear here.</div>
      ) : (
        <div className="space-y-2">
          {(runs ?? []).map(r => (
            <div key={r.id} className="glass-card p-3 flex items-center gap-3">
              <ClassBadge cls={r.hero_class as HeroClass} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold">{format(parseISO(r.run_date), 'MMM d, yyyy')}</p>
                <p className="text-[10px] text-muted-foreground">
                  {r.dungeon_cleared && <span className="font-bold text-success">CLEAR · </span>}
                  {r.enemies_defeated} kills · chain {r.longest_chain}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{r.score.toLocaleString()}</p>
                <p className="text-[9px] text-muted-foreground">+{r.xp_earned} XP</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
