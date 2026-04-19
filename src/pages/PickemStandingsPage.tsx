import { Link } from 'react-router-dom';
import { ChevronLeft, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveSeason, useSeasonStandings } from '@/hooks/usePickem';
import { cn } from '@/lib/utils';

export default function PickemStandingsPage() {
  const { user } = useAuth();
  const { season } = useActiveSeason();
  const { standings, loading } = useSeasonStandings(season?.id);

  return (
    <div className="space-y-3 pb-6">
      <Link to="/pickem" className="text-[12px] text-muted-foreground flex items-center gap-1 btn-press">
        <ChevronLeft className="w-4 h-4" /> Pick'em
      </Link>
      <div className="page-header">
        <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.05))' }}>
          <Trophy className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h1 className="page-header-title">Season Standings</h1>
          <p className="page-header-subtitle">{season?.name ?? 'NFL Pick\'em'}</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : standings.length === 0 ? (
          <div className="p-8 text-center">
            <Trophy className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm font-bold">No standings yet</p>
            <p className="text-xs text-muted-foreground mt-1">Standings appear once the first week is scored.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {standings.map((s, i) => {
              const isMe = s.user_id === user?.id;
              const rank = s.rank ?? i + 1;
              return (
                <div key={s.id} className={cn(
                  'flex items-center gap-3 px-4 py-3.5',
                  isMe && 'bg-gold/5 border-l-2 border-l-gold',
                  rank === 1 && 'bg-gradient-to-r from-gold/10 to-transparent',
                )}>
                  <div className="w-7 text-center text-[13px] font-extrabold tabular-nums">
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-extrabold truncate">{(s.profiles as any)?.display_name ?? 'Unknown'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.total_correct}/{s.total_picked} · {Math.round((s.accuracy || 0) * 100)}%
                      {s.weekly_wins > 0 && <> · {s.weekly_wins}W</>}
                      {s.avg_weekly_rank != null && <> · avg #{s.avg_weekly_rank.toFixed(1)}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold tabular-nums leading-none">{s.total_correct}</p>
                    <p className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mt-0.5">correct</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
