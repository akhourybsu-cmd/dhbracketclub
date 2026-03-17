import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { MessageCircle, ArrowLeft, Users, Check, Clock, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { usePollVoteUpdates } from '@/hooks/useRealtimeSubscription';

interface PollOption {
  id: string;
  label: string;
  position: number;
}

export default function PollDetailPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { user } = useAuth();
  const [poll, setPoll] = useState<any>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!pollId || !user) return;

    const [{ data: pollData }, { data: optData }, { data: voteData }] = await Promise.all([
      supabase.from('polls').select('*, competitions(title, status), profiles:created_by(display_name)').eq('id', pollId).single(),
      supabase.from('poll_options').select('*').eq('poll_id', pollId).order('position'),
      supabase.from('poll_votes').select('*, profiles:user_id(display_name)').eq('poll_id', pollId),
    ]);

    if (pollData) setPoll(pollData);
    if (optData) setOptions(optData);
    if (voteData) {
      setVotes(voteData);
      const mine = voteData.find(v => v.user_id === user.id);
      if (mine) {
        setMyVote(mine.option_id);
        setSelectedOption(mine.option_id);
      }
    }
    setLoading(false);
  }, [pollId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: auto-refresh when anyone votes
  usePollVoteUpdates(pollId, fetchData);

  const handleVote = async () => {
    if (!user || !pollId || !selectedOption || myVote) return;
    setVoting(true);
    try {
      const { error } = await supabase.from('poll_votes').insert({
        poll_id: pollId,
        option_id: selectedOption,
        user_id: user.id,
      });
      if (error) throw error;

      await supabase.from('activity_feed').insert({
        actor_user_id: user.id,
        event_type: 'poll_voted',
        target_type: 'poll',
        target_id: pollId,
        metadata: { question: poll?.question },
      });

      toast.success('Vote cast! 🗳️');
      setMyVote(selectedOption);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to vote');
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading poll…</p>
      </div>
    );
  }

  if (!poll) {
    return <div className="text-center py-16 text-muted-foreground font-medium text-sm">Poll not found.</div>;
  }

  const totalVotes = votes.length;
  const isOpen = poll.status === 'open';
  const hasVoted = !!myVote;

  // Count votes per option
  const voteCounts = new Map<string, number>();
  votes.forEach(v => voteCounts.set(v.option_id, (voteCounts.get(v.option_id) || 0) + 1));

  // Find the winning option(s)
  const maxVotes = Math.max(...options.map(o => voteCounts.get(o.id) || 0), 0);

  return (
    <div className="max-w-md mx-auto">
      <Link to="/polls" className="back-link">
        <ArrowLeft /> Back to Polls
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.4rem] font-extrabold tracking-tight leading-tight">{poll.question}</h1>
            <p className="text-[11px] text-muted-foreground/60 font-medium mt-1">
              by {poll.profiles?.display_name} • {formatDistanceToNow(new Date(poll.created_at), { addSuffix: true })}
            </p>
          </div>
          <span className={cn("status-pill flex-shrink-0", isOpen ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
            {isOpen ? 'Open' : 'Closed'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="stat-card py-2 flex-1">
            <Users className="w-3 h-3" style={{ color: 'hsl(var(--warning))' }} />
            <span className="stat-value text-xs">{totalVotes}</span>
            <span className="stat-label">Votes</span>
          </div>
          <div className="stat-card py-2 flex-1">
            <MessageCircle className="w-3 h-3" style={{ color: 'hsl(var(--warning))' }} />
            <span className="stat-value text-xs">{options.length}</span>
            <span className="stat-label">Options</span>
          </div>
        </div>
      </motion.div>

      {/* Options / Results */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="space-y-2 mb-5">
          {options.map((opt, idx) => {
            const count = voteCounts.get(opt.id) || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isSelected = selectedOption === opt.id;
            const isMyVote = myVote === opt.id;
            const isWinner = hasVoted && count === maxVotes && maxVotes > 0;

            return (
              <motion.button
                key={opt.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + idx * 0.03 }}
                onClick={() => {
                  if (!hasVoted && isOpen) setSelectedOption(opt.id);
                }}
                disabled={hasVoted || !isOpen}
                className={cn(
                  "w-full text-left glass-card p-4 relative overflow-hidden transition-all duration-200",
                  !hasVoted && isOpen && "cursor-pointer hover:border-warning/30",
                  isSelected && !hasVoted && "ring-2 ring-warning/50 border-warning/30",
                  hasVoted && "cursor-default",
                )}
              >
                {/* Background fill for results */}
                {hasVoted && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.05 }}
                    className="absolute inset-y-0 left-0 z-0 rounded-2xl"
                    style={{
                      background: isWinner
                        ? 'linear-gradient(90deg, hsl(var(--warning) / 0.15), hsl(var(--warning) / 0.06))'
                        : 'hsl(var(--muted) / 0.4)',
                    }}
                  />
                )}

                <div className="flex items-center gap-3 relative z-10">
                  {/* Radio / check indicator */}
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all",
                    isMyVote ? "border-warning bg-warning" :
                    isSelected && !hasVoted ? "border-warning" :
                    "border-muted-foreground/20"
                  )}>
                    {isMyVote && <Check className="w-3 h-3 text-background" />}
                  </div>

                  <span className={cn(
                    "flex-1 text-[13px] font-semibold",
                    isWinner && "text-warning"
                  )}>
                    {opt.label}
                  </span>

                  {hasVoted && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn(
                        "text-[12px] font-extrabold tabular-nums font-mono",
                        isWinner ? "text-warning" : "text-muted-foreground"
                      )}>
                        {pct}%
                      </span>
                      <span className="text-[10px] text-muted-foreground/40 font-mono">
                        {count}
                      </span>
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Vote button */}
        {!hasVoted && isOpen && (
          <Button
            onClick={handleVote}
            disabled={voting || !selectedOption}
            className="w-full h-12 rounded-xl font-bold btn-press gap-2 text-[13px]"
            style={{
              background: selectedOption ? 'linear-gradient(135deg, hsl(var(--warning)), hsl(38 92% 42%))' : undefined,
            }}
          >
            {voting ? 'Casting…' : 'Cast Vote'}
          </Button>
        )}

        {hasVoted && (
          <div className="text-center py-3">
            <p className="text-[11px] font-bold" style={{ color: 'hsl(var(--warning))' }}>✓ You voted</p>
          </div>
        )}

        {/* Voters list */}
        {hasVoted && votes.length > 0 && (
          <div className="mt-6">
            <div className="section-divider mb-3">
              <h3 className="section-header mb-0">Voters</h3>
            </div>
            <div className="glass-card overflow-hidden">
              <div className="divide-y divide-border/10">
                {votes.map((v: any) => {
                  const optLabel = options.find(o => o.id === v.option_id)?.label;
                  return (
                    <div key={v.id} className="flex items-center justify-between px-4 py-2.5 relative z-10">
                      <span className="text-[12px] font-semibold">{v.profiles?.display_name || 'Unknown'}</span>
                      <span className="text-[10px] text-muted-foreground/50 font-medium truncate max-w-[40%] text-right">{optLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
