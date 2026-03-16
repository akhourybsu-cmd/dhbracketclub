import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Users, CheckCircle2, ArrowRight } from 'lucide-react';

export default function JoinPoolPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinedPool, setJoinedPool] = useState<{ id: string; name: string } | null>(null);

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

      if (poolError || !pool) throw new Error('Pool not found. Double-check your invite code.');

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

      setJoinedPool(pool);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (joinedPool) {
    return (
      <div className="max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-1">You're In!</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Welcome to <span className="font-semibold text-foreground">{joinedPool.name}</span>
          </p>
          <Button className="w-full gap-2" onClick={() => navigate(`/pools/${joinedPool.id}`)}>
            Go to Pool <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-2">Join a Pool</h1>
      <p className="text-sm text-muted-foreground mb-6">Enter the invite code shared by the pool creator.</p>
      <form onSubmit={handleJoin} className="glass-card p-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Invite Code</label>
          <Input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCDEF"
            className="uppercase tracking-[0.3em] text-center text-xl font-mono font-bold"
            maxLength={6}
          />
        </div>
        <Button type="submit" className="w-full gap-2" disabled={loading || code.length < 3}>
          {loading ? 'Joining...' : <><Users className="w-4 h-4" /> Join Pool</>}
        </Button>
      </form>
    </div>
  );
}
