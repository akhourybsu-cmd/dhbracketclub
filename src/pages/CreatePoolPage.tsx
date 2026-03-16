import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function CreatePoolPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [tournamentId, setTournamentId] = useState('');

  useEffect(() => {
    supabase.from('tournaments').select('id').limit(1).single().then(({ data }) => {
      if (data) setTournamentId(data.id);
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tournamentId) return;
    setLoading(true);

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const lockTime = new Date();
    lockTime.setDate(lockTime.getDate() + 14); // 2 weeks from now

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

      // Add creator as admin member
      await supabase.from('pool_members').insert({
        pool_id: pool.id,
        user_id: user.id,
        role: 'admin',
      });

      // Add default scoring rules
      const scoringRules = [
        { pool_id: pool.id, round_number: 1, points_per_correct_pick: 1 },
        { pool_id: pool.id, round_number: 2, points_per_correct_pick: 2 },
        { pool_id: pool.id, round_number: 3, points_per_correct_pick: 4 },
        { pool_id: pool.id, round_number: 4, points_per_correct_pick: 8 },
        { pool_id: pool.id, round_number: 5, points_per_correct_pick: 16 },
        { pool_id: pool.id, round_number: 6, points_per_correct_pick: 32 },
      ];
      await supabase.from('scoring_rules').insert(scoringRules);

      toast.success('Pool created! Share code: ' + inviteCode);
      navigate(`/pools/${pool.id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-6">Create a Pool</h1>
      <form onSubmit={handleCreate} className="glass-card p-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Pool Name</label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Office Bracket Bash"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this pool about?"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading || !tournamentId}>
          {loading ? 'Creating...' : 'Create Pool'}
        </Button>
      </form>
    </div>
  );
}
