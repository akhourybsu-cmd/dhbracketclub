import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Trophy, Edit3, Eye, Settings, Copy, Users, Clock, GitCompare, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { getBracketDisplayStatus, STATUS_CONFIG, TOTAL_GAMES } from '@/lib/bracketUtils';

export default function PoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const [pool, setPool] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [myBracket, setMyBracket] = useState<any>(null);
  const [myPicksCount, setMyPicksCount] = useState(0);
  const [memberBrackets, setMemberBrackets] = useState<Map<string, any>>(new Map());
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
        .eq('pool_id', poolId)
        .order('joined_at');
      if (memberData) {
        setMembers(memberData);
        const me = memberData.find((m: any) => m.user_id === user.id);
        if (me) setIsAdmin(me.role === 'admin');
      }

      // Get all brackets for this pool
      const { data: brackets } = await supabase
        .from('brackets')
        .select('id, user_id, status, submitted_at')
        .eq('pool_id', poolId);
      if (brackets) {
        const bm = new Map<string, any>();
        brackets.forEach(b => bm.set(b.user_id, b));
        setMemberBrackets(bm);

        const mine = brackets.find(b => b.user_id === user.id);
        if (mine) {
          setMyBracket(mine);
          const { count } = await supabase
            .from('bracket_picks')
            .select('*', { count: 'exact', head: true })
            .eq('bracket_id', mine.id);
          setMyPicksCount(count || 0);
        }
      }

      setLoading(false);
    };
    fetchPool();
  }, [poolId, user]);

  const isLocked = pool ? new Date(pool.lock_time) <= new Date() : false;

  const myStatus = useMemo(() => {
    if (!pool) return 'none';
    return getBracketDisplayStatus(
      myBracket?.status || null,
      pool.lock_time,
      myPicksCount,
      TOTAL_GAMES
    );
  }, [myBracket, pool, myPicksCount]);

  const copyInvite = () => {
    if (pool) {
      navigator.clipboard.writeText(pool.invite_code);
      toast.success('Invite code copied!');
    }
  };

  const lockTimeDisplay = useMemo(() => {
    if (!pool) return '';
    const lt = new Date(pool.lock_time);
    if (isLocked) return 'Locked';
    const now = new Date();
    const diff = lt.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    return 'Closing soon';
  }, [pool, isLocked]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!pool) {
    return <div className="text-center py-12 text-muted-foreground">Pool not found.</div>;
  }

  const statusCfg = STATUS_CONFIG[myStatus];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Pool Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{pool.name}</h1>
            <p className="text-sm text-muted-foreground">{pool.tournaments?.name} {pool.tournaments?.season_year}</p>
          </div>
          <span className={`status-pill ${isLocked ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'}`}>
            {isLocked ? 'Locked' : 'Open'}
          </span>
        </div>
        {pool.description && <p className="text-sm text-muted-foreground mt-2">{pool.description}</p>}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="glass-card p-3 text-center">
          <Users className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold tabular-nums">{members.length}</p>
          <p className="text-[10px] text-muted-foreground">Members</p>
        </div>
        <div className="glass-card p-3 text-center">
          <Clock className="w-4 h-4 text-warning mx-auto mb-1" />
          <p className="text-xs font-semibold">{lockTimeDisplay}</p>
          <p className="text-[10px] text-muted-foreground">Lock Time</p>
        </div>
        <button onClick={copyInvite} className="glass-card p-3 text-center hover:bg-card/90 transition-colors">
          <Copy className="w-4 h-4 text-accent mx-auto mb-1" />
          <p className="text-xs font-mono font-bold">{pool.invite_code}</p>
          <p className="text-[10px] text-muted-foreground">Copy Code</p>
        </button>
      </div>

      {/* My Bracket Status */}
      <div className="glass-card p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Bracket</span>
          <span className={`status-pill ${statusCfg.className}`}>{statusCfg.label}</span>
        </div>
        {myStatus === 'none' && !isLocked && (
          <Link to={`/pools/${poolId}/bracket/edit`}>
            <Button className="w-full gap-2 mt-1"><Edit3 className="w-4 h-4" /> Start Your Bracket</Button>
          </Link>
        )}
        {myStatus === 'draft' && (
          <>
            <p className="text-xs text-muted-foreground mb-2">{myPicksCount}/{TOTAL_GAMES} picks made</p>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
              <div className="h-full bg-warning rounded-full" style={{ width: `${(myPicksCount / TOTAL_GAMES) * 100}%` }} />
            </div>
            <Link to={`/pools/${poolId}/bracket/edit`}>
              <Button className="w-full gap-2"><Edit3 className="w-4 h-4" /> Continue Editing</Button>
            </Link>
          </>
        )}
        {myStatus === 'submitted' && (
          <div className="flex gap-2 mt-1">
            <Link to={`/pools/${poolId}/bracket/edit`} className="flex-1">
              <Button variant="outline" className="w-full gap-2"><Edit3 className="w-4 h-4" /> Edit</Button>
            </Link>
            <Link to={`/pools/${poolId}/bracket/${myBracket?.id}`} className="flex-1">
              <Button variant="outline" className="w-full gap-2"><Eye className="w-4 h-4" /> View</Button>
            </Link>
          </div>
        )}
        {(myStatus === 'locked' || myStatus === 'incomplete') && myBracket && (
          <Link to={`/pools/${poolId}/bracket/${myBracket.id}`}>
            <Button variant="outline" className="w-full gap-2 mt-1"><Eye className="w-4 h-4" /> View My Bracket</Button>
          </Link>
        )}
        {myStatus === 'none' && isLocked && (
          <p className="text-xs text-muted-foreground mt-1">You didn't submit a bracket before the deadline.</p>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <Link to={`/pools/${poolId}/leaderboard`}>
          <div className="glass-card p-3 text-center hover:bg-card/90 transition-colors">
            <Trophy className="w-5 h-5 text-gold mx-auto mb-1" />
            <p className="text-xs font-semibold">Leaderboard</p>
          </div>
        </Link>
        {isAdmin && (
          <Link to={`/pools/${poolId}/admin`}>
            <div className="glass-card p-3 text-center hover:bg-card/90 transition-colors">
              <Settings className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs font-semibold">Admin Tools</p>
            </div>
          </Link>
        )}
      </div>

      {/* Members */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Members</h2>
      <div className="glass-card divide-y divide-border/30">
        {members.map((m: any) => {
          const mb = memberBrackets.get(m.user_id);
          const memberStatus = getBracketDisplayStatus(
            mb?.status || null,
            pool.lock_time,
            0, // We don't know their pick count
            TOTAL_GAMES
          );
          const msCfg = STATUS_CONFIG[memberStatus];
          const canViewBracket = isLocked && mb && (mb.status === 'submitted' || memberStatus === 'locked');

          return (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {(m.profiles?.display_name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium block truncate">{m.profiles?.display_name || 'Unknown'}</span>
                  {m.role === 'admin' && <span className="text-[10px] text-primary font-medium">Admin</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`status-pill text-[10px] ${msCfg.className}`}>{msCfg.label}</span>
                {canViewBracket && m.user_id !== user?.id && (
                  <Link to={`/pools/${poolId}/bracket/${mb.id}`}>
                    <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
