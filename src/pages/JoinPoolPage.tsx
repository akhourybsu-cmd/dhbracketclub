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
      <div className="max-w-md mx-auto px-1">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 sm:p-10 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
          >
            <CheckCircle2 className="w-14 h-14 text-success mx-auto mb-5" />
          </motion.div>
          <h1 className="text-2xl font-extrabold mb-1">You're In!</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Welcome to <span className="font-semibold text-foreground">{joinedPool.name}</span>
          </p>
          <Button className="w-full gap-2 h-11 rounded-xl font-bold btn-press" onClick={() => navigate(`/pools/${joinedPool.id}`)}>
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
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
            <Users className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Join a Pool</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Enter the invite code from a friend</p>
          </div>
        </div>
      </motion.div>

      <motion.form
        onSubmit={handleJoin}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card p-5 sm:p-6 space-y-5"
      >
        <div>
          <label className="form-label">Invite Code</label>
          <Input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCDEF"
            className="uppercase tracking-[0.3em] text-center text-xl sm:text-2xl font-mono font-bold h-14 rounded-xl"
            maxLength={6}
          />
        </div>
        <Button type="submit" className="w-full gap-2 h-11 rounded-xl font-bold btn-press" disabled={loading || code.length < 3}>
          {loading ? 'Joining…' : <><Users className="w-4 h-4" /> Join Pool</>}
        </Button>
      </motion.form>
    </div>
  );
}
