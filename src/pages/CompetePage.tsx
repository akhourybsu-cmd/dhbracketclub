import { Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, BarChart3, MessageCircle, Bookmark, ChevronRight, Plus, Swords, Lock, Shield,
  Calendar, Award, TrendingUp, Users, Archive, Crown, Target, Flame, Medal
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentDay, useMyLock, useDayLocks } from '@/hooks/useLockbox';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftListUpdates } from '@/hooks/useRealtimeSubscription';
import { getDerivedDraftTurn } from '@/lib/draftTurn';
import {
  useCurrentSeason,
  useSeasonStandings,
  useSeasonEntries,
  usePlayoffMatches,
  useLifetimeStats,
  type SeasonStanding,
} from '@/hooks/useDraftSeasons';
import { getSeasonDisplayName, getOrdinalSuffix, getWeekLabel, getSeasonEmoji } from '@/lib/seasonUtils';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/* ── Lockbox card (unchanged) ── */
function LockboxCompeteCard() {
  const { user } = useAuth();
  const { data: day } = useCurrentDay();
  const { data: myLock } = useMyLock(day?.id);
  const { data: locks } = useDayLocks(day?.id);

  const crackedCount = (locks || []).filter((l: any) => l.myAttempt?.is_solved).length;
  const totalLocks = (locks || []).length;
  const inProgress = (locks || []).filter((l: any) => l.myAttempt && !l.myAttempt.is_solved).length;
  const dayLabel = day ? format(new Date(day.starts_at), 'MMM d') : 'Today';
  let contextLine = dayLabel;
  if (!myLock) contextLine += ' · Create your lock';
  else if (inProgress > 0) contextLine += ` · ${inProgress} in progress`;
  else if (totalLocks > 0) contextLine += ` · ${crackedCount}/${totalLocks} cracked`;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <div className="glass-card p-4 relative overflow-hidden border border-destructive/10">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.2), hsl(var(--destructive) / 0.05))' }}>
              <Lock className="w-5 h-5" style={{ color: 'hsl(var(--destructive))' }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-[15px] tracking-tight">DH Lockbox</h2>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-destructive/12 text-destructive">DAILY</span>
              </div>
              <p className="text-[11px] text-muted-foreground/70">{contextLine}</p>
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Shield className="w-3 h-3" />
              {myLock ? (myLock.is_cracked ? '💔 Cracked' : '🔒 Defending') : 'No lock'}
            </div>
            {totalLocks > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Swords className="w-3 h-3" />
                {crackedCount}/{totalLocks}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Link to="/lockbox" className="flex-1">
              <button className="w-full h-8 rounded-lg bg-muted/50 text-[11px] font-bold text-foreground/80 hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
                Open <ChevronRight className="w-3 h-3" />
              </button>
            </Link>
            {!myLock && (
              <Link to="/lockbox">
                <button className="h-8 px-3 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5" style={{ background: 'hsl(var(--destructive) / 0.15)', color: 'hsl(var(--destructive))' }}>
                  <Plus className="w-3 h-3" /> Create Lock
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Season header card ── */
function SeasonHeaderCard({ season }: { season: any }) {
  const statusLabels: Record<string, { label: string; cls: string }> = {
    upcoming: { label: 'Upcoming', cls: 'bg-muted text-muted-foreground' },
    regular_season: { label: 'Regular Season', cls: 'bg-success/10 text-success' },
    playoffs: { label: 'Playoffs', cls: 'bg-gold/10 text-gold' },
    complete: { label: 'Complete', cls: 'bg-primary/10 text-primary' },
  };
  const st = statusLabels[season.status] || statusLabels.upcoming;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="glass-card arena-edge p-5 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getSeasonEmoji(season.season_label)}</span>
              <div>
                <h2 className="font-extrabold text-lg tracking-tight">{getSeasonDisplayName(season.season_label, season.year)}</h2>
                <p className="text-[11px] text-muted-foreground/70">
                  {format(new Date(season.starts_at), 'MMM d')} — {format(new Date(season.ends_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            <span className={cn('status-pill', st.cls)}>{st.label}</span>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="text-center">
              <p className="text-sm font-bold">{season.regular_season_weeks}</p>
              <p className="text-[9px] text-muted-foreground/60">Reg Weeks</p>
            </div>
            <div className="w-px h-6 bg-border/20" />
            <div className="text-center">
              <p className="text-sm font-bold">Best {season.best_of}</p>
              <p className="text-[9px] text-muted-foreground/60">Count</p>
            </div>
            <div className="w-px h-6 bg-border/20" />
            <div className="text-center">
              <p className="text-sm font-bold">All 5</p>
              <p className="text-[9px] text-muted-foreground/60">Playoffs</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Standings table ── */
function StandingsCard({ standings, userId }: { standings: SeasonStanding[]; userId?: string }) {
  if (standings.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <Trophy className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No standings yet — complete a draft to get on the board.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-3 border-b border-border/20">
        <h3 className="font-bold text-[13px] flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
          Season Standings
        </h3>
      </div>
      <div className="divide-y divide-border/10">
        {standings.map((s, i) => {
          const isMe = s.user_id === userId;
          const rankEmoji = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : null;
          return (
            <div key={s.id} className={cn('flex items-center gap-3 px-4 py-3 transition-colors', isMe && 'bg-gold/5')}>
              <div className="w-6 text-center flex-shrink-0">
                {rankEmoji ? (
                  <span className="text-sm">{rankEmoji}</span>
                ) : (
                  <span className="text-[11px] font-bold text-muted-foreground">{s.rank || i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-[13px] font-bold truncate', isMe && 'text-gold')}>
                  {(s.profiles as any)?.display_name || 'Unknown'}
                  {isMe && <span className="text-[9px] ml-1 text-muted-foreground">(you)</span>}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-muted-foreground">{s.drafts_played} drafted</span>
                  <span className="text-[9px] text-muted-foreground">·</span>
                  <span className="text-[9px] text-muted-foreground">{s.wins}W</span>
                  {s.playoff_seed && (
                    <>
                      <span className="text-[9px] text-muted-foreground">·</span>
                      <span className="text-[9px] font-semibold text-success">🎯 Seed #{s.playoff_seed}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-extrabold" style={{ color: 'hsl(var(--gold))' }}>{s.season_points}</p>
                <p className="text-[8px] text-muted-foreground/60 uppercase font-bold">pts</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── This week's draft ── */
function ThisWeekDraft({ entries, seasonWeeks }: { entries: any[]; seasonWeeks: number }) {
  const currentWeek = entries.filter(e => !e.is_playoff).length + 1;
  const thisWeek = entries.find(e => e.week_number === currentWeek);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
        <h3 className="font-bold text-[13px]">{getWeekLabel(currentWeek, seasonWeeks)}</h3>
        <span className="text-[9px] text-muted-foreground/60 ml-auto">Week {Math.min(currentWeek, seasonWeeks)} of {seasonWeeks}</span>
      </div>
      {thisWeek ? (
        <Link to={`/drafts/${thisWeek.draft_id}`}>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
            <Bookmark className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold truncate">{thisWeek.drafts?.topic || 'Draft'}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{thisWeek.drafts?.status || 'unknown'}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          </div>
        </Link>
      ) : (
        <div className="text-center py-4">
          <p className="text-[11px] text-muted-foreground/70 mb-2">No draft assigned yet</p>
          <Link to="/drafts/create">
            <button className="h-8 px-4 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 mx-auto" style={{
              background: 'hsl(var(--gold) / 0.15)',
              color: 'hsl(var(--gold))',
            }}>
              <Plus className="w-3 h-3" /> Create This Week's Draft
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}

/* ── Playoff picture ── */
function PlayoffPicture({ standings, matches }: { standings: SeasonStanding[]; matches: any[] }) {
  const seeds = standings.filter(s => s.playoff_seed).sort((a, b) => (a.playoff_seed || 99) - (b.playoff_seed || 99));
  const getName = (seed: number) => {
    const s = seeds.find(s => s.playoff_seed === seed);
    return s ? (s.profiles as any)?.display_name || '?' : 'TBD';
  };

  if (seeds.length === 0 && matches.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-3">
          <Crown className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
          Playoff Picture
        </h3>
        <p className="text-[11px] text-muted-foreground/70 text-center py-4">Complete regular season drafts to determine playoff seeds.</p>
      </div>
    );
  }

  const roundLabels: Record<string, string> = {
    play_in: 'Play-In',
    semifinal: 'Semifinal',
    final: 'Championship',
    third_place: '3rd Place',
  };

  return (
    <div className="glass-card p-4">
      <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-3">
        <Crown className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
        Playoff Picture
      </h3>

      {matches.length > 0 ? (
        <div className="space-y-2">
          {matches.map(m => (
            <div key={m.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
              <span className="text-[10px] font-bold text-muted-foreground w-20 flex-shrink-0">{roundLabels[m.round] || m.round}</span>
              <div className="flex-1 flex items-center justify-center gap-3">
                <span className={cn('text-[11px] font-bold', m.winner_user_id === m.user_a ? 'text-gold' : '')}>#{m.seed_a}</span>
                <span className="text-[9px] text-muted-foreground">vs</span>
                <span className={cn('text-[11px] font-bold', m.winner_user_id === m.user_b ? 'text-gold' : '')}>#{m.seed_b}</span>
              </div>
              <span className={cn('status-pill text-[9px]', m.status === 'complete' ? 'bg-primary/10 text-primary' : m.status === 'in_progress' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                {m.status === 'complete' ? 'Done' : m.status === 'in_progress' ? 'Live' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* All 5 seeds */}
          <div className="space-y-1.5">
            {seeds.map(s => {
              const seed = s.playoff_seed!;
              const badge = seed === 1 ? '🏖️ BYE' : seed <= 3 ? '→ Semis' : '→ Play-In';
              const badgeCls = seed === 1 ? 'text-gold font-bold' : seed <= 3 ? 'text-success' : 'text-warning';
              return (
                <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
                  <span className="text-sm font-extrabold w-6 text-center" style={{ color: 'hsl(var(--gold))' }}>#{seed}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold truncate">{(s.profiles as any)?.display_name}</p>
                    <p className="text-[9px] text-muted-foreground">{s.season_points} pts</p>
                  </div>
                  <span className={cn('text-[9px] font-semibold', badgeCls)}>{badge}</span>
                </div>
              );
            })}
          </div>

          {/* Bracket preview */}
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/20">
            <p className="text-[10px] font-bold text-muted-foreground/80 mb-2">Playoff Bracket</p>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="font-bold text-warning">Play-In</span>
              <span className="text-muted-foreground">#{4} {getName(4)} vs #{5} {getName(5)}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="font-bold text-success">Semi 1</span>
              <span className="text-muted-foreground">#{1} {getName(1)} <span className="text-[8px]">(BYE)</span> vs Play-In winner</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="font-bold text-success">Semi 2</span>
              <span className="text-muted-foreground">#{2} {getName(2)} vs #{3} {getName(3)}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="font-bold" style={{ color: 'hsl(var(--gold))' }}>Final</span>
              <span className="text-muted-foreground">Semi winners → Championship</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="font-bold text-muted-foreground">3rd</span>
              <span className="text-muted-foreground">Semi losers → 3rd Place Match</span>
            </div>
          </div>

          <p className="text-[9px] text-muted-foreground/50 text-center">
            All 5 players qualify · #1 seed earns a first-round bye
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Season history ── */
function SeasonWeekHistory({ entries }: { entries: any[] }) {
  const regularEntries = entries.filter(e => !e.is_playoff);
  if (regularEntries.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-3 border-b border-border/20">
        <h3 className="font-bold text-[13px] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
          Season Schedule
        </h3>
      </div>
      <div className="divide-y divide-border/10">
        {regularEntries.map(e => (
          <Link key={e.id} to={`/drafts/${e.draft_id}`} className="block">
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/50 flex-shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">{e.week_number}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold truncate">{e.drafts?.topic || 'Draft'}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{e.drafts?.status || 'unknown'}</p>
              </div>
              <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Lifetime stats ── */
function LifetimeStatsCard({ userId }: { userId?: string }) {
  const { stats, loading } = useLifetimeStats(userId);

  if (loading || !stats) return null;

  const items = [
    { label: 'Seasons', value: stats.totalSeasons },
    { label: 'Wins', value: stats.totalWins },
    { label: 'Podiums', value: stats.totalPodiums },
    { label: 'Playoffs', value: stats.totalPlayoffs },
    { label: 'Championships', value: stats.totalChampionships, highlight: true },
    { label: 'Avg Finish', value: stats.avgSeasonFinish > 0 ? getOrdinalSuffix(Math.round(stats.avgSeasonFinish)) : '—' },
  ];

  return (
    <div className="glass-card p-4">
      <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-3">
        <Medal className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
        Lifetime Stats
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {items.map(item => (
          <div key={item.label} className="text-center">
            <p className={cn('text-lg font-extrabold leading-none', item.highlight && 'text-gold')}>{item.value}</p>
            <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Archived modules card ── */
function ArchivedModesCard() {
  const archived = [
    { path: '/brackets', label: 'Brackets', icon: Trophy, color: 'primary' },
    { path: '/rankings', label: 'Rankings', icon: BarChart3, color: 'accent' },
    { path: '/polls', label: 'Polls', icon: MessageCircle, color: 'warning' },
  ];

  return (
    <div className="glass-card p-4">
      <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-3">
        <Archive className="w-3.5 h-3.5 text-muted-foreground" />
        Other Modes
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {archived.map(mod => (
          <Link key={mod.path} to={mod.path}>
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <mod.icon className="w-4 h-4 text-muted-foreground/60" />
              <span className="text-[10px] font-bold text-muted-foreground/70">{mod.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── No season state ── */
function NoSeasonState() {
  const [activeDrafts, setActiveDrafts] = useState(0);

  useEffect(() => {
    supabase.from('drafts').select('*', { count: 'exact', head: true }).neq('status', 'complete').then(({ count }) => {
      setActiveDrafts(count || 0);
    });
  }, []);

  return (
    <div className="space-y-3">
      <div className="glass-card arena-edge p-6 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10" style={{
          background: 'linear-gradient(135deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.05))',
        }}>
          <Trophy className="w-7 h-7" style={{ color: 'hsl(var(--gold) / 0.6)' }} />
        </div>
        <h3 className="text-base font-extrabold relative z-10 mb-1">Draft League</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed relative z-10 mb-4">
          No season is active yet. Start a season to track standings, playoffs, and championships.
        </p>
        <div className="flex flex-wrap gap-2 justify-center relative z-10">
          <Link to="/drafts">
            <button className="flex items-center gap-2 font-bold rounded-xl px-4 py-2.5 text-[12px] btn-press" style={{
              background: 'hsl(var(--gold) / 0.15)',
              color: 'hsl(var(--gold))',
            }}>
              <Bookmark className="w-4 h-4" /> View Drafts
              {activeDrafts > 0 && <span className="text-[9px] opacity-70">({activeDrafts} active)</span>}
            </button>
          </Link>
          <Link to="/drafts/create">
            <button className="flex items-center gap-2 font-bold rounded-xl px-4 py-2.5 text-[12px] btn-press" style={{
              background: 'hsl(var(--surface-elevated))',
              border: '1px solid hsl(var(--border) / 0.5)',
            }}>
              <Plus className="w-4 h-4" /> New Draft
            </button>
          </Link>
        </div>
      </div>

      {/* Quick link to all drafts */}
      <Link to="/drafts">
        <div className="glass-card p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.04))',
          }}>
            <Bookmark className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-[14px]">All Drafts</h3>
            <p className="text-[11px] text-muted-foreground/70">View all drafts, stats, and results</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </div>
      </Link>
    </div>
  );
}

/* ══════════════════════════════════════════════════ */
export default function CompetePage() {
  const { user } = useAuth();
  const { season, loading: seasonLoading } = useCurrentSeason();
  const { standings, loading: standingsLoading } = useSeasonStandings(season?.id);
  const { entries, loading: entriesLoading } = useSeasonEntries(season?.id);
  const { matches } = usePlayoffMatches(season?.id);

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <div className="page-header-icon" style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.05))',
          }}>
            <Swords className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
          </div>
          <div>
            <h1 className="page-header-title">Compete</h1>
            <p className="page-header-subtitle">Draft League, Lockbox & more</p>
          </div>
        </div>

        <Tabs defaultValue="league" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="league" className="text-[11px] font-bold">🏆 League</TabsTrigger>
            <TabsTrigger value="lockbox" className="text-[11px] font-bold">🔒 Lockbox</TabsTrigger>
            <TabsTrigger value="more" className="text-[11px] font-bold">📦 More</TabsTrigger>
          </TabsList>

          <TabsContent value="league" className="space-y-3">
            {seasonLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="glass-card p-5">
                    <div className="h-4 rounded-lg w-1/3 mb-2.5 skeleton-shimmer" />
                    <div className="h-3 rounded-lg w-1/2 skeleton-shimmer" />
                  </div>
                ))}
              </div>
            ) : season ? (
              <>
                <SeasonHeaderCard season={season} />
                <ThisWeekDraft entries={entries} seasonWeeks={season.regular_season_weeks} />
                <StandingsCard standings={standings} userId={user?.id} />
                <PlayoffPicture standings={standings} matches={matches} />
                <SeasonWeekHistory entries={entries} />
                <LifetimeStatsCard userId={user?.id} />

                {/* Quick actions */}
                <div className="flex gap-2">
                  <Link to="/drafts" className="flex-1">
                    <button className="w-full h-9 rounded-lg bg-muted/50 text-[11px] font-bold text-foreground/80 transition-colors flex items-center justify-center gap-1.5">
                      All Drafts <ChevronRight className="w-3 h-3" />
                    </button>
                  </Link>
                  <Link to="/drafts/create">
                    <button className="h-9 px-4 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5" style={{
                      background: 'hsl(var(--gold) / 0.15)',
                      color: 'hsl(var(--gold))',
                    }}>
                      <Plus className="w-3 h-3" /> New Draft
                    </button>
                  </Link>
                </div>
              </>
            ) : (
              <NoSeasonState />
            )}
          </TabsContent>

          <TabsContent value="lockbox" className="space-y-3">
            <LockboxCompeteCard />
          </TabsContent>

          <TabsContent value="more" className="space-y-3">
            <ArchivedModesCard />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
