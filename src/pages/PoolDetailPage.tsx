import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Trophy, Edit3, Eye, Settings, Copy, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function PoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const [pool, setPool] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [myBracket, setMyBracket] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!poolId || !user) return;

    const fetchPool = async () => {
      const { data: poolData } = await supabase
        .from('pools')
        .select('*, tournaments(name, season_year, status)')
        .eq('id', poolId)
        .single();

      if (poolData) setPool(poolData);

      const { data: memberData } = await supabase
        .from('pool_members')
        .select('*, profiles(display_name, avatar_url)')
        .eq('pool_id', poolId);

      if (memberData) {
        setMembers(memberData);
        const me = memberData.find((m: any) => m.user_id === user.id);
        if (me) setIsAdmin(me.role === 'admin');
      }

      const { data: bracket } = await supabase
        .from('brackets')
        .select('*')
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (bracket) setMyBracket(bracket);
      setLoading(false);
    };

    fetchPool();
  }, [poolId, user]);

  const isLocked = pool ? new Date(pool.lock_time) <= new Date() : false;

  const copyInvite = () => {
    if (pool) {
      navigator.clipboard.writeText(pool.invite_code);
      toast.success('Invite code copied!');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!pool) {
    return <div className="text-center py-12 text-muted-foreground">Pool not found.</div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Pool Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{pool.name}</h1>
            <p className="text-sm text-muted-foreground">
              {pool.tournaments?.name} {pool.tournaments?.season_year}
            </p>
          </div>
          <span className={`status-pill ${isLocked ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'}`}>
            {isLocked ? 'Locked' : 'Open'}
          </span>
        </div>
        {pool.description && (
          <p className="text-sm text-muted-foreground mt-2">{pool.description}</p>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass-card p-3 text-center">
          <Users className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold tabular-nums">{members.length}</p>
          <p className="text-[10px] text-muted-foreground">Members</p>
        </div>
        <div className="glass-card p-3 text-center">
          <Clock className="w-4 h-4 text-warning mx-auto mb-1" />
          <p className="text-xs font-medium">
            {isLocked ? 'Locked' : new Date(pool.lock_time).toLocaleDateString()}
          </p>
          <p className="text-[10px] text-muted-foreground">Lock Time</p>
        </div>
        <button onClick={copyInvite} className="glass-card p-3 text-center hover:bg-card/90 transition-colors">
          <Copy className="w-4 h-4 text-accent mx-auto mb-1" />
          <p className="text-xs font-mono font-bold">{pool.invite_code}</p>
          <p className="text-[10px] text-muted-foreground">Invite</p>
        </button>
      </div>

      {/* Actions */}
      <div className="space-y-3 mb-6">
        {!isLocked && !myBracket && (
          <Link to={`/pools/${poolId}/bracket/edit`}>
            <Button className="w-full gap-2">
              <Edit3 className="w-4 h-4" /> Fill Out Bracket
            </Button>
          </Link>
        )}
        {!isLocked && myBracket && myBracket.status === 'draft' && (
          <Link to={`/pools/${poolId}/bracket/edit`}>
            <Button className="w-full gap-2">
              <Edit3 className="w-4 h-4" /> Continue Editing Bracket
            </Button>
          </Link>
        )}
        {myBracket && (
          <Link to={`/pools/${poolId}/bracket/${myBracket.id}`}>
            <Button variant="outline" className="w-full gap-2">
              <Eye className="w-4 h-4" /> View My Bracket
            </Button>
          </Link>
        )}
        <Link to={`/pools/${poolId}/leaderboard`}>
          <Button variant="outline" className="w-full gap-2">
            <Trophy className="w-4 h-4" /> Leaderboard
          </Button>
        </Link>
        {isAdmin && (
          <Link to={`/pools/${poolId}/admin`}>
            <Button variant="secondary" className="w-full gap-2">
              <Settings className="w-4 h-4" /> Admin Tools
            </Button>
          </Link>
        )}
      </div>

      {/* Members List */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Members</h2>
      <div className="glass-card divide-y divide-border/50">
        {members.map((m: any) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {(m.profiles?.display_name || '?')[0].toUpperCase()}
              </div>
              <span className="text-sm font-medium">{m.profiles?.display_name || 'Unknown'}</span>
            </div>
            {m.role === 'admin' && (
              <span className="status-pill bg-primary/15 text-primary text-[10px]">Admin</span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
