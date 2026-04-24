import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ScrollText, Clock, Check, X, ArrowLeft } from 'lucide-react';

type ClubRequest = {
  id: string;
  proposed_name: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_notes: string | null;
  created_at: string;
};

export default function RequestClubPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [proposedName, setProposedName] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<ClubRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (supabase as any)
      .from('club_requests')
      .select('id, proposed_name, reason, status, review_notes, created_at')
      .eq('requested_by', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setExistingRequest(data);
        setLoading(false);
      });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!proposedName.trim()) {
      toast.error('Please enter a club name');
      return;
    }
    setSubmitting(true);
    const { data, error } = await (supabase as any)
      .from('club_requests')
      .insert({
        requested_by: user.id,
        proposed_name: proposedName.trim(),
        reason: reason.trim() || null,
      })
      .select()
      .maybeSingle();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setExistingRequest(data);
    toast.success('Request submitted! Alex will review it soon.');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner-ring" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md mx-auto"
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 btn-press"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.04))',
              border: '1px solid hsl(var(--primary) / 0.28)',
            }}
          >
            <ScrollText className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Start Your Own Club</h1>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
            Submit a request to spin up a private club for your friend group. Each club gets its own admin, members, and isolated data.
          </p>
        </div>

        {existingRequest && existingRequest.status === 'pending' && (
          <div
            className="glass-card p-4 mb-4 flex items-start gap-3"
            style={{ borderColor: 'hsl(var(--gold) / 0.3)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(var(--gold) / 0.14)' }}
            >
              <Clock className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">Request pending</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                "{existingRequest.proposed_name}" is awaiting review.
              </p>
            </div>
          </div>
        )}

        {existingRequest && existingRequest.status === 'approved' && (
          <div
            className="glass-card p-4 mb-4 flex items-start gap-3"
            style={{ borderColor: 'hsl(var(--primary) / 0.3)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(var(--primary) / 0.14)' }}
            >
              <Check className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">Approved!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your club is live. Head to the dashboard.
              </p>
            </div>
          </div>
        )}

        {existingRequest && existingRequest.status === 'rejected' && (
          <div
            className="glass-card p-4 mb-4 flex items-start gap-3"
            style={{ borderColor: 'hsl(var(--destructive) / 0.3)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(var(--destructive) / 0.14)' }}
            >
              <X className="w-4 h-4 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">Not approved</p>
              {existingRequest.review_notes && (
                <p className="text-xs text-muted-foreground mt-0.5">{existingRequest.review_notes}</p>
              )}
            </div>
          </div>
        )}

        {(!existingRequest || existingRequest.status === 'rejected') && (
          <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4">
            <div>
              <label className="form-label">Proposed Club Name</label>
              <Input
                required
                value={proposedName}
                onChange={(e) => setProposedName(e.target.value)}
                placeholder="e.g. Smith Family"
                maxLength={48}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Why this club? (optional)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly tell Alex who's joining and what you'll use it for."
                maxLength={500}
                rows={4}
                className="form-input resize-none"
              />
            </div>
            <Button type="submit" className="w-full h-11 font-bold rounded-xl btn-press" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
