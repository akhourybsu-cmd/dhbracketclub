import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Bookmark, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CreateDraftPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [numRounds, setNumRounds] = useState(5);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Create competition
      const { data: comp, error: compErr } = await supabase
        .from('competitions')
        .insert({
          type: 'draft',
          title: topic.trim(),
          description: description.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (compErr) throw compErr;

      // Create draft — creator is first participant
      const { data: draft, error: draftErr } = await supabase
        .from('drafts')
        .insert({
          competition_id: comp.id,
          topic: topic.trim(),
          created_by: user.id,
          num_rounds: numRounds,
          status: 'setup',
        })
        .select()
        .single();
      if (draftErr) throw draftErr;

      // Add creator as first participant
      const { error: partErr } = await supabase.from('draft_participants').insert({
        draft_id: draft.id,
        user_id: user.id,
        pick_order: 1,
      });
      if (partErr) throw partErr;

      // Activity feed
      await supabase.from('activity_feed').insert({
        actor_user_id: user.id,
        event_type: 'draft_created',
        target_type: 'draft',
        target_id: draft.id,
        metadata: { topic: topic.trim() },
      });

      toast.success('Draft created!');
      navigate(`/drafts/${draft.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create draft');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Link to="/drafts" className="back-link">
        <ArrowLeft /> Back to Drafts
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <div className="page-header-icon" style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.05))',
          }}>
            <Bookmark className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
          </div>
          <div>
            <h1 className="page-header-title">Create Draft</h1>
            <p className="page-header-subtitle">Set up a snake draft for the crew</p>
          </div>
        </div>
      </motion.div>

      <motion.form onSubmit={handleCreate} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-5">
        <div className="glass-card p-5 space-y-4">
          <div>
            <label className="form-label">Topic</label>
            <Input
              required
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Best Fast Food Items"
              maxLength={100}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Description <span className="normal-case font-normal tracking-normal">(optional)</span></label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What are we drafting?"
              maxLength={200}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Rounds</label>
            <div className="flex gap-2">
              {[3, 5, 7, 10].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumRounds(n)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    numRounds === n
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground'
                  }`}
                  style={numRounds !== n ? { background: 'hsl(var(--surface-elevated))', border: '1px solid hsl(var(--border) / 0.3)' } : undefined}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full h-11 rounded-xl font-bold btn-press" disabled={loading || !topic.trim()}>
          {loading ? 'Creating…' : 'Create Draft'}
        </Button>
      </motion.form>
    </div>
  );
}
