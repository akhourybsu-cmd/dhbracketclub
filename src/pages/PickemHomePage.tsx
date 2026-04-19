import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Trophy, ListChecks, History as HistoryIcon, Info, Shield, ArrowRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveSeason, useCurrentWeek, useWeekGames, useMyWeekPicks,
  useSeasonStandings, useSeasonWeeks, deriveWeekStatus, isGameLocked,
} from '@/hooks/usePickem';
import { WeekStatusPill } from '@/components/pickem/WeekStatusPill';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export default function PickemHomePage() {
  const { user } = useAuth();
  const { season, loading: seasonLoading } = useActiveSeason();
  const { week } = useCurrentWeek(season);
  const { games } = useWeekGames(week?.id);
  const { picks } = useMyWeekPicks(week?.id);
  const { weeks } = useSeasonWeeks(season?.id);
  const { standings } = useSeasonStandings(season?.id);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }: any) => setIsAdmin(!!data));
  }, [user]);

  const me = standings.find((s) => s.user_id === user?.id);
  const totalGames = games.length;
  const pickedCount = picks.length;
  const remaining = Math.max(0, totalGames - pickedCount);
  const weekStatus = week ? (totalGames > 0 ? deriveWeekStatus(games) : week.status) : 'upcoming';
  const nextLockGame = games.find((g) => !isGameLocked(g));
  const recentScored = weeks.filter((w) => w.status === 'scored').slice(-3).reverse();

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <div className="page-header-icon" style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.05))',
          }}>
            <Trophy className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
          </div>
          <div>
            <h1 className="page-header-title">NFL Pick'em</h1>
            <p className="page-header-subtitle">Pick winners. Climb the standings.</p>
          </div>
        </div>
      </motion.div>

      {/* Hero season card */}
      {seasonLoading ? (
        <div className="glass-card p-5">
          <div className="h-5 w-1/2 rounded skeleton-shimmer mb-2" />
          <div className="h-3 w-1/3 rounded skeleton-shimmer" />
        </div>
      ) : !season ? (
        <div className="glass-card p-6 text-center">
          <Trophy className="w-7 h-7 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm font-bold mb-1">No season yet</p>
          <p className="text-xs text-muted-foreground">An admin needs to set up the season schedule.</p>
        </div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="relative rounded-2xl overflow-hidden glass-card p-5"
              style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.10), hsl(var(--background)))' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold/80">{season.year} Season</p>
                  <h2 className="text-xl font-extrabold leading-tight truncate">{season.name}</h2>
                  {week && <p className="text-[12px] text-muted-foreground mt-0.5">{week.label}</p>}
                </div>
                <WeekStatusPill status={weekStatus} />
              </div>

              {week ? (
                <Link to={`/pickem/week/${week.week_number}`} className="block">
                  <div className="rounded-xl p-4 mb-3"
                    style={{ background: 'hsl(var(--gold) / 0.18)', border: '1px solid hsl(var(--gold) / 0.30)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gold/90">
                          {weekStatus === 'open' || weekStatus === 'partially_locked' ? 'Make Your Picks' : 'View Slate'}
                        </p>
                        <p className="text-base font-extrabold mt-0.5">
                          {pickedCount} of {totalGames} picked
                        </p>
                        {remaining > 0 && weekStatus === 'open' && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {remaining} game{remaining === 1 ? '' : 's'} still need a pick
                          </p>
                        )}
                      </div>
                      <ArrowRight className="w-5 h-5 text-gold" />
                    </div>
                    {totalGames > 0 && (
                      <div className="mt-3 h-1.5 rounded-full bg-background/40 overflow-hidden">
                        <div className="h-full rounded-full bg-gold transition-all"
                          style={{ width: `${Math.round((pickedCount / totalGames) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                </Link>
              ) : (
                <div className="rounded-xl p-4 bg-muted/30 mb-3">
                  <p className="text-sm font-bold">Week not configured yet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Check back soon.</p>
                </div>
              )}

              {nextLockGame && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Next lock: <span className="font-bold text-foreground">{format(new Date(nextLockGame.kickoff_at), 'EEE h:mm a')}</span>
                </p>
              )}
            </div>
          </motion.div>

          {/* Season snapshot */}
          {me && (
            <Link to="/pickem/standings">
              <div className="glass-card p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gold/15">
                  <Trophy className="w-5 h-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your Season</p>
                  <p className="text-base font-extrabold">
                    {me.total_correct}<span className="text-muted-foreground">/{me.total_picked}</span>
                    <span className="text-muted-foreground font-normal"> · </span>
                    <span className="text-gold">#{me.rank ?? '–'}</span>
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
              </div>
            </Link>
          )}

          {/* Recent results */}
          {recentScored.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2 px-1">
                Recent Results
              </p>
              <div className="space-y-1.5">
                {recentScored.map((w) => (
                  <Link key={w.id} to={`/pickem/week/${w.week_number}/results`}>
                    <div className="glass-card p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                      <div className="text-[11px] font-extrabold text-muted-foreground w-12">{w.label}</div>
                      <div className="flex-1 text-[11px] text-muted-foreground">Final results in</div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-2">
            <Link to="/pickem/standings" className="glass-card p-4 flex flex-col items-start gap-1 hover:bg-muted/30 transition-colors">
              <Trophy className="w-4 h-4 text-gold" />
              <p className="text-[12px] font-bold mt-1">Standings</p>
              <p className="text-[10px] text-muted-foreground">Season leaderboard</p>
            </Link>
            <Link to="/pickem/history" className="glass-card p-4 flex flex-col items-start gap-1 hover:bg-muted/30 transition-colors">
              <HistoryIcon className="w-4 h-4 text-foreground/70" />
              <p className="text-[12px] font-bold mt-1">My History</p>
              <p className="text-[10px] text-muted-foreground">All my picks</p>
            </Link>
            <Link to="/pickem/rules" className="glass-card p-4 flex flex-col items-start gap-1 hover:bg-muted/30 transition-colors">
              <Info className="w-4 h-4 text-primary" />
              <p className="text-[12px] font-bold mt-1">Rules</p>
              <p className="text-[10px] text-muted-foreground">How it works</p>
            </Link>
            {isAdmin && (
              <Link to="/pickem/admin" className="glass-card p-4 flex flex-col items-start gap-1 hover:bg-muted/30 transition-colors">
                <Shield className="w-4 h-4 text-destructive" />
                <p className="text-[12px] font-bold mt-1">Admin</p>
                <p className="text-[10px] text-muted-foreground">Schedule & finals</p>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
