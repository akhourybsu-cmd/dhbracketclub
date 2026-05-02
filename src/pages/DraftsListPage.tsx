import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Bookmark, Plus, ArrowRight, Users, Play, Trophy, Award, Target, Archive } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getDerivedDraftTurn } from '@/lib/draftTurn';
import { springSnap, useCountUp } from '@/lib/draft/animations';
import { formatDistanceToNow } from 'date-fns';
import { useDraftListUpdates } from '@/hooks/useRealtimeSubscription';
import { useCurrentSeason, useSeasonEntries, usePlayoffMatchByDraftIds } from '@/hooks/useDraftSeasons';
import { PlayoffBadge } from '@/components/draft/PlayoffBadge';
import { getPlayoffGameLabel } from '@/lib/playoffStyle';

export default function DraftsListPage() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Map<string, number>>(new Map());
  const [draftWinners, setDraftWinners] = useState<Map<string, { user_id: string; display_name: string }>>(new Map());
  const [myDraftStats, setMyDraftStats] = useState({ totalPoints: 0, wins: 0, draftsRated: 0, podiums: 0, bestFinish: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);
  const { season } = useCurrentSeason();
  const { entries: seasonEntries } = useSeasonEntries(season?.id);
  const seasonDraftIds = new Set(seasonEntries.map(e => e.draft_id));
  const playoffDraftIds = seasonEntries.filter(e => e.is_playoff).map(e => e.draft_id);
  const playoffMatchByDraft = usePlayoffMatchByDraftIds(playoffDraftIds);

  const fetchDrafts = useCallback(async () => {
    if (!user) return;
      const { data } = await supabase
        .from('drafts')
        .select('*, competitions(title, status), profiles:created_by(display_name), current_pick_profiles:current_pick_user_id(display_name)')
        .order('created_at', { ascending: false });

      if (data) {
        const draftIds = data.map(d => d.id);

        if (draftIds.length > 0) {
          const [{ data: parts }, { data: picks }] = await Promise.all([
            supabase.from('draft_participants').select('draft_id, user_id, pick_order, profiles:user_id(display_name)').in('draft_id', draftIds),
            supabase.from('draft_picks').select('draft_id').in('draft_id', draftIds),
          ]);

          const participantsByDraft = new Map<string, any[]>();
          if (parts) {
            const counts = new Map<string, number>();
            parts.forEach(p => {
              counts.set(p.draft_id, (counts.get(p.draft_id) || 0) + 1);
              const existing = participantsByDraft.get(p.draft_id) || [];
              existing.push(p);
              participantsByDraft.set(p.draft_id, existing);
            });
            setParticipantCounts(counts);
          }

          // Auto-fix drafts stuck in in_progress that are actually complete
          const pickCounts = new Map<string, number>();
          if (picks) picks.forEach(p => pickCounts.set(p.draft_id, (pickCounts.get(p.draft_id) || 0) + 1));

          const partCounts = new Map<string, number>();
          if (parts) parts.forEach(p => partCounts.set(p.draft_id, (partCounts.get(p.draft_id) || 0) + 1));

          const fixIds: string[] = [];
          const updatedData = data.map(d => {
            if (d.status === 'in_progress') {
              const numParts = partCounts.get(d.id) || 0;
              const numPicks = pickCounts.get(d.id) || 0;
              const totalExpected = numParts * d.num_rounds;
              if (numParts > 0 && numPicks >= totalExpected) {
                fixIds.push(d.id);
                return { ...d, status: 'complete' };
              }
            }
            return d;
          });

          for (const id of fixIds) {
            await supabase.from('drafts').update({ status: 'complete' }).eq('id', id);
          }
          setDrafts(updatedData.map(d => ({
            ...d,
            ...getDerivedDraftTurn(
              d,
              participantsByDraft.get(d.id) || [],
              pickCounts.get(d.id) || 0
            ),
          })));

          // Fetch draft results for winner badges and user stats
          if (draftIds.length > 0) {
            const { data: allResults } = await supabase
              .from('draft_results' as any)
              .select('draft_id, user_id, rank, points_awarded, total_score')
              .in('draft_id', draftIds);

            if (allResults) {
              const winners = new Map<string, { user_id: string; display_name: string }>();
              const winnerUserIds = new Set<string>();
              for (const r of allResults as any[]) {
                if (r.rank === 1) {
                  winners.set(r.draft_id, { user_id: r.user_id, display_name: '' });
                  winnerUserIds.add(r.user_id);
                }
              }
              // Get display names for winners
              if (winnerUserIds.size > 0) {
                const { data: winnerProfiles } = await supabase.from('profiles').select('id, display_name').in('id', [...winnerUserIds]);
                if (winnerProfiles) {
                  const profileMap = new Map(winnerProfiles.map(p => [p.id, p.display_name]));
                  for (const [, winner] of winners) {
                    winner.display_name = profileMap.get(winner.user_id) || 'Unknown';
                  }
                }
              }
              setDraftWinners(winners);

              // My stats
              const myResults = (allResults as any[]).filter((r: any) => r.user_id === user?.id);
              const podiums = myResults.filter((r: any) => r.rank <= 3).length;
              const bestFinish = myResults.length > 0 ? Math.min(...myResults.map((r: any) => r.rank)) : 0;
              const avgScore = myResults.length > 0 ? myResults.reduce((s: number, r: any) => s + (r.total_score || 0), 0) / myResults.length : 0;
              setMyDraftStats({
                totalPoints: myResults.reduce((s: number, r: any) => s + (r.points_awarded || 0), 0),
                wins: myResults.filter((r: any) => r.rank === 1).length,
                draftsRated: myResults.length,
                podiums,
                bestFinish,
                avgScore,
              });
            }
          }
        } else {
          setDrafts(data);
        }
      }
      setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  // Realtime: refresh draft current_pick indicators when picks happen
  useDraftListUpdates(fetchDrafts, !!user);

  const statusConfig: Record<string, { label: string; cls: string }> = {
    setup: { label: 'Setup', cls: 'bg-muted text-muted-foreground' },
    in_progress: { label: 'In Progress', cls: 'bg-success/10 text-success' },
    complete: { label: 'Complete', cls: 'bg-primary/10 text-primary' },
  };

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="page-header mb-0">
          <div className="page-header-icon" style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.05))',
            boxShadow: '0 0 12px hsl(var(--gold) / 0.15)',
          }}>
            <Bookmark className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
          </div>
          <div>
            <h1 className="page-header-title">Drafts</h1>
            <p className="page-header-subtitle">Snake drafts & picks</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link to="/drafts/seasons">
            <Button size="sm" variant="outline" className="gap-1.5 rounded-lg font-bold btn-press">
              <Archive className="w-3.5 h-3.5" /> Seasons
            </Button>
          </Link>
          <Link to="/drafts/create">
            <Button size="sm" className="gap-1.5 rounded-lg font-bold btn-press">
              <Plus className="w-4 h-4" /> Create
            </Button>
          </Link>
        </div>
      </div>

      {/* Cumulative Draft Stats */}
      {myDraftStats.draftsRated > 0 && (
        <div className="glass-card p-4 mb-4">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <p className="text-lg font-extrabold leading-none">{myDraftStats.totalPoints}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">Total Pts</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold leading-none">{myDraftStats.wins}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">Wins</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold leading-none">{myDraftStats.podiums}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">Podiums</p>
            </div>
          </div>
          <div className="border-t border-border/20 pt-2.5 flex items-center justify-around">
            <div className="text-center">
              <p className="text-sm font-bold leading-none">{myDraftStats.avgScore.toFixed(1)}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">Avg Score</p>
            </div>
            <div className="w-px h-6 bg-border/20" />
            <div className="text-center">
              <p className="text-sm font-bold leading-none">{myDraftStats.bestFinish > 0 ? `${myDraftStats.bestFinish}${myDraftStats.bestFinish === 1 ? 'st' : myDraftStats.bestFinish === 2 ? 'nd' : myDraftStats.bestFinish === 3 ? 'rd' : 'th'}` : '—'}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">Best Finish</p>
            </div>
            <div className="w-px h-6 bg-border/20" />
            <div className="text-center">
              <p className="text-sm font-bold leading-none">{myDraftStats.draftsRated}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">Rated</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map(i => (
            <div key={i} className="glass-card p-5">
              <div className="h-4 rounded-lg w-1/3 mb-2.5 skeleton-shimmer" />
              <div className="h-3 rounded-lg w-1/2 skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="empty-state">
          <div className="empty-state-icon" style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.12), hsl(var(--gold) / 0.04))',
          }}>
            <Bookmark className="w-7 h-7" style={{ color: 'hsl(var(--gold) / 0.6)' }} />
          </div>
          <p className="empty-state-title">No drafts yet</p>
          <p className="empty-state-desc mb-6">Run a snake draft on any topic with your crew.</p>
          <Link to="/drafts/create">
            <Button className="font-bold rounded-xl gap-2 btn-press">
              <Plus className="w-4 h-4" /> Create Draft
            </Button>
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {drafts.map((d, i) => {
            const count = participantCounts.get(d.id) || 0;
            const sc = statusConfig[d.status] || statusConfig.setup;
            const winner = draftWinners.get(d.id);
            const playoffMatch = playoffMatchByDraft.get(d.id);
            const isPlayoff = !!playoffMatch;
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 + i * 0.04 }}>
                <Link to={`/drafts/${d.id}`} className="block group">
                  <div
                    className={cn("glass-card p-4 hover-lift cursor-pointer relative overflow-hidden", isPlayoff && "arena-edge")}
                    style={isPlayoff ? {
                      borderLeft: '3px solid hsl(45 93% 52%)',
                      background: 'linear-gradient(135deg, hsl(45 93% 52% / 0.06), transparent 60%), hsl(var(--card))',
                      boxShadow: '0 0 18px -4px hsl(45 93% 52% / 0.25)',
                    } : undefined}
                  >
                    {isPlayoff && (
                      <div
                        className="absolute -right-2 -top-2 text-3xl opacity-10 select-none pointer-events-none"
                        aria-hidden
                      >
                        ✦
                      </div>
                    )}
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={isPlayoff ? {
                          background: 'linear-gradient(135deg, hsl(45 93% 52% / 0.28), hsl(38 92% 50% / 0.10))',
                          boxShadow: '0 0 10px hsl(45 93% 52% / 0.25)',
                        } : {
                          background: 'linear-gradient(135deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.04))',
                        }}>
                          {isPlayoff ? (
                            <Trophy className="w-5 h-5" style={{ color: 'hsl(45 93% 52%)' }} strokeWidth={2.5} />
                          ) : (
                            <Bookmark className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
                          )}
                        </div>
                        <div className="min-w-0">
                          {isPlayoff && (
                            <div className="mb-0.5">
                              <PlayoffBadge round={playoffMatch!.round} matchNumber={playoffMatch!.match_number} size="xs" />
                            </div>
                          )}
                          <h3 className="font-bold text-sm truncate">{d.topic}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {isPlayoff ? (
                              <span className="text-[10px] font-bold tracking-wide" style={{ color: 'hsl(45 93% 52%)' }}>
                                {getPlayoffGameLabel(playoffMatch!.round, playoffMatch!.match_number)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/70 font-medium">
                                {d.num_rounds} rounds
                              </span>
                            )}
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/15" />
                            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5 font-medium">
                              <Users className="w-2.5 h-2.5" /> {count}
                            </span>
                            {seasonDraftIds.has(d.id) && !isPlayoff && (
                              <>
                                <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/15" />
                                <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'hsl(var(--gold) / 0.12)', color: 'hsl(var(--gold))' }}>S</span>
                              </>
                            )}
                            {winner && (
                              <>
                                <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/15" />
                                <span className="text-[10px] flex items-center gap-0.5 font-semibold" style={{ color: 'hsl(var(--gold))' }}>
                                  <Trophy className="w-2.5 h-2.5" /> {winner.display_name}
                                </span>
                              </>
                            )}
                          </div>
                          {d.status === 'in_progress' && d.current_pick_user_id && (
                            <p className="text-[10px] font-semibold mt-0.5" style={{ color: d.current_pick_user_id === user?.id ? 'hsl(var(--gold))' : 'hsl(var(--success))' }}>
                              🎯 {d.current_pick_user_id === user?.id ? 'Your pick!' : `${(d as any).current_pick_profiles?.display_name || 'Someone'}'s pick`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={cn("status-pill", isPlayoff ? '' : sc.cls)}
                          style={isPlayoff ? {
                            background: 'hsl(45 93% 52% / 0.15)',
                            color: 'hsl(45 93% 52%)',
                            border: '1px solid hsl(45 93% 52% / 0.35)',
                          } : undefined}
                        >
                          {d.status === 'in_progress' && <Play className="w-2.5 h-2.5 mr-0.5" />}
                          {sc.label}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-all" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
