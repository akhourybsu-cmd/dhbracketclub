import { Link } from 'react-router-dom';
import { ArrowLeft, Flame } from 'lucide-react';
import { useTodayDungeon, useDailyLeaderboard } from '@/hooks/useRuneDelve';
import { useAuth } from '@/contexts/AuthContext';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import type { HeroClass } from '@/lib/runedelve/classConfig';
import { cn } from '@/lib/utils';

export default function RuneDelveLeaderboardPage() {
  const { user } = useAuth();
  const { data: dungeon } = useTodayDungeon();
  const { data: rows, isLoading } = useDailyLeaderboard(dungeon?.id);

  return (
    <div className="space-y-4 pb-8">
      <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <h1 className="page-header-title">Today's Leaderboard</h1>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl skeleton-shimmer" />)}</div>
      ) : (rows ?? []).length === 0 ? (
        <div className="glass-card p-6 text-center text-xs text-muted-foreground">No runs yet — be the first!</div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="divide-y divide-border/10">
            {(rows ?? []).map((r) => {
              const isMe = r.user_id === user?.id;
              const heroName = (r as any).hero?.hero_name as string | undefined;
              const title = (r as any).hero?.cosmetic_title as string | undefined;
              const lvl = (r as any).hero?.level as number | undefined;
              return (
                <div key={r.id} className={cn('flex items-center gap-3 px-3.5 py-3', isMe && 'bg-primary/5 border-l-2 border-l-primary')}>
                  <span className="w-6 font-mono font-extrabold text-sm tabular-nums text-muted-foreground">#{r.rank}</span>
                  {r.hero?.class && <ClassBadge cls={r.hero.class as HeroClass} size="sm" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate">
                      {heroName ?? r.profile.display_name}
                      {isMe && <span className="text-[10px] text-primary ml-1">(you)</span>}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
                      {lvl ? <span className="font-bold">Lv {lvl}</span> : null}
                      {title ? <><span>·</span><span className="text-primary/80 font-bold truncate">{title}</span></> : null}
                      {heroName ? <><span>·</span><span className="truncate">{r.profile.display_name}</span></> : null}
                      {r.dungeon_cleared && <><span>·</span><span className="font-bold text-success">CLEAR</span></>}
                      {r.hero?.current_streak ? <><span>·</span><span className="flex items-center gap-0.5"><Flame className="w-3 h-3 text-gold" />{r.hero.current_streak}</span></> : null}
                    </div>
                  </div>
                  <span className="font-mono text-sm font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{r.score.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
