import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Bookmark, ArrowLeft, Users, Play, Send, Trophy, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Participant {
  id: string;
  user_id: string;
  pick_order: number;
  profiles?: { display_name: string };
}

interface Pick {
  id: string;
  user_id: string;
  pick_text: string;
  pick_number: number;
  round: number;
  profiles?: { display_name: string };
}

export default function DraftDetailPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const { user } = useAuth();
  const [draft, setDraft] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickText, setPickText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!draftId || !user) return;

    const [{ data: draftData }, { data: partData }, { data: pickData }] = await Promise.all([
      supabase.from('drafts').select('*, competitions(title, status), profiles:created_by(display_name)').eq('id', draftId).single(),
      supabase.from('draft_participants').select('*, profiles:user_id(display_name)').eq('draft_id', draftId).order('pick_order'),
      supabase.from('draft_picks').select('*, profiles:user_id(display_name)').eq('draft_id', draftId).order('pick_number'),
    ]);

    if (draftData) setDraft(draftData);
    if (partData) setParticipants(partData);
    if (pickData) setPicks(pickData);
    setLoading(false);
  }, [draftId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isCreator = draft?.created_by === user?.id;
  const isParticipant = participants.some(p => p.user_id === user?.id);

  // Snake draft order logic
  const getExpectedPicker = useCallback(() => {
    if (!draft || participants.length === 0) return null;
    const totalPicks = picks.length;
    const numParticipants = participants.length;
    if (numParticipants === 0) return null;

    const round = Math.floor(totalPicks / numParticipants);
    const posInRound = totalPicks % numParticipants;

    // Snake: even rounds go forward, odd rounds go backward
    const orderIdx = round % 2 === 0 ? posInRound : numParticipants - 1 - posInRound;
    const sorted = [...participants].sort((a, b) => a.pick_order - b.pick_order);
    return sorted[orderIdx] || null;
  }, [draft, participants, picks]);

  const currentPicker = getExpectedPicker();
  const isMyTurn = currentPicker?.user_id === user?.id;
  const currentRound = participants.length > 0 ? Math.floor(picks.length / participants.length) + 1 : 1;
  const isDraftComplete = draft?.status === 'complete' || (draft && currentRound > draft.num_rounds);
  const isInProgress = draft?.status === 'in_progress';
  const isSetup = draft?.status === 'setup';

  const handleStartDraft = async () => {
    if (!draftId || !isCreator) return;
    if (participants.length < 2) {
      toast.error('Need at least 2 participants');
      return;
    }
    setStarting(true);
    try {
      const sorted = [...participants].sort((a, b) => a.pick_order - b.pick_order);
      const { error } = await supabase.from('drafts').update({
        status: 'in_progress',
        current_round: 1,
        current_pick_number: 1,
        current_pick_user_id: sorted[0].user_id,
      }).eq('id', draftId);
      if (error) throw error;
      toast.success('Draft started! 🎉');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start');
    } finally {
      setStarting(false);
    }
  };

  const handleMakePick = async () => {
    if (!user || !draftId || !pickText.trim() || !isMyTurn) return;
    setSubmitting(true);
    try {
      const pickNumber = picks.length + 1;
      const { error } = await supabase.from('draft_picks').insert({
        draft_id: draftId,
        user_id: user.id,
        pick_text: pickText.trim(),
        pick_number: pickNumber,
        round: currentRound,
      });
      if (error) throw error;

      // Check if draft is complete after this pick
      const totalExpected = participants.length * draft.num_rounds;
      if (pickNumber >= totalExpected) {
        await supabase.from('drafts').update({ status: 'complete' }).eq('id', draftId);

        await supabase.from('activity_feed').insert({
          actor_user_id: user.id,
          event_type: 'draft_completed',
          target_type: 'draft',
          target_id: draftId,
          metadata: { topic: draft?.topic },
        });
      } else {
        // Update current pick info
        // Calculate next picker
        const nextTotal = pickNumber;
        const nextRound = Math.floor(nextTotal / participants.length);
        const nextPos = nextTotal % participants.length;
        const nextOrderIdx = nextRound % 2 === 0 ? nextPos : participants.length - 1 - nextPos;
        const sorted = [...participants].sort((a, b) => a.pick_order - b.pick_order);
        const nextPicker = sorted[nextOrderIdx];

        await supabase.from('drafts').update({
          current_pick_number: pickNumber + 1,
          current_round: nextRound + 1,
          current_pick_user_id: nextPicker?.user_id || null,
        }).eq('id', draftId);
      }

      setPickText('');
      toast.success('Pick made! 🔥');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to pick');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading draft…</p>
      </div>
    );
  }

  if (!draft) {
    return <div className="text-center py-16 text-muted-foreground font-medium text-sm">Draft not found.</div>;
  }

  // Group picks by user for results
  const picksByUser = new Map<string, Pick[]>();
  picks.forEach(p => {
    const list = picksByUser.get(p.user_id) || [];
    list.push(p);
    picksByUser.set(p.user_id, list);
  });

  return (
    <div className="max-w-md mx-auto">
      <Link to="/drafts" className="back-link">
        <ArrowLeft /> Back to Drafts
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[1.4rem] font-extrabold tracking-tight leading-tight">{draft.topic}</h1>
            <p className="text-[11px] text-muted-foreground/60 font-medium mt-1">
              by {draft.profiles?.display_name} • {draft.num_rounds} rounds
            </p>
          </div>
          <span className={cn(
            "status-pill flex-shrink-0",
            isSetup && 'bg-muted text-muted-foreground',
            isInProgress && 'bg-success/10 text-success',
            isDraftComplete && 'bg-primary/10 text-primary',
          )}>
            {isSetup ? 'Setup' : isInProgress && !isDraftComplete ? 'Live' : 'Complete'}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <div className="stat-card py-2 flex-1">
            <Users className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
            <span className="stat-value text-xs">{participants.length}</span>
            <span className="stat-label">Players</span>
          </div>
          <div className="stat-card py-2 flex-1">
            <Bookmark className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
            <span className="stat-value text-xs">{picks.length}</span>
            <span className="stat-label">Picks</span>
          </div>
          <div className="stat-card py-2 flex-1">
            <Trophy className="w-3 h-3 text-primary" />
            <span className="stat-value text-xs">{currentRound > draft.num_rounds ? draft.num_rounds : currentRound}</span>
            <span className="stat-label">Round</span>
          </div>
        </div>
      </motion.div>

      {/* ═══ Setup Phase ═══ */}
      {isSetup && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-card p-5 mb-5">
            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-3">Participants</p>
            <div className="space-y-2">
              {participants.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3 py-2">
                  <span className="text-[11px] font-extrabold text-muted-foreground/40 w-5 text-right font-mono">{idx + 1}</span>
                  <span className="text-[13px] font-semibold">{p.profiles?.display_name || 'Unknown'}</span>
                  {p.user_id === draft.created_by && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">Host</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/40 mt-3">Share this draft link to invite others. Snake order follows the list above.</p>
          </div>

          {isCreator && (
            <Button onClick={handleStartDraft} disabled={starting || participants.length < 2} className="w-full h-12 rounded-xl font-bold btn-press gap-2 text-[13px]">
              <Play className="w-4 h-4" />
              {starting ? 'Starting…' : 'Start Draft'}
            </Button>
          )}
        </motion.div>
      )}

      {/* ═══ Live Draft ═══ */}
      {isInProgress && !isDraftComplete && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {/* Current turn banner */}
          <div className={cn(
            "glass-card p-4 mb-5 text-center",
            isMyTurn && "arena-edge"
          )}>
            <div className="relative z-10">
              {isMyTurn ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'hsl(var(--gold))' }}>Your Turn</p>
                  <p className="text-[13px] font-bold">Round {currentRound} • Pick #{picks.length + 1}</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Waiting for</p>
                  <p className="text-[13px] font-bold">{currentPicker?.profiles?.display_name || 'Unknown'}</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">Round {currentRound} • Pick #{picks.length + 1}</p>
                </>
              )}
            </div>
          </div>

          {/* Pick input */}
          {isMyTurn && (
            <div className="flex gap-2 mb-5">
              <Input
                value={pickText}
                onChange={e => setPickText(e.target.value)}
                placeholder="Enter your pick…"
                maxLength={100}
                className="form-input flex-1"
                onKeyDown={e => e.key === 'Enter' && pickText.trim() && handleMakePick()}
              />
              <Button onClick={handleMakePick} disabled={submitting || !pickText.trim()} className="h-11 px-4 rounded-xl font-bold btn-press">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Pick history */}
          {picks.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/10">
                <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">Pick History</p>
              </div>
              <div className="divide-y divide-border/10 max-h-80 overflow-y-auto">
                {[...picks].reverse().map((pick, idx) => (
                  <motion.div
                    key={pick.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="flex items-center gap-3 px-4 py-2.5 relative z-10"
                  >
                    <span className="text-[10px] font-extrabold text-muted-foreground/30 w-6 text-right font-mono flex-shrink-0">
                      #{pick.pick_number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-[12px] font-semibold block truncate">{pick.pick_text}</span>
                      <span className="text-[10px] text-muted-foreground/40">{pick.profiles?.display_name} • Rd {pick.round}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══ Complete — Results ═══ */}
      {(isDraftComplete || draft.status === 'complete') && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Draft Complete 🎉</p>
          </div>

          <div className="space-y-3">
            {[...participants].sort((a, b) => a.pick_order - b.pick_order).map((p, idx) => {
              const userPicks = picksByUser.get(p.user_id) || [];
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border/10 flex items-center gap-2 relative z-10">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold",
                      idx === 0 && "bg-gold/15 text-gold",
                      idx === 1 && "bg-silver/15 text-silver",
                      idx === 2 && "bg-bronze/15 text-bronze",
                      idx > 2 && "bg-muted/50 text-muted-foreground",
                    )}>
                      {idx + 1}
                    </div>
                    <span className="text-[13px] font-bold">{p.profiles?.display_name || 'Unknown'}</span>
                    <span className="text-[10px] text-muted-foreground/40 ml-auto font-mono">{userPicks.length} picks</span>
                  </div>
                  <div className="px-4 py-2 relative z-10">
                    {userPicks.sort((a, b) => a.round - b.round).map(pick => (
                      <div key={pick.id} className="flex items-center gap-2 py-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground/30 w-8 flex-shrink-0">Rd {pick.round}</span>
                        <span className="text-[12px] font-medium">{pick.pick_text}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
