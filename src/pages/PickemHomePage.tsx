import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Trophy, History as HistoryIcon, Info, Shield, ArrowRight, Calendar, Sparkles } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveSeason, useCurrentWeek, useWeekGames, useMyWeekPicks,
  useSeasonStandings, useSeasonWeeks, deriveWeekStatus, isGameLocked,
} from '@/hooks/usePickem';
import { WeekStatusPill } from '@/components/pickem/WeekStatusPill';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const isPreseasonInaugural = season && season.status === 'upcoming' && totalGames === 0;
  const daysToKickoff = season ? differenceInDays(new Date(season.starts_at), new Date()) : 0;

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="page-header">
          <div className="page-header-icon" style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.05))',
            boxShadow: 'var(--shadow-gold)',
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
        <div className="glass-card p-8 text-center">
          <Trophy className="w-7 h-7 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm font-bold mb-1">No season yet</p>
          <p className="text-xs text-muted-foreground">An admin needs to set up the season schedule.</p>
        </div>
      ) : isPreseasonInaugural ? (
        /* ════════ Premium Inaugural / Pre-season hero ════════ */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <div
            className="relative rounded-2xl overflow-hidden p-6 text-center"
            style={{
              background: 'radial-gradient(ellipse 100% 70% at 50% 0%, hsl(var(--gold) / 0.18), transparent 70%), linear-gradient(180deg, hsl(var(--card)), hsl(var(--background)))',
              border: '1px solid hsl(var(--gold) / 0.25)',
              boxShadow: 'var(--shadow-gold), var(--shadow-card)',
            }}
          >
            {/* Decorative top edge glow */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 18 }}
              className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold) / 0.28), hsl(var(--gold) / 0.06))',
                boxShadow: '0 0 32px hsl(var(--gold) / 0.25), inset 0 1px 0 hsl(var(--gold) / 0.2)',
              }}
            >
              <Trophy className="w-10 h-10" style={{ color: 'hsl(var(--gold))' }} />
              <Sparkles className="w-3.5 h-3.5 absolute -top-1 -right-1 text-gold animate-pulse" />
            </motion.div>

            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-gold/90 mb-1">
              Inaugural Season
            </p>
            <h2 className="text-[22px] font-extrabold tracking-tight leading-tight">{season.name}</h2>
            <p className="text-[12px] text-muted-foreground mt-2 max-w-[280px] mx-auto leading-relaxed">
              The first NFL Pick'em on DH Club. Schedule drops in May 2026.
            </p>

            <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-full"
              style={{ background: 'hsl(var(--gold) / 0.12)', border: '1px solid hsl(var(--gold) / 0.28)' }}>
              <Calendar className="w-3.5 h-3.5 text-gold" />
              <span className="text-[11px] font-bold text-foreground">
                Kickoff <span className="text-gold">{format(new Date(season.starts_at), 'MMM d, yyyy')}</span>
                {daysToKickoff > 0 && <span className="text-muted-foreground/70 font-normal"> · {daysToKickoff}d</span>}
              </span>
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="relative rounded-2xl overflow-hidden glass-card p-5"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, hsl(var(--gold) / 0.12), transparent 60%), hsl(var(--card))' }}
            >
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-gold/90">{season.year} Season</p>
                  <h2 className="text-[20px] font-extrabold leading-tight tracking-tight truncate mt-0.5">{season.name}</h2>
                  {week && <p className="text-[12px] text-muted-foreground mt-0.5">{week.label}</p>}
                </div>
                <WeekStatusPill status={weekStatus} />
              </div>

              {week ? (
                <Link to={`/pickem/week/${week.week_number}`} className="block group">
                  <motion.div whileTap={{ scale: 0.985 }}
                    className="rounded-xl p-4 mb-3 transition-all"
                    style={{ background: 'hsl(var(--gold) / 0.16)', border: '1px solid hsl(var(--gold) / 0.30)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gold/90">
                          {weekStatus === 'open' || weekStatus === 'partially_locked' ? 'Make Your Picks' : 'View Slate'}
                        </p>
                        <p className="text-[17px] font-extrabold mt-0.5 tabular-nums">
                          {pickedCount} <span className="text-muted-foreground/70 font-bold">of</span> {totalGames} <span className="text-muted-foreground/70 font-bold text-[13px]">picked</span>
                        </p>
                        {remaining > 0 && weekStatus === 'open' && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {remaining} game{remaining === 1 ? '' : 's'} still need a pick
                          </p>
                        )}
                      </div>
                      <ArrowRight className="w-5 h-5 text-gold group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    {totalGames > 0 && (
                      <div className="mt-3 h-1.5 rounded-full bg-background/40 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round((pickedCount / totalGames) * 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="h-full rounded-full bg-gold"
                          style={{ boxShadow: '0 0 8px hsl(var(--gold) / 0.5)' }}
                        />
                      </div>
                    )}
                  </motion.div>
                </Link>
              ) : (
                <div className="rounded-xl p-4 bg-muted/20 mb-3 border border-border/30">
                  <p className="text-sm font-bold">Schedule not yet imported</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">An admin will sync games soon.</p>
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
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gold/15"
                  style={{ boxShadow: 'inset 0 0 12px hsl(var(--gold) / 0.15)' }}>
                  <Trophy className="w-5 h-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Your Season</p>
                  <p className="text-base font-extrabold tabular-nums">
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
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground mb-2 px-1">
                Recent Results
              </p>
              <div className="space-y-1.5">
                {recentScored.map((w, i) => (
                  <motion.div key={w.id}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}>
                    <Link to={`/pickem/week/${w.week_number}/results`}>
                      <div className="glass-card p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                        <div className="text-[11px] font-extrabold text-muted-foreground w-12">{w.label}</div>
                        <div className="flex-1 text-[11px] text-muted-foreground">Final results in</div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick links — always visible */}
      <div className="grid grid-cols-2 gap-2">
        <Link to="/pickem/standings" className="glass-card p-4 flex flex-col items-start gap-1 hover:bg-muted/30 transition-colors min-h-[88px]">
          <Trophy className="w-4 h-4 text-gold" />
          <p className="text-[12px] font-extrabold mt-1">Standings</p>
          <p className="text-[10px] text-muted-foreground">Season leaderboard</p>
        </Link>
        <Link to="/pickem/history" className="glass-card p-4 flex flex-col items-start gap-1 hover:bg-muted/30 transition-colors min-h-[88px]">
          <HistoryIcon className="w-4 h-4 text-foreground/70" />
          <p className="text-[12px] font-extrabold mt-1">My History</p>
          <p className="text-[10px] text-muted-foreground">All my picks</p>
        </Link>
        <Link to="/pickem/rules" className="glass-card p-4 flex flex-col items-start gap-1 hover:bg-muted/30 transition-colors min-h-[88px]">
          <Info className="w-4 h-4 text-primary" />
          <p className="text-[12px] font-extrabold mt-1">Rules</p>
          <p className="text-[10px] text-muted-foreground">How it works</p>
        </Link>
        {isAdmin && (
          <Link to="/pickem/admin" className="glass-card p-4 flex flex-col items-start gap-1 hover:bg-muted/30 transition-colors min-h-[88px]">
            <Shield className="w-4 h-4 text-destructive" />
            <p className="text-[12px] font-extrabold mt-1">Admin</p>
            <p className="text-[10px] text-muted-foreground">Schedule & finals</p>
          </Link>
        )}
      </div>
    </div>
  );
}
