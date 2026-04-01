import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, ArrowLeft, Users, Play, Send, Trophy, RefreshCw, Sparkles, MoreVertical, Pencil, Trash2, X, Star, ChevronDown, ChevronUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraftUpdates } from '@/hooks/useRealtimeSubscription';
import { useItemEnrichments, useEnrichDraftPicks } from '@/hooks/useItemEnrichments';
import EnrichedItemCard, { EnrichedItemSkeleton } from '@/components/EnrichedItemCard';
import ShareButton from '@/components/ShareButton';
import ImagePickerDialog from '@/components/draft/ImagePickerDialog';
import { useDraftResults } from '@/hooks/useDraftResults';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const navigate = useNavigate();
  const [draft, setDraft] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickText, setPickText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [enrichingPickIds, setEnrichingPickIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTopic, setEditTopic] = useState('');
  const [saving, setSaving] = useState(false);
  const [imagePickerPick, setImagePickerPick] = useState<Pick | null>(null);
  const [expandedResultUser, setExpandedResultUser] = useState<string | null>(null);

  const { results: draftResults, loading: resultsLoading, generating: resultsGenerating, hasResults, generateResults } = useDraftResults(draftId);

  const [autoTriggered, setAutoTriggered] = useState(false);
  const pickIds = picks.map(p => p.id);
  const { enrichments, loading: enrichmentsLoading, fetchEnrichments } = useItemEnrichments(pickIds, 'draft_pick');
  const { enriching, enrichDraftPicks } = useEnrichDraftPicks();

  const fetchData = useCallback(async () => {
    if (!draftId || !user) return;

    const [{ data: draftData }, { data: partData }, { data: pickData }] = await Promise.all([
      supabase.from('drafts').select('*, competitions(title, status), profiles:created_by(display_name)').eq('id', draftId).single(),
      supabase.from('draft_participants').select('*, profiles:user_id(display_name)').eq('draft_id', draftId).order('pick_order'),
      supabase.from('draft_picks').select('*, profiles:user_id(display_name)').eq('draft_id', draftId).order('pick_number'),
    ]);

    if (draftData) {
      setDraft(draftData);
      setEditTopic(draftData.topic);
    }
    if (partData) setParticipants(partData);
    if (pickData) setPicks(pickData);
    setLoading(false);
  }, [draftId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (picks.length) fetchEnrichments(); }, [picks.length, fetchEnrichments]);

  // Realtime: auto-refresh on picks, participants, or draft status changes
  const { status: realtimeStatus } = useDraftUpdates(draftId, fetchData);

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

    const orderIdx = round % 2 === 0 ? posInRound : numParticipants - 1 - posInRound;
    const sorted = [...participants].sort((a, b) => a.pick_order - b.pick_order);
    return sorted[orderIdx] || null;
  }, [draft, participants, picks]);

  const currentPicker = getExpectedPicker();
  const isMyTurn = currentPicker?.user_id === user?.id;
  const currentRound = participants.length > 0 ? Math.floor(picks.length / participants.length) + 1 : 1;
  const isDraftComplete = draft?.status === 'complete' || (draft && participants.length > 0 && currentRound > draft.num_rounds);
  const isInProgress = draft?.status === 'in_progress';
  const isSetup = draft?.status === 'setup';
  const hasEnrichments = enrichments.size > 0;

  const handleStartDraft = async () => {
    if (!draftId || !isCreator) return;
    if (participants.length < 2) {
      toast.error('Need at least 2 participants');
      return;
    }
    setStarting(true);
    try {
      // Randomize participant order (Fisher-Yates shuffle)
      const shuffled = [...participants];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Update pick_order for each participant
      await Promise.all(
        shuffled.map((p, idx) =>
          supabase.from('draft_participants').update({ pick_order: idx + 1 }).eq('id', p.id)
        )
      );

      const { error } = await supabase.from('drafts').update({
        status: 'in_progress',
        current_round: 1,
        current_pick_number: 1,
        current_pick_user_id: shuffled[0].user_id,
      }).eq('id', draftId);
      if (error) throw error;
      toast.success('Draft started! Order randomized 🎲');
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
      const { data: newPick, error } = await supabase.from('draft_picks').insert({
        draft_id: draftId,
        user_id: user.id,
        pick_text: pickText.trim(),
        pick_number: pickNumber,
        round: currentRound,
      }).select().single();
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

      // Notify the next picker it's their turn
      const nextTotal2 = pickNumber;
      const nextRound2 = Math.floor(nextTotal2 / participants.length);
      const nextPos2 = nextTotal2 % participants.length;
      const nextOrderIdx2 = nextRound2 % 2 === 0 ? nextPos2 : participants.length - 1 - nextPos2;
      const sorted2 = [...participants].sort((a, b) => a.pick_order - b.pick_order);
      const nextPicker2 = sorted2[nextOrderIdx2];

      if (nextPicker2 && pickNumber < participants.length * draft.num_rounds) {
        supabase.functions.invoke('send-push-notification', {
          body: {
            type: 'draft',
            title: '🎯 Your Turn to Pick!',
            message: `It's your turn in "${draft.topic}" — Round ${nextRound2 + 1}`,
            url: `/drafts/${draftId}`,
            sender_user_id: user.id,
            target_user_id: nextPicker2.user_id,
          },
        }).catch(() => {});
      }

      fetchData();

      // Fire-and-forget enrichment for the new pick
      if (newPick?.id) {
        setEnrichingPickIds(prev => new Set(prev).add(newPick.id));
        enrichDraftPicks(draftId, [newPick.id]).then(() => {
          setEnrichingPickIds(prev => {
            const next = new Set(prev);
            next.delete(newPick.id);
            return next;
          });
          fetchEnrichments();
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to pick');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReEnrich = async () => {
    if (!draftId) return;
    const result = await enrichDraftPicks(draftId);
    if (result) {
      toast.success(`Enriched ${result.enriched_count} picks`);
      fetchEnrichments();
    }
  };

  const handleDelete = async () => {
    if (!draftId || !isCreator) return;
    setDeleting(true);
    try {
      const pIds = picks.map(p => p.id);
      if (pIds.length > 0) {
        await supabase.from('item_enrichments').delete().in('item_id', pIds);
      }
      await supabase.from('draft_picks').delete().eq('draft_id', draftId);
      await supabase.from('draft_participants').delete().eq('draft_id', draftId);
      const { error } = await supabase.from('drafts').delete().eq('id', draftId);
      if (error) throw error;
      if (draft?.competition_id) {
        await supabase.from('competitions').delete().eq('id', draft.competition_id);
      }
      toast.success('Draft deleted');
      navigate('/drafts');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!draftId || !editTopic.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('drafts').update({ topic: editTopic.trim() }).eq('id', draftId);
      if (error) throw error;
      if (draft?.competition_id) {
        await supabase.from('competitions').update({ title: editTopic.trim() }).eq('id', draft.competition_id);
      }
      toast.success('Draft updated');
      setEditing(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
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
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  className="form-input text-lg font-extrabold"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="shrink-0">
                  {saving ? '…' : 'Save'}
                </Button>
                <button onClick={() => { setEditing(false); setEditTopic(draft.topic); }} className="p-1.5 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h1 className="text-[1.4rem] font-extrabold tracking-tight leading-tight">{draft.topic}</h1>
            )}
            <p className="text-[11px] text-muted-foreground/60 font-medium mt-1">
              by {draft.profiles?.display_name} • {draft.num_rounds} rounds
              {draft.category && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                  <Sparkles className="w-2.5 h-2.5" />{draft.category}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <ShareButton contentType="draft" contentId={draftId!} title={draft.topic} />
            {isCreator && picks.length > 0 && (
              <button
                onClick={handleReEnrich}
                disabled={enriching}
                className="p-2 rounded-lg text-muted-foreground/60 hover:text-primary transition-colors disabled:opacity-40"
                title="Re-enrich picks"
              >
                <RefreshCw className={cn("w-4 h-4", enriching && "animate-spin")} />
              </button>
            )}
            <span className={cn(
              "status-pill flex-shrink-0",
              isSetup && 'bg-muted text-muted-foreground',
              isInProgress && 'bg-success/10 text-success',
              isDraftComplete && 'bg-primary/10 text-primary',
            )}>
              {isSetup ? 'Setup' : isInProgress && !isDraftComplete ? 'In Progress' : 'Complete'}
            </span>
            {isCreator && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Topic
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Draft
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
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

      {/* Enrichment loading state */}
      {enriching && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.15)' }}
        >
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-[11px] font-semibold text-primary">Enriching picks with AI…</span>
        </motion.div>
      )}

      {/* ═══ Setup Phase ═══ */}
      {isSetup && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-card p-5 mb-5">
            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-3">Participants</p>
            <div className="space-y-2">
              {participants.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3 py-2">
                  <span className="text-[11px] font-extrabold text-muted-foreground/60 w-5 text-right font-mono">{idx + 1}</span>
                  <span className="text-[13px] font-semibold">{p.profiles?.display_name || 'Unknown'}</span>
                  {p.user_id === draft.created_by && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">Host</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-3">Share this draft link to invite others. Order will be randomized when the draft starts.</p>
          </div>

          {!isParticipant && user && (
            <Button
              onClick={async () => {
                try {
                  const nextOrder = participants.length + 1;
                  const { error } = await supabase.from('draft_participants').insert({
                    draft_id: draftId!,
                    user_id: user.id,
                    pick_order: nextOrder,
                  });
                  if (error) throw error;
                  toast.success('Joined the draft!');
                  fetchData();
                } catch (err: any) {
                  toast.error(err.message || 'Failed to join');
                }
              }}
              className="w-full h-12 rounded-xl font-bold btn-press gap-2 text-[13px] mb-3"
              variant="outline"
            >
              <Users className="w-4 h-4" />
              Join Draft
            </Button>
          )}

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
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Round {currentRound} • Pick #{picks.length + 1}</p>
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

          {/* Pick history — enriched cards */}
          {picks.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/25">
                <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">Pick History</p>
              </div>
              <div className="divide-y divide-border/20 max-h-96 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {[...picks].reverse().map((pick) => {
                    const isEnriching = enrichingPickIds.has(pick.id);
                    const enrichment = enrichments.get(pick.id);

                    return (
                      <motion.div
                        key={pick.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        layout
                      >
                        {isEnriching && !enrichment ? (
                          <EnrichedItemSkeleton compact />
                        ) : (
                          <EnrichedItemCard
                            label={pick.pick_text}
                            rank={pick.pick_number}
                            enrichment={enrichment}
                            showRank
                            compact={!hasEnrichments}
                            onImageClick={enrichment && (enrichment.metadata?.image_candidates as any[])?.length > 0
                              ? () => setImagePickerPick(pick)
                              : undefined}
                            actions={
                              <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 text-right">
                                <span className="block font-medium">{pick.profiles?.display_name}</span>
                                <span className="font-mono">Rd {pick.round}</span>
                              </span>
                            }
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
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

          {/* AI Report Section */}
          {resultsGenerating ? (
            <div className="glass-card p-6 mb-5">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <p className="text-sm font-bold text-primary">Generating draft report…</p>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          ) : hasResults ? (
            <div className="mb-5">
              {/* Trophy Podium */}
              <div className="glass-card p-4 mb-4">
                <div className="flex items-center justify-center gap-1 mb-3">
                   <Trophy className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
                   <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Draft Rankings</p>
                </div>
                <div className="flex items-end justify-center gap-3">
                  {(() => {
                    const top3 = draftResults.slice(0, Math.min(3, draftResults.length));
                    const colors = ['hsl(var(--gold))', 'hsl(var(--silver))', 'hsl(var(--bronze))'];
                    const heights = ['h-24', 'h-20', 'h-16'];
                    const medals = ['🥇', '🥈', '🥉'];
                    // Visual order: 2nd, 1st, 3rd (podium style)
                    const visualOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
                    return visualOrder.map((r) => {
                      if (!r) return null;
                      const rIdx = r.rank - 1; // 0-based rank index for colors
                      const p = participants.find(pp => pp.user_id === r.user_id);
                      return (
                        <motion.div
                          key={r.user_id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: rIdx * 0.15 }}
                          className="flex flex-col items-center flex-1 max-w-[100px]"
                        >
                          <div className="text-[10px] font-bold mb-1 truncate w-full text-center">
                            {p?.profiles?.display_name || 'Unknown'}
                          </div>
                          <div
                            className={cn("w-full rounded-t-xl flex flex-col items-center justify-end pb-2", heights[rIdx] || 'h-16')}
                            style={{ background: `${colors[rIdx] || colors[2]}20`, borderBottom: `3px solid ${colors[rIdx] || colors[2]}` }}
                          >
                            <Award className="w-5 h-5 mb-0.5" style={{ color: colors[rIdx] || colors[2] }} />
                            <span className="text-lg font-extrabold" style={{ color: colors[rIdx] || colors[2] }}>
                              {medals[rIdx] || `#${r.rank}`}
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground">{Number(r.total_score).toFixed(1)}</span>
                            <span className="text-[9px] text-muted-foreground/60">+{r.points_awarded} pts</span>
                          </div>
                        </motion.div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Detailed Results */}
              <div className="space-y-3">
                {draftResults.map((result, idx) => {
                  const participant = participants.find(p => p.user_id === result.user_id);
                  const isExpanded = expandedResultUser === result.user_id;
                  const pickRatings = (result.pick_ratings || []) as { pick_id: string; pick_text: string; score: number; explanation: string }[];
                  const bestPick = pickRatings.length > 0 ? pickRatings.reduce((a, b) => a.score >= b.score ? a : b) : null;
                  const worstPick = pickRatings.length > 1 ? pickRatings.reduce((a, b) => a.score <= b.score ? a : b) : null;

                  return (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="glass-card overflow-hidden"
                    >
                      <button
                        className="w-full px-4 py-3 flex items-center gap-2 text-left"
                        onClick={() => setExpandedResultUser(isExpanded ? null : result.user_id)}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold flex-shrink-0",
                          idx === 0 && "bg-gold/15 text-gold",
                          idx === 1 && "bg-silver/15 text-silver",
                          idx === 2 && "bg-bronze/15 text-bronze",
                          idx > 2 && "bg-muted/50 text-muted-foreground",
                        )}>
                          {result.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[13px] font-bold block truncate">{participant?.profiles?.display_name || 'Unknown'}</span>
                          <span className="text-[10px] text-muted-foreground/60">
                            Score: {Number(result.total_score).toFixed(1)} • +{result.points_awarded} pts
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />}
                      </button>

                      {/* Best & Worst picks preview */}
                      {!isExpanded && bestPick && (
                        <div className="px-4 pb-3 flex flex-wrap gap-2 text-[10px]">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/10 text-success font-semibold">
                            <Star className="w-3 h-3" /> Best: {bestPick.pick_text} ({bestPick.score.toFixed(1)})
                          </span>
                          {worstPick && worstPick.pick_id !== bestPick.pick_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive font-semibold">
                              ↓ Worst: {worstPick.pick_text} ({worstPick.score.toFixed(1)})
                            </span>
                          )}
                        </div>
                      )}

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            {result.summary && (
                              <div className="px-4 py-2 border-t border-border/25">
                                <p className="text-[11px] text-muted-foreground italic">{result.summary}</p>
                              </div>
                            )}
                            <div className="divide-y divide-border/15 border-t border-border/25">
                              {pickRatings.map((pr) => (
                                <div key={pr.pick_id} className="px-4 py-2.5 flex items-start gap-3">
                                  <div className={cn(
                                    "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-extrabold",
                                    pr.score >= 8 && "bg-success/15 text-success",
                                    pr.score >= 6 && pr.score < 8 && "bg-primary/15 text-primary",
                                    pr.score >= 4 && pr.score < 6 && "bg-warning/15 text-warning",
                                    pr.score < 4 && "bg-destructive/15 text-destructive",
                                  )}>
                                    {pr.score.toFixed(1)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-semibold">{pr.pick_text}</p>
                                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{pr.explanation}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              {/* Regenerate button */}
              {isCreator && (
                <Button
                  onClick={generateResults}
                  variant="outline"
                  className="w-full mt-4 h-10 rounded-xl text-[12px] font-semibold gap-2"
                  disabled={resultsGenerating}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", resultsGenerating && "animate-spin")} />
                  Regenerate Report
                </Button>
              )}
            </div>
          ) : (
            <div className="glass-card p-5 mb-5 text-center">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-[13px] font-bold mb-1">Draft Report</p>
              <p className="text-[11px] text-muted-foreground/60 mb-3">Ratings for every pick — see who drafted best.</p>
              {isCreator ? (
                <Button onClick={generateResults} className="h-10 rounded-xl font-bold btn-press gap-2 text-[12px]" disabled={resultsGenerating}>
                  <Sparkles className="w-4 h-4" />
                  Generate Report
                </Button>
              ) : (
                <p className="text-[10px] text-muted-foreground/60">Waiting for the host to generate the report…</p>
              )}
            </div>
          )}

          {/* Original pick lists by participant */}
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
                  <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2 relative z-10">
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
                    <span className="text-[10px] text-muted-foreground/60 ml-auto font-mono">{userPicks.length} picks</span>
                  </div>
                  <div className="divide-y divide-border/15 relative z-10">
                    {userPicks.sort((a, b) => a.round - b.round).map(pick => {
                      const enrichment = enrichments.get(pick.id);
                      return (
                        <EnrichedItemCard
                          key={pick.id}
                          label={pick.pick_text}
                          rank={pick.round}
                          enrichment={enrichment}
                          showRank
                          compact={!hasEnrichments}
                          onImageClick={enrichment && (enrichment.metadata?.image_candidates as any[])?.length > 0
                            ? () => setImagePickerPick(pick)
                            : undefined}
                          actions={
                            <span className="text-[10px] font-mono text-muted-foreground/70 flex-shrink-0">
                              Rd {pick.round}
                            </span>
                          }
                        />
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the draft, all picks, participants, and enrichment data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image picker dialog */}
      {imagePickerPick && enrichments.get(imagePickerPick.id) && (
        <ImagePickerDialog
          open={!!imagePickerPick}
          onOpenChange={(open) => { if (!open) setImagePickerPick(null); }}
          pickName={imagePickerPick.pick_text}
          enrichment={enrichments.get(imagePickerPick.id)!}
          onImageSelected={() => {
            fetchEnrichments();
            setImagePickerPick(null);
          }}
        />
      )}
    </div>
  );
}
