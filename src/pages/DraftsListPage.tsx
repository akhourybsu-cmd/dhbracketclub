import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Bookmark, Plus, ArrowRight, Users, Play, Trophy, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useDraftListUpdates } from '@/hooks/useRealtimeSubscription';

export default function DraftsListPage() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Map<string, number>>(new Map());
  const [draftWinners, setDraftWinners] = useState<Map<string, { user_id: string; display_name: string }>>(new Map());
  const [myDraftStats, setMyDraftStats] = useState({ totalPoints: 0, wins: 0, draftsRated: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('drafts')
        .select('*, competitions(title, status), profiles:created_by(display_name), current_pick_profiles:current_pick_user_id(display_name)')
        .order('created_at', { ascending: false });

      if (data) {
        const draftIds = data.map(d => d.id);

        if (draftIds.length > 0) {
          const [{ data: parts }, { data: picks }] = await Promise.all([
            supabase.from('draft_participants').select('draft_id').in('draft_id', draftIds),
            supabase.from('draft_picks').select('draft_id').in('draft_id', draftIds),
          ]);

          if (parts) {
            const counts = new Map<string, number>();
            parts.forEach(p => counts.set(p.draft_id, (counts.get(p.draft_id) || 0) + 1));
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
          setDrafts(updatedData);

          // Fetch draft results for winner badges and user stats
          if (draftIds.length > 0) {
            const { data: allResults } = await supabase
              .from('draft_results' as any)
              .select('draft_id, user_id, rank, points_awarded')
              .in('draft_id', draftIds);

            if (allResults) {
              const winners = new Map<string, { user_id: string; display_name: string }>();
              for (const r of allResults as any[]) {
                if (r.rank === 1) {
                  const part = parts?.find((p: any) => p.draft_id === r.draft_id);
                  // We'll get display name from participants data
                  winners.set(r.draft_id, { user_id: r.user_id, display_name: '' });
                }
              }
              // Get display names for winners
              const winnerIds = [...new Set([...winners.values()].map(w => w.user_id))];
              if (winnerIds.length > 0) {
                const { data: winnerProfiles } = await supabase.from('profiles').select('id, display_name').in('id', winnerIds);
                if (winnerProfiles) {
                  const profileMap = new Map(winnerProfiles.map(p => [p.id, p.display_name]));
                  for (const [draftId, winner] of winners) {
                    winner.display_name = profileMap.get(winner.user_id) || 'Unknown';
                  }
                }
              }
              setDraftWinners(winners);

              // My stats
              const myResults = (allResults as any[]).filter((r: any) => r.user_id === user?.id);
              setMyDraftStats({
                totalPoints: myResults.reduce((s: number, r: any) => s + (r.points_awarded || 0), 0),
                wins: myResults.filter((r: any) => r.rank === 1).length,
                draftsRated: myResults.length,
              });
            }
          }
        } else {
          setDrafts(data);
        }
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  // Realtime: refresh draft current_pick indicators when picks happen
  useDraftListUpdates(useCallback(() => {
    if (!user) return;
    supabase.from('drafts')
      .select('id, status, current_pick_user_id, current_pick_number, current_round, current_pick_profiles:current_pick_user_id(display_name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setDrafts(prev => prev.map(d => {
            const updated = data.find(u => u.id === d.id);
            if (updated) {
              return { ...d, status: updated.status, current_pick_user_id: updated.current_pick_user_id, current_pick_number: updated.current_pick_number, current_round: updated.current_round, current_pick_profiles: updated.current_pick_profiles };
            }
            return d;
          }));
        }
      });
  }, [user]));

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
        <Link to="/drafts/create">
          <Button size="sm" className="gap-1.5 rounded-lg font-bold btn-press">
            <Plus className="w-4 h-4" /> Create
          </Button>
        </Link>
      </div>

      {/* Cumulative Draft Stats */}
      {myDraftStats.draftsRated > 0 && (
        <div className="glass-card p-4 mb-4">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="text-lg font-extrabold leading-none">{myDraftStats.totalPoints}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">Total Pts</p>
            </div>
            <div className="w-px h-8 bg-border/30" />
            <div className="text-center">
              <p className="text-lg font-extrabold leading-none">{myDraftStats.wins}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">Wins</p>
            </div>
            <div className="w-px h-8 bg-border/30" />
            <div className="text-center">
              <p className="text-lg font-extrabold leading-none">{myDraftStats.draftsRated}</p>
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
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 + i * 0.04 }}>
                <Link to={`/drafts/${d.id}`} className="block group">
                  <div className="glass-card p-4 hover-lift cursor-pointer">
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                          background: 'linear-gradient(135deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.04))',
                        }}>
                          <Bookmark className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm truncate">{d.topic}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground/70 font-medium">
                              {d.num_rounds} rounds
                            </span>
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/15" />
                            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5 font-medium">
                              <Users className="w-2.5 h-2.5" /> {count}
                            </span>
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
                        <span className={cn("status-pill", sc.cls)}>
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
