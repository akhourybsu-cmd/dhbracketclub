import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { BarChart3, ArrowLeft, Send, Users, Trophy, ChevronDown, ChevronUp, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRankingUpdates } from '@/hooks/useRealtimeSubscription';

interface RankingItem {
  id: string;
  label: string;
  position: number;
}

export default function RankingDetailPage() {
  const { rankingId } = useParams<{ rankingId: string }>();
  const { user } = useAuth();
  const [ranking, setRanking] = useState<any>(null);
  const [items, setItems] = useState<RankingItem[]>([]);
  const [myOrder, setMyOrder] = useState<RankingItem[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [mySubmission, setMySubmission] = useState<any>(null);
  const [aggregated, setAggregated] = useState<{ item: RankingItem; avgRank: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const fetchData = useCallback(async () => {
    if (!rankingId || !user) return;

    const [{ data: rankData }, { data: itemData }] = await Promise.all([
      supabase.from('rankings').select('*, competitions(title, status), profiles:created_by(display_name)').eq('id', rankingId).single(),
      supabase.from('ranking_items').select('*').eq('ranking_id', rankingId).order('position'),
    ]);

    if (rankData) setRanking(rankData);
    if (itemData) {
      setItems(itemData);
      setMyOrder([...itemData]);
    }

    // Fetch all submissions with entries
    const { data: subs } = await supabase
      .from('ranking_submissions')
      .select('*, profiles:user_id(display_name)')
      .eq('ranking_id', rankingId);

    if (subs && subs.length > 0) {
      setSubmissions(subs);
      const mine = subs.find(s => s.user_id === user.id);
      if (mine) {
        setMySubmission(mine);
        setShowResults(true);
      }

      // Fetch all entries for these submissions
      const subIds = subs.map(s => s.id);
      const { data: entries } = await supabase
        .from('ranking_submission_entries')
        .select('*')
        .in('submission_id', subIds);

      if (entries && itemData) {
        // Calculate average rank per item
        const rankSums = new Map<string, { total: number; count: number }>();
        entries.forEach(e => {
          const existing = rankSums.get(e.item_id) || { total: 0, count: 0 };
          rankSums.set(e.item_id, { total: existing.total + e.rank, count: existing.count + 1 });
        });

        const agg = itemData.map(item => ({
          item,
          avgRank: rankSums.has(item.id) ? rankSums.get(item.id)!.total / rankSums.get(item.id)!.count : item.position + 1,
        })).sort((a, b) => a.avgRank - b.avgRank);

        setAggregated(agg);

        // If user has submitted, load their order
        if (mine) {
          const myEntries = entries.filter(e => e.submission_id === mine.id).sort((a, b) => a.rank - b.rank);
          const ordered = myEntries.map(e => itemData.find(i => i.id === e.item_id)).filter(Boolean) as RankingItem[];
          if (ordered.length > 0) setMyOrder(ordered);
        }
      }
    }

    setLoading(false);
  }, [rankingId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: auto-refresh when someone submits a ranking
  useRankingUpdates(rankingId, fetchData);

  const moveItem = (fromIdx: number, direction: 'up' | 'down') => {
    if (mySubmission) return; // Already submitted
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= myOrder.length) return;
    const newOrder = [...myOrder];
    [newOrder[fromIdx], newOrder[toIdx]] = [newOrder[toIdx], newOrder[fromIdx]];
    setMyOrder(newOrder);
  };

  const handleSubmit = async () => {
    if (!user || !rankingId || mySubmission) return;
    setSubmitting(true);
    try {
      const { data: sub, error: subErr } = await supabase
        .from('ranking_submissions')
        .insert({ ranking_id: rankingId, user_id: user.id })
        .select()
        .single();
      if (subErr) throw subErr;

      const entries = myOrder.map((item, i) => ({
        submission_id: sub.id,
        item_id: item.id,
        rank: i + 1,
      }));
      const { error: entErr } = await supabase.from('ranking_submission_entries').insert(entries);
      if (entErr) throw entErr;

      await supabase.from('activity_feed').insert({
        actor_user_id: user.id,
        event_type: 'ranking_submitted',
        target_type: 'ranking',
        target_id: rankingId,
        metadata: { topic: ranking?.topic },
      });

      toast.success('Ranking submitted! 🏆');
      setMySubmission(sub);
      setShowResults(true);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading ranking…</p>
      </div>
    );
  }

  if (!ranking) {
    return <div className="text-center py-16 text-muted-foreground font-medium text-sm">Ranking not found.</div>;
  }

  const isOpen = ranking.status === 'open';

  return (
    <div className="max-w-md mx-auto">
      <Link to="/rankings" className="back-link">
        <ArrowLeft /> Back to Rankings
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[1.4rem] font-extrabold tracking-tight leading-tight">{ranking.topic}</h1>
            <p className="text-[11px] text-muted-foreground/60 font-medium mt-1">
              by {ranking.profiles?.display_name} • {items.length} items
            </p>
          </div>
          <span className={cn("status-pill", isOpen ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
            {isOpen ? 'Open' : 'Closed'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="stat-card py-2 flex-1">
            <Users className="w-3 h-3 text-primary" />
            <span className="stat-value text-xs">{submissions.length}</span>
            <span className="stat-label">Ranked</span>
          </div>
          <div className="stat-card py-2 flex-1">
            <BarChart3 className="w-3 h-3" style={{ color: 'hsl(var(--accent))' }} />
            <span className="stat-value text-xs">{items.length}</span>
            <span className="stat-label">Items</span>
          </div>
        </div>
      </motion.div>

      {/* Tab toggle: My Ranking / Group Results */}
      {submissions.length > 0 && (
        <div className="flex gap-1.5 mb-5 p-1 bg-muted/30 rounded-xl">
          <button
            onClick={() => setShowResults(false)}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all",
              !showResults ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"
            )}
          >
            {mySubmission ? 'My Ranking' : 'Submit Ranking'}
          </button>
          <button
            onClick={() => setShowResults(true)}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all",
              showResults ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"
            )}
          >
            Group Results
          </button>
        </div>
      )}

      {/* ═══ My Ranking / Reorder ═══ */}
      {!showResults && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-card overflow-hidden mb-5">
            <div className="px-4 py-3 border-b border-border/10">
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                {mySubmission ? 'Your submitted ranking' : 'Drag to reorder, then submit'}
              </p>
            </div>
            <div className="divide-y divide-border/10">
              {myOrder.map((item, idx) => (
                <motion.div
                  key={item.id}
                  layout
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    !mySubmission && "active:bg-primary/5"
                  )}
                >
                  {/* Rank number */}
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold flex-shrink-0",
                    idx === 0 && "bg-gold/15 text-gold",
                    idx === 1 && "bg-silver/15 text-silver",
                    idx === 2 && "bg-bronze/15 text-bronze",
                    idx > 2 && "bg-muted/50 text-muted-foreground"
                  )}>
                    {idx + 1}
                  </div>

                  {/* Label */}
                  <span className="flex-1 text-[13px] font-semibold truncate">{item.label}</span>

                  {/* Reorder buttons */}
                  {!mySubmission && isOpen && (
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => moveItem(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveItem(idx, 'down')}
                        disabled={idx === myOrder.length - 1}
                        className="p-1 rounded text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {!mySubmission && isOpen && (
            <Button onClick={handleSubmit} disabled={submitting} className="w-full h-12 rounded-xl font-bold btn-press gap-2 text-[13px]">
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting…' : 'Submit My Ranking'}
            </Button>
          )}

          {mySubmission && (
            <div className="text-center py-3">
              <p className="text-[11px] text-success font-bold">✓ Submitted {new Date(mySubmission.submitted_at).toLocaleDateString()}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══ Group Results ═══ */}
      {showResults && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-card arena-edge overflow-hidden mb-5">
            <div className="px-4 py-3 border-b border-border/10 relative z-10">
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                Group consensus • {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y divide-border/10 relative z-10">
              {aggregated.map((entry, idx) => (
                <motion.div
                  key={entry.item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-extrabold flex-shrink-0",
                    idx === 0 && "bg-gold/15 text-gold",
                    idx === 1 && "bg-silver/15 text-silver",
                    idx === 2 && "bg-bronze/15 text-bronze",
                    idx > 2 && "bg-muted/50 text-muted-foreground"
                  )}>
                    {idx === 0 && <Trophy className="w-4 h-4" />}
                    {idx > 0 && (idx + 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      "text-[13px] font-semibold truncate block",
                      idx === 0 && "text-gold"
                    )}>{entry.item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/50 flex-shrink-0">
                    avg {entry.avgRank.toFixed(1)}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Individual submissions */}
          {submissions.length > 0 && (
            <>
              <div className="section-divider mb-3">
                <h3 className="section-header mb-0">Individual Rankings</h3>
              </div>
              <div className="space-y-3">
                {submissions.map((sub: any) => (
                  <div key={sub.id} className="glass-card p-4">
                    <p className="text-[12px] font-bold mb-2">{sub.profiles?.display_name || 'Unknown'}</p>
                    <p className="text-[10px] text-muted-foreground/50">
                      Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
