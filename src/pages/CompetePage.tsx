import { Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, BarChart3, MessageCircle, Bookmark, ChevronRight, Plus, Swords, Lock, Shield,
  Calendar, Award, TrendingUp, Users, Archive, Crown, Target, Flame, Medal, ChevronDown, X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  useIsCommissioner,
  useUnassignedDrafts,
  addDraftToSeason,
  removeDraftFromSeason,
  getSeasonDraftTarget,
  type SeasonStanding,
} from '@/hooks/useDraftSeasons';
import { getSeasonDisplayName, getOrdinalSuffix, getDraftLabel, getSeasonEmoji, getSeasonProgressText } from '@/lib/seasonUtils';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

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

/* ══════════════════════════════════════════════════════════
   SEASON HERO BANNER — draft-count based progress
   ══════════════════════════════════════════════════════════ */
function SeasonHeaderCard({ season, entries }: { season: any; entries: any[] }) {
  const statusLabels: Record<string, { label: string; cls: string; dotCls: string }> = {
    upcoming: { label: 'Upcoming', cls: 'bg-muted text-muted-foreground', dotCls: 'bg-muted-foreground' },
    regular_season: { label: 'Regular Season', cls: 'bg-success/15 text-success border border-success/20', dotCls: 'bg-success' },
    playoffs: { label: 'Playoffs', cls: 'bg-gold/15 text-gold border border-gold/20', dotCls: 'bg-gold' },
    complete: { label: 'Complete', cls: 'bg-primary/10 text-primary', dotCls: 'bg-primary' },
  };
  const st = statusLabels[season.status] || statusLabels.upcoming;
  const isActive = season.status === 'regular_season' || season.status === 'playoffs';

  // Draft-count based progress
  const totalDrafts = getSeasonDraftTarget(season);
  const completedDrafts = entries.filter(e => !e.is_playoff && e.drafts?.status === 'complete').length;
  const progressPct = totalDrafts > 0 ? Math.round((completedDrafts / totalDrafts) * 100) : 0;
  const progressText = getSeasonProgressText(completedDrafts, totalDrafts, season.status);

  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <div className="relative rounded-xl overflow-hidden">
        <div className="absolute inset-0 rounded-xl" style={{ background: 'var(--gradient-hero-gold)' }} />
        <div className="absolute inset-0 rounded-xl" style={{ background: 'var(--gradient-hero-gold-accent)' }} />
        <div className="glass-card p-0 relative overflow-hidden border-gold/10" style={{
          backgroundImage: 'var(--gradient-arena-edge-gold)',
          boxShadow: 'var(--shadow-gold)',
        }}>
          <div className="relative z-10 p-5 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{getSeasonEmoji(season.season_label)}</span>
                <div>
                  <h2 className="font-extrabold text-xl tracking-tight leading-tight">{getSeasonDisplayName(season.season_label, season.year)}</h2>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {format(new Date(season.starts_at), 'MMM d')} — {format(new Date(season.ends_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <span className={cn('status-pill flex items-center gap-1.5 text-[10px] px-2.5 py-1', st.cls)}>
                {isActive && (
                  <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', st.dotCls)} />
                )}
                {st.label}
              </span>
            </div>

            {/* Stats row — draft-count based */}
            <div className="flex items-center gap-0 mt-4 rounded-lg bg-muted/25 p-2.5">
              <div className="flex-1 text-center">
                <p className="text-sm font-extrabold tabular-nums">{totalDrafts}</p>
                <p className="text-[8px] text-muted-foreground/60 font-bold uppercase tracking-wider">Reg Drafts</p>
              </div>
              <div className="w-px h-7 bg-border/20" />
              <div className="flex-1 text-center">
                <p className="text-sm font-extrabold tabular-nums">Best {season.best_of}</p>
                <p className="text-[8px] text-muted-foreground/60 font-bold uppercase tracking-wider">Count</p>
              </div>
              <div className="w-px h-7 bg-border/20" />
              <div className="flex-1 text-center">
                <p className="text-sm font-extrabold tabular-nums">All 5</p>
                <p className="text-[8px] text-muted-foreground/60 font-bold uppercase tracking-wider">Playoffs</p>
              </div>
            </div>

            {/* Season progress bar — draft count */}
            {season.status !== 'complete' && (
              <div className="mt-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold text-muted-foreground/70">{progressText}</span>
                  <span className="text-[9px] font-bold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                    {season.status === 'playoffs' ? 'Playoffs' : `Draft ${completedDrafts} of ${totalDrafts}`}
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${season.status === 'playoffs' ? 100 : progressPct}%`,
                      background: season.status === 'playoffs'
                        ? 'linear-gradient(90deg, hsl(var(--gold) / 0.7), hsl(var(--gold)))'
                        : 'linear-gradient(90deg, hsl(var(--gold) / 0.7), hsl(var(--gold)))',
                      boxShadow: '0 0 8px hsl(var(--gold) / 0.3)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   NEXT DRAFT — elevated CTA (draft-count aware)
   ══════════════════════════════════════════════════════════ */
function NextDraftCard({ entries, totalDrafts }: { entries: any[]; totalDrafts: number }) {
  const regularEntries = entries.filter(e => !e.is_playoff);
  const completedCount = regularEntries.filter(e => e.drafts?.status === 'complete').length;
  const nextDraftNumber = completedCount + 1;
  const isRegularSeasonComplete = completedCount >= totalDrafts;

  // Find the latest non-complete entry (current draft)
  const currentEntry = regularEntries.find(e => e.drafts?.status !== 'complete');
  // Or show the latest entry if all complete
  const latestEntry = currentEntry || regularEntries[regularEntries.length - 1];
  const isLive = latestEntry?.drafts?.status === 'in_progress';

  const label = isRegularSeasonComplete
    ? 'Regular Season Complete'
    : getDraftLabel(nextDraftNumber, totalDrafts);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
      <div className={cn(
        "glass-card p-4 relative overflow-hidden",
        isLive && "border-success/20"
      )} style={{
        borderLeft: '3px solid hsl(var(--gold))',
      }}>
        <div className="flex items-center gap-2 mb-3">
          <Bookmark className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
          <h3 className="font-bold text-[13px]">{label}</h3>
          {isLive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/12 text-success text-[9px] font-bold border border-success/15">
              <span className="live-dot w-1.5 h-1.5" />
              LIVE
            </span>
          )}
          {!isRegularSeasonComplete && (
            <span className="text-[9px] text-muted-foreground/60 ml-auto tabular-nums">
              Draft {Math.min(nextDraftNumber, totalDrafts)} of {totalDrafts}
            </span>
          )}
        </div>
        {latestEntry && !isRegularSeasonComplete ? (
          latestEntry.drafts?.status !== 'complete' ? (
            <Link to={`/drafts/${latestEntry.draft_id}`}>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <Bookmark className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">{latestEntry.drafts?.topic || 'Draft'}</p>
                  <span className={cn(
                    'status-pill text-[9px] mt-1 inline-flex',
                    latestEntry.drafts?.status === 'in_progress' ? 'bg-success/12 text-success' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {latestEntry.drafts?.status === 'in_progress' ? 'In Progress' :
                     latestEntry.drafts?.status || 'Unknown'}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
              </div>
            </Link>
          ) : (
            <div className="text-center py-4">
              <p className="text-[11px] text-muted-foreground/70 mb-3">No draft assigned yet</p>
              <Link to="/drafts/create">
                <button className="w-full h-10 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2 btn-press" style={{
                  background: 'hsl(var(--gold) / 0.15)',
                  color: 'hsl(var(--gold))',
                  border: '1px solid hsl(var(--gold) / 0.15)',
                }}>
                  <Plus className="w-4 h-4" /> Create Draft {nextDraftNumber}
                </button>
              </Link>
            </div>
          )
        ) : isRegularSeasonComplete ? (
          <div className="text-center py-3">
            <p className="text-[12px] font-bold" style={{ color: 'hsl(var(--gold))' }}>
              🏆 All {totalDrafts} regular-season drafts complete
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Playoffs are unlocked!</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-[11px] text-muted-foreground/70 mb-3">No draft assigned yet</p>
            <Link to="/drafts/create">
              <button className="w-full h-10 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2 btn-press" style={{
                background: 'hsl(var(--gold) / 0.15)',
                color: 'hsl(var(--gold))',
                border: '1px solid hsl(var(--gold) / 0.15)',
              }}>
                <Plus className="w-4 h-4" /> Create Draft {nextDraftNumber}
              </button>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   STANDINGS TABLE — competitive energy with leader treatment
   ══════════════════════════════════════════════════════════ */
function StandingsCard({ standings, userId }: { standings: SeasonStanding[]; userId?: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (standings.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <Trophy className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No standings yet — complete a draft to get on the board.</p>
      </div>
    );
  }

  const leaderPts = standings[0]?.season_points || 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
      <div className="glass-card overflow-hidden" style={{ boxShadow: 'var(--shadow-elevated)' }}>
        <div className="p-3.5 border-b border-border/20">
          <h3 className="font-bold text-[13px] flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
            Season Standings
          </h3>
        </div>
        <div className="divide-y divide-border/10">
          {standings.map((s, i) => {
            const isMe = s.user_id === userId;
            const isExpanded = expanded === s.id;
            const rank = s.rank || i + 1;
            const isPodium = rank <= 3;
            const gap = rank === 1 ? null : leaderPts - s.season_points;

            const seedBg = s.playoff_seed === 1 ? 'hsl(var(--gold))' :
                           s.playoff_seed === 2 ? 'hsl(var(--silver))' :
                           s.playoff_seed === 3 ? 'hsl(var(--bronze))' :
                           'hsl(var(--muted-foreground))';

            return (
              <div key={s.id}>
                <div
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5 transition-colors cursor-pointer',
                    rank === 1 && 'relative',
                    isMe && !isPodium && 'border-l-2 border-l-gold/40',
                  )}
                  style={rank === 1 ? {
                    background: 'linear-gradient(90deg, hsl(var(--gold) / 0.08), transparent)',
                  } : undefined}
                  onClick={() => setExpanded(isExpanded ? null : s.id)}
                >
                  <div className="w-7 flex-shrink-0 flex items-center justify-center">
                    {isPodium ? (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold" style={{
                        background: `${seedBg}20`,
                        color: seedBg,
                        border: `1.5px solid ${seedBg}40`,
                      }}>
                        {rank}
                      </div>
                    ) : (
                      <span className="text-[12px] font-bold text-muted-foreground">{rank}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={cn('text-[13px] font-bold truncate', isMe && 'text-gold', rank === 1 && !isMe && 'text-foreground')}>
                        {(s.profiles as any)?.display_name || 'Unknown'}
                      </p>
                      {isMe && <span className="text-[8px] text-muted-foreground bg-gold/10 px-1 py-0.5 rounded font-bold">YOU</span>}
                      {rank === 1 && <Crown className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">{s.drafts_played} drafted</span>
                      <span className="text-[9px] text-muted-foreground">·</span>
                      <span className="text-[9px] text-muted-foreground">{s.wins}W {s.podiums}P</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{s.season_points}</p>
                    {gap !== null ? (
                      <p className="text-[8px] text-muted-foreground/50 tabular-nums font-bold">-{gap} pts</p>
                    ) : (
                      <p className="text-[8px] font-bold uppercase" style={{ color: 'hsl(var(--gold) / 0.6)' }}>Leader</p>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-0">
                    <div className="grid grid-cols-4 gap-px rounded-lg overflow-hidden bg-border/10">
                      {[
                        { v: s.avg_finish.toFixed(1), l: 'Avg Finish' },
                        { v: s.avg_score.toFixed(1), l: 'Avg Score' },
                        { v: s.best_score.toFixed(1), l: 'Best', cls: 'text-success' },
                        { v: s.worst_score.toFixed(1), l: 'Worst', cls: 'text-destructive' },
                      ].map(stat => (
                        <div key={stat.l} className="text-center bg-muted/30 p-2.5">
                          <p className={cn('text-[12px] font-bold tabular-nums', stat.cls)}>{stat.v}</p>
                          <p className="text-[7px] text-muted-foreground/60 font-bold uppercase tracking-wider">{stat.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   PLAYOFF BRACKET — visual bracket with connector lines
   ══════════════════════════════════════════════════════════ */
function PlayoffPicture({ standings, matches }: { standings: SeasonStanding[]; matches: any[] }) {
  const seeds = standings.filter(s => s.playoff_seed).sort((a, b) => (a.playoff_seed || 99) - (b.playoff_seed || 99));
  const getName = (seed: number) => {
    const s = seeds.find(s => s.playoff_seed === seed);
    return s ? (s.profiles as any)?.display_name || '?' : 'TBD';
  };

  if (seeds.length === 0 && matches.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <div className="glass-card p-4">
          <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-3">
            <Crown className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
            Playoff Picture
          </h3>
          <p className="text-[11px] text-muted-foreground/70 text-center py-4">Complete all 12 regular-season drafts to unlock playoffs.</p>
        </div>
      </motion.div>
    );
  }

  const roundLabels: Record<string, string> = {
    play_in: 'Play-In',
    semifinal: 'Semifinal',
    final: 'Championship',
    third_place: '3rd Place',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
      <div className="glass-card p-4">
        <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-4">
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
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 mb-3">
                {['Play-In', 'Semis', 'Finals'].map(r => (
                  <div key={r} className="text-center">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">{r}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="rounded-lg bg-muted/30 p-2.5 border border-border/10">
                  <p className="text-[10px] font-bold">#{4} <span className="text-muted-foreground font-normal">{getName(4)}</span></p>
                  <p className="text-[10px] font-bold mt-1">#{5} <span className="text-muted-foreground font-normal">{getName(5)}</span></p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2.5 border border-border/10 relative">
                  <p className="text-[10px] font-bold">#{1} <span className="text-muted-foreground font-normal">{getName(1)}</span></p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                      background: 'hsl(var(--gold) / 0.15)',
                      color: 'hsl(var(--gold))',
                    }}>BYE</span>
                  </div>
                  <div className="h-px bg-border/20 my-1.5" />
                  <p className="text-[9px] text-muted-foreground">vs Play-In ✦</p>
                </div>
                <div className="rounded-lg p-2.5 border border-gold/15 relative" style={{
                  background: 'hsl(var(--gold) / 0.05)',
                }}>
                  <div className="text-center">
                    <Trophy className="w-4 h-4 mx-auto mb-1" style={{ color: 'hsl(var(--gold) / 0.5)' }} />
                    <p className="text-[9px] font-bold" style={{ color: 'hsl(var(--gold))' }}>Championship</p>
                    <p className="text-[8px] text-muted-foreground mt-0.5">Semi winners</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 items-center">
                <div />
                <div className="rounded-lg bg-muted/30 p-2.5 border border-border/10">
                  <p className="text-[10px] font-bold">#{2} <span className="text-muted-foreground font-normal">{getName(2)}</span></p>
                  <div className="h-px bg-border/20 my-1.5" />
                  <p className="text-[10px] font-bold">#{3} <span className="text-muted-foreground font-normal">{getName(3)}</span></p>
                </div>
                <div className="rounded-lg bg-muted/20 p-2.5 border border-border/10">
                  <div className="text-center">
                    <Medal className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground/40" />
                    <p className="text-[9px] font-bold text-muted-foreground">3rd Place</p>
                    <p className="text-[8px] text-muted-foreground/60 mt-0.5">Semi losers</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[9px] text-muted-foreground/50 text-center pt-1">
              All 5 players qualify · #1 seed earns a first-round bye
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   COMMISSIONER PANEL — manage season-eligible drafts
   ══════════════════════════════════════════════════════════ */
function CommissionerPanel({ season, entries, onUpdate }: { season: any; entries: any[]; onUpdate: () => void }) {
  const { drafts: unassigned, loading, refetch: refetchUnassigned } = useUnassignedDrafts(season?.id);
  const [busy, setBusy] = useState<string | null>(null);

  const totalDrafts = getSeasonDraftTarget(season);
  const regularEntries = entries.filter(e => !e.is_playoff);
  const slotsFilled = regularEntries.length;
  const slotsRemaining = Math.max(0, totalDrafts - slotsFilled);

  const handleAdd = async (draftId: string) => {
    setBusy(draftId);
    try {
      const num = await addDraftToSeason(season.id, draftId);
      toast.success(`Added as Season Draft #${num}`);
      refetchUnassigned();
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add');
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (draftId: string) => {
    setBusy(draftId);
    try {
      await removeDraftFromSeason(draftId);
      toast.success('Removed from season');
      refetchUnassigned();
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove');
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
      <div className="glass-card overflow-hidden border" style={{ borderColor: 'hsl(var(--gold) / 0.2)' }}>
        <div className="p-3.5 border-b border-border/20 flex items-center justify-between" style={{ background: 'hsl(var(--gold) / 0.05)' }}>
          <h3 className="font-bold text-[13px] flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
            Commissioner
          </h3>
          <span className="text-[10px] font-bold tabular-nums" style={{ color: slotsRemaining > 0 ? 'hsl(var(--gold))' : 'hsl(var(--success))' }}>
            {slotsFilled} / {totalDrafts} slots filled
          </span>
        </div>

        {/* Unassigned drafts */}
        {unassigned.length > 0 && slotsRemaining > 0 && (
          <div className="p-3 border-b border-border/10">
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">Unassigned Drafts</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {unassigned.map(d => (
                <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <Bookmark className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--gold) / 0.5)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate">{d.topic}</p>
                    <span className={cn(
                      'text-[9px] font-semibold',
                      d.status === 'complete' ? 'text-primary' :
                      d.status === 'in_progress' ? 'text-success' :
                      'text-muted-foreground'
                    )}>{d.status}</span>
                  </div>
                  <button
                    onClick={() => handleAdd(d.id)}
                    disabled={busy === d.id}
                    className="px-2 py-1 rounded-md text-[9px] font-bold transition-colors flex items-center gap-1 btn-press"
                    style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))' }}
                  >
                    {busy === d.id ? '…' : <><Plus className="w-3 h-3" /> Add</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Currently assigned — allow removal */}
        {regularEntries.length > 0 && (
          <div className="p-3">
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">Season Drafts</p>
            <div className="space-y-1">
              {regularEntries.map(e => (
                <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                  <span className="text-[10px] font-bold text-muted-foreground w-5 text-center">#{e.week_number}</span>
                  <p className="text-[11px] font-semibold flex-1 truncate">{e.drafts?.topic || 'Draft'}</p>
                  <span className={cn(
                    'text-[9px] font-semibold',
                    e.drafts?.status === 'complete' ? 'text-primary' :
                    e.drafts?.status === 'in_progress' ? 'text-success' :
                    'text-muted-foreground'
                  )}>{e.drafts?.status || '?'}</span>
                  <button
                    onClick={() => handleRemove(e.draft_id)}
                    disabled={busy === e.draft_id}
                    className="p-1 rounded text-muted-foreground/40 hover:text-destructive transition-colors"
                    title="Remove from season"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {slotsRemaining === 0 && (
          <div className="p-3 text-center">
            <p className="text-[10px] font-bold" style={{ color: 'hsl(var(--success))' }}>✓ All {totalDrafts} season slots are filled</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   DRAFT HISTORY — collapsible with result indicators
   ══════════════════════════════════════════════════════════ */
function SeasonDraftHistory({ entries, totalDrafts }: { entries: any[]; totalDrafts: number }) {
  const regularEntries = entries.filter(e => !e.is_playoff);
  const [isOpen, setIsOpen] = useState(regularEntries.length <= 4);

  if (regularEntries.length === 0) return null;

  const displayEntries = isOpen ? regularEntries : regularEntries.slice(0, 3);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <div className="glass-card overflow-hidden bg-card/60">
        <div className="p-3 border-b border-border/20 flex items-center justify-between">
          <h3 className="font-bold text-[13px] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
            Draft History
          </h3>
          {regularEntries.length > 3 && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-0.5 hover:text-muted-foreground transition-colors"
            >
              {isOpen ? 'Collapse' : `Show all ${regularEntries.length}`}
              <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
            </button>
          )}
        </div>
        <div className="divide-y divide-border/10">
          {displayEntries.map((e, i) => {
            const isComplete = e.drafts?.status === 'complete';
            const isActive = e.drafts?.status === 'in_progress';
            return (
              <Link key={e.id} to={`/drafts/${e.draft_id}`} className="block">
                <div className={cn(
                  'flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors',
                  i % 2 === 1 && 'bg-muted/8',
                )}>
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    isComplete ? 'bg-success/12' : isActive ? 'bg-gold/12' : 'bg-muted/50',
                  )}>
                    {isComplete ? (
                      <span className="text-[10px]">✓</span>
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground">#{e.week_number}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold truncate">{e.drafts?.topic || 'Draft'}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-muted-foreground/50">Draft {e.week_number} of {totalDrafts}</span>
                      <span className="text-[9px] text-muted-foreground/30">·</span>
                      <span className={cn(
                        'text-[9px] font-semibold',
                        isComplete ? 'text-primary' : isActive ? 'text-success' : 'text-muted-foreground',
                      )}>
                        {isComplete ? 'Complete' : isActive ? 'In Progress' : e.drafts?.status || 'unknown'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   LIFETIME STATS — with championship highlight
   ══════════════════════════════════════════════════════════ */
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
      <div className="glass-card p-4 bg-card/60">
        <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-3">
          <Medal className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
          Lifetime Stats
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {items.map(item => (
            <div key={item.label} className={cn(
              'text-center rounded-lg p-2',
              item.highlight && 'ring-1 ring-gold/20',
            )} style={item.highlight ? { background: 'hsl(var(--gold) / 0.06)' } : undefined}>
              <p className={cn('text-lg font-extrabold leading-none tabular-nums', item.highlight && 'text-gold')}>{item.value}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
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

/* ══════════════════════════════════════════════════════════ */
export default function CompetePage() {
  const { user } = useAuth();
  const { season, loading: seasonLoading } = useCurrentSeason();
  const { standings, loading: standingsLoading, refetch: refetchStandings } = useSeasonStandings(season?.id);
  const { entries, loading: entriesLoading, refetch: refetchEntries } = useSeasonEntries(season?.id);
  const { matches } = usePlayoffMatches(season?.id);
  const isCommissioner = useIsCommissioner(season);

  const totalDrafts = season ? getSeasonDraftTarget(season) : 12;

  const handleSeasonUpdate = useCallback(() => {
    refetchEntries();
    refetchStandings();
  }, [refetchEntries, refetchStandings]);

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
                <SeasonHeaderCard season={season} entries={entries} />
                {isCommissioner && <CommissionerPanel season={season} entries={entries} onUpdate={handleSeasonUpdate} />}
                <NextDraftCard entries={entries} totalDrafts={totalDrafts} />
                <StandingsCard standings={standings} userId={user?.id} />
                <PlayoffPicture standings={standings} matches={matches} />
                <SeasonDraftHistory entries={entries} totalDrafts={totalDrafts} />
                <LifetimeStatsCard userId={user?.id} />

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                  <div className="glass-card p-3 bg-card/60 flex gap-2">
                    <Link to="/drafts" className="flex-1">
                      <button className="w-full h-9 rounded-lg bg-muted/50 text-[11px] font-bold text-foreground/80 transition-colors flex items-center justify-center gap-1.5 btn-press">
                        All Drafts <ChevronRight className="w-3 h-3" />
                      </button>
                    </Link>
                    <Link to="/drafts/create">
                      <button className="h-9 px-4 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 btn-press" style={{
                        background: 'hsl(var(--gold) / 0.15)',
                        color: 'hsl(var(--gold))',
                      }}>
                        <Plus className="w-3 h-3" /> New Draft
                      </button>
                    </Link>
                  </div>
                </motion.div>
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
