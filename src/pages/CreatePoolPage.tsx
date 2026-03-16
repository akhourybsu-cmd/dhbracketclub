import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Copy, CheckCircle2, ArrowRight, Trophy } from 'lucide-react';

export default function CreatePoolPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [tournamentId, setTournamentId] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [createdPool, setCreatedPool] = useState<{ id: string; invite_code: string; name: string } | null>(null);

  useEffect(() => {
    supabase.from('tournaments').select('id, name, season_year').limit(1).single().then(({ data }) => {
      if (data) {
        setTournamentId(data.id);
        setTournamentName(`${data.name} ${data.season_year}`);
      }
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tournamentId) return;
    setLoading(true);

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const lockTime = new Date();
    lockTime.setDate(lockTime.getDate() + 14);

    try {
      const { data: pool, error } = await supabase
        .from('pools')
        .insert({
          name,
          description: description || null,
          owner_user_id: user.id,
          tournament_id: tournamentId,
          invite_code: inviteCode,
          lock_time: lockTime.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('pool_members').insert({
        pool_id: pool.id,
        user_id: user.id,
        role: 'admin',
      });

      const scoringRules = [
        { pool_id: pool.id, round_number: 1, points_per_correct_pick: 1 },
        { pool_id: pool.id, round_number: 2, points_per_correct_pick: 2 },
        { pool_id: pool.id, round_number: 3, points_per_correct_pick: 4 },
        { pool_id: pool.id, round_number: 4, points_per_correct_pick: 8 },
        { pool_id: pool.id, round_number: 5, points_per_correct_pick: 16 },
        { pool_id: pool.id, round_number: 6, points_per_correct_pick: 32 },
      ];
      await supabase.from('scoring_rules').insert(scoringRules);

      setCreatedPool({ id: pool.id, invite_code: inviteCode, name: pool.name });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (createdPool) {
      navigator.clipboard.writeText(createdPool.invite_code);
      toast.success('Copied!');
    }
  };

  if (createdPool) {
    return (
      <div className="max-w-md mx-auto px-1">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 sm:p-10 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
          >
            <CheckCircle2 className="w-14 h-14 text-success mx-auto mb-5" />
          </motion.div>
          <h1 className="text-2xl font-extrabold mb-1">Pool Created!</h1>
          <p className="text-sm text-muted-foreground mb-6">Share this code with your friends to join.</p>

          <div className="bg-surface rounded-xl p-5 mb-5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-semibold">Invite Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl sm:text-4xl font-mono font-extrabold tracking-[0.3em] text-primary">{createdPool.invite_code}</span>
              <button onClick={copyCode} className="p-2.5 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors btn-press">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-6">
            Picks lock in 14 days. You can change this in pool settings.
          </p>

          <Button className="w-full gap-2 h-11 rounded-xl font-bold btn-press" onClick={() => navigate(`/pools/${createdPool.id}`)}>
            Go to Pool <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-1">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Create a Pool</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Set up a bracket competition</p>
          </div>
        </div>
      </motion.div>

      <motion.form
        onSubmit={handleCreate}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card p-5 sm:p-6 space-y-5"
      >
        <div>
          <label className="form-label">Pool Name</label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Office Bracket Bash"
            maxLength={50}
            className="h-11 rounded-xl"
          />
        </div>
        <div>
          <label className="form-label">Description <span className="normal-case font-normal">(optional)</span></label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this pool about?"
            maxLength={200}
            className="h-11 rounded-xl"
          />
        </div>
        {tournamentName && (
          <div className="bg-surface rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 font-semibold">Tournament</p>
            <p className="text-sm font-semibold">{tournamentName}</p>
          </div>
        )}
        <Button type="submit" className="w-full h-11 rounded-xl font-bold btn-press" disabled={loading || !tournamentId}>
          {loading ? 'Creating…' : 'Create Pool'}
        </Button>
      </motion.form>
    </div>
  );
}
