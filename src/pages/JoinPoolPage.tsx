import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function JoinPoolPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .select('id, name')
        .eq('invite_code', code.toUpperCase().trim())
        .single();

      if (poolError || !pool) throw new Error('Pool not found. Check your invite code.');

      const { error: joinError } = await supabase
        .from('pool_members')
        .insert({ pool_id: pool.id, user_id: user.id, role: 'member' });

      if (joinError) {
        if (joinError.code === '23505') {
          toast.info("You're already in this pool!");
          navigate(`/pools/${pool.id}`);
          return;
        }
        throw joinError;
      }

      toast.success(`Joined "${pool.name}"!`);
      navigate(`/pools/${pool.id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-6">Join a Pool</h1>
      <form onSubmit={handleJoin} className="glass-card p-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Invite Code</label>
          <Input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter 6-character code"
            className="uppercase tracking-widest text-center text-lg font-mono"
            maxLength={6}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Joining...' : 'Join Pool'}
        </Button>
      </form>
    </div>
  );
}
