import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronRight, Trophy, History as HistoryIcon, Info, Shield, ArrowRight,
  Calendar, Sparkles, ListChecks, BarChart3, Flame,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveSeason, useCurrentWeek, useWeekGames, useMyWeekPicks,
  useSeasonStandings, useSeasonWeeks, deriveWeekStatus, isGameLocked,
} from '@/hooks/usePickem';
import { WeekStatusPill } from '@/components/pickem/WeekStatusPill';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';
import { KickoffCountdown } from '@/components/pickem/KickoffCountdown';
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
      {/* ─────────── Pick Center hero (turf) ─────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
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
        ) : (
          <TurfBackdrop className="px-5 pt-5 pb-4">
            {/* Broadcast lower-third label */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[hsl(45_95%_55%/0.15)] border border-[hsl(45_95%_55%/0.4)]">
                  <Trophy className="w-3.5 h-3.5 text-gold" />
                </span>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-gold/95">
                  Pick Center
                </p>
              </div>
              <WeekStatusPill status={weekStatus} />
            </div>

            <p className="text-[10px] font-extrabold uppercase tracking-[0.20em] text-white/55">
              {season.year} NFL Season
            </p>
            <h1 className="text-[24px] sm:text-[26px] font-extrabold tracking-tight leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              {season.name}
            </h1>

            {isPreseasonInaugural ? (
              /* ── Preseason: kickoff countdown ── */
              <div className="mt-4 space-y-3">
                <div className="rounded-xl px-4 py-3 bg-black/30 border border-[hsl(45_95%_55%/0.35)] flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-gold pk-pulse shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold/90">
                      Kickoff Countdown
                    </p>
                    <p className="text-[15px] font-extrabold text-white tabular-nums leading-tight mt-0.5">
                      <KickoffCountdown target={season.starts_at} />
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/60 font-bold">Sep</p>
                    <p className="text-[18px] font-extrabold text-white tabular-nums leading-none">
                      {format(new Date(season.starts_at), 'd')}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-white/65 leading-relaxed">
                  The slate drops in May 2026. Standings, picks, and bragging rights start at kickoff.
                </p>
              </div>
            ) : week ? (
              <Link to={`/pickem/week/${week.week_number}`} className="block group mt-4">
                <motion.div
                  whileTap={{ scale: 0.985 }}
                  className="rounded-xl p-3.5 bg-black/35 border border-[hsl(45_95%_55%/0.40)] relative overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold">
                        {weekStatus === 'open' || weekStatus === 'partially_locked' ? 'Lock In Picks' : 'View Slate'}
                      </p>
                      <p className="text-[18px] font-extrabold mt-0.5 tabular-nums text-white leading-none">
                        {pickedCount}<span className="text-white/55 font-bold">/{totalGames}</span>{' '}
                        <span className="text-white/55 font-bold text-[12px] uppercase tracking-wider">picked</span>
                      </p>
                      <p className="text-[11px] text-white/60 mt-1">{week.label}</p>
                    </div>
                    <div className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/20 border border-gold/40">
                      <ArrowRight className="w-5 h-5 text-gold group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                  {totalGames > 0 && (
                    <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((pickedCount / totalGames) * 100)}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gold"
                        style={{ boxShadow: '0 0 8px hsl(var(--gold) / 0.6)' }}
                      />
                    </div>
                  )}
                  {remaining > 0 && (weekStatus === 'open' || weekStatus === 'partially_locked') && (
                    <p className="text-[11px] text-gold/85 mt-2 font-bold">
                      {remaining} game{remaining === 1 ? '' : 's'} still need a pick
                    </p>
                  )}
                </motion.div>
              </Link>
            ) : (
              <div className="mt-4 rounded-xl p-4 bg-black/30 border border-white/10">
                <p className="text-[13px] font-extrabold text-white">Slate not yet imported</p>
                <p className="text-[11px] text-white/60 mt-0.5">An admin will sync games soon.</p>
              </div>
            )}

            {/* stat chip strip */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {me?.rank != null && (
                <span className="pk-chip pk-chip-gold">
                  <Trophy className="w-3 h-3" /> Rank #{me.rank}
                </span>
              )}
              {me && (
                <span className="pk-chip">
                  <BarChart3 className="w-3 h-3" /> {me.total_correct}/{me.total_picked}
                </span>
              )}
              {totalGames > 0 && (
                <span className="pk-chip">
                  <ListChecks className="w-3 h-3" /> {totalGames} games
                </span>
              )}
              {nextLockGame && (
                <span className="pk-chip">
                  <Calendar className="w-3 h-3" /> Locks {format(new Date(nextLockGame.kickoff_at), 'EEE h:mm a')}
                </span>
              )}
              {isPreseasonInaugural && daysToKickoff > 0 && (
                <span className="pk-chip pk-chip-gold">
                  <Flame className="w-3 h-3" /> {daysToKickoff}d to kickoff
                </span>
              )}
            </div>
          </TurfBackdrop>
        )}
      </motion.div>

      {/* ─────────── Action tiles ─────────── */}
      <div className="grid grid-cols-2 gap-2">
        <ActionTile
          to="/pickem/standings"
          icon={<Trophy className="w-4 h-4 text-gold" />}
          label="Standings"
          sub="See the race"
          stat={me?.rank ? `#${me.rank}` : null}
        />
        <ActionTile
          to="/pickem/history"
          icon={<HistoryIcon className="w-4 h-4 text-foreground/80" />}
          label="My History"
          sub="Past picks"
          stat={me ? `${me.total_correct}/${me.total_picked}` : null}
        />
        <ActionTile
          to="/pickem/rules"
          icon={<Info className="w-4 h-4 text-primary" />}
          label="Rules"
          sub="How scoring works"
        />
        {isAdmin ? (
          <ActionTile
            to="/pickem/admin"
            icon={<Shield className="w-4 h-4 text-destructive" />}
            label="Admin"
            sub="Schedule & finals"
          />
        ) : week ? (
          <ActionTile
            to={`/pickem/week/${week.week_number}`}
            icon={<Flame className="w-4 h-4 text-gold" />}
            label="Pick Center"
            sub="Lock this week"
            highlight
          />
        ) : (
          <ActionTile
            to="/pickem/rules"
            icon={<Sparkles className="w-4 h-4 text-gold" />}
            label="Get Ready"
            sub="Review the rules"
          />
        )}
      </div>

      {/* ─────────── Recent results ─────────── */}
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
                    <div className="w-9 h-9 rounded-lg flex flex-col items-center justify-center bg-gold/10 border border-gold/25">
                      <p className="text-[7px] text-gold font-extrabold uppercase tracking-wider leading-none">Wk</p>
                      <p className="text-[12px] text-gold font-extrabold tabular-nums leading-none mt-0.5">{w.week_number}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-extrabold truncate">{w.label}</p>
                      <p className="text-[10px] text-muted-foreground">Final results in</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────── ActionTile ──────────── */
function ActionTile({
  to, icon, label, sub, stat, highlight,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  stat?: string | null;
  highlight?: boolean;
}) {
  return (
    <Link to={to} className="block">
      <div
        className="pk-tile btn-press"
        style={highlight ? {
          borderColor: 'hsl(45 95% 55% / 0.45)',
          boxShadow: '0 0 14px hsl(45 95% 55% / 0.18)',
        } : undefined}
      >
        <div className="flex items-start justify-between relative">
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/5 border border-white/10">
            {icon}
          </div>
          {stat && (
            <span className="text-[11px] font-extrabold tabular-nums text-gold">{stat}</span>
          )}
        </div>
        <div className="relative">
          <p className="text-[13px] font-extrabold tracking-tight text-white">{label}</p>
          <p className="text-[10px] text-white/55 mt-0.5">{sub}</p>
        </div>
      </div>
    </Link>
  );
}
