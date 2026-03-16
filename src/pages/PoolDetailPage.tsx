import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Trophy, Edit3, Eye, Settings, Copy, Users, Clock, ArrowRight, Activity } from 'lucide-react';
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
    return getBracketDisplayStatus(myBracket?.status || null, pool.lock_time, myPicksCount, TOTAL_GAMES);
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
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!pool) {
    return <div className="text-center py-16 text-muted-foreground font-medium">Pool not found.</div>;
  }

  const statusCfg = STATUS_CONFIG[myStatus];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
      {/* Pool Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">{pool.name}</h1>
            <p className="text-sm text-muted-foreground font-medium mt-0.5">
              {pool.tournaments?.name} {pool.tournaments?.season_year}
            </p>
          </div>
          <span className={cn(
            "status-pill",
            isLocked ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'
          )}>
            {isLocked ? 'Locked' : 'Open'}
          </span>
        </div>
        {pool.description && <p className="text-sm text-muted-foreground mt-2">{pool.description}</p>}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <div className="stat-card">
          <Users className="w-5 h-5 text-primary" />
          <p className="stat-value">{members.length}</p>
          <p className="stat-label">Members</p>
        </div>
        <div className="stat-card">
          <Clock className="w-5 h-5 text-warning" />
          <p className={cn("text-sm font-bold", isLocked ? "text-destructive" : "text-warning")}>{lockTimeDisplay}</p>
          <p className="stat-label">Lock Time</p>
        </div>
        <button onClick={copyInvite} className="stat-card hover-lift cursor-pointer">
          <Copy className="w-5 h-5 text-accent" />
          <p className="text-sm font-mono font-extrabold tracking-wider">{pool.invite_code}</p>
          <p className="stat-label">Copy Code</p>
        </button>
      </div>

      {/* My Bracket Status */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">My Bracket</span>
          <span className={cn("status-pill", statusCfg.className)}>{statusCfg.label}</span>
        </div>
        {myStatus === 'none' && !isLocked && (
          <Link to={`/pools/${poolId}/bracket/edit`}>
            <Button className="w-full gap-2 h-11 font-bold rounded-xl"><Edit3 className="w-4 h-4" /> Start Your Bracket</Button>
          </Link>
        )}
        {myStatus === 'draft' && (
          <>
            <p className="text-sm text-muted-foreground mb-2 font-medium">{myPicksCount}/{TOTAL_GAMES} picks made</p>
            <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
              <div className="h-full bg-warning rounded-full transition-all" style={{ width: `${(myPicksCount / TOTAL_GAMES) * 100}%` }} />
            </div>
            <Link to={`/pools/${poolId}/bracket/edit`}>
              <Button className="w-full gap-2 h-11 font-bold rounded-xl"><Edit3 className="w-4 h-4" /> Continue Editing</Button>
            </Link>
          </>
        )}
        {myStatus === 'submitted' && (
          <div className="flex gap-2 mt-1">
            <Link to={`/pools/${poolId}/bracket/edit`} className="flex-1">
              <Button variant="outline" className="w-full gap-2 h-10 font-bold rounded-xl"><Edit3 className="w-4 h-4" /> Edit</Button>
            </Link>
            <Link to={`/pools/${poolId}/bracket/${myBracket?.id}`} className="flex-1">
              <Button variant="outline" className="w-full gap-2 h-10 font-bold rounded-xl"><Eye className="w-4 h-4" /> View</Button>
            </Link>
          </div>
        )}
        {(myStatus === 'locked' || myStatus === 'incomplete') && myBracket && (
          <Link to={`/pools/${poolId}/bracket/${myBracket.id}`}>
            <Button variant="outline" className="w-full gap-2 h-10 font-bold rounded-xl mt-1"><Eye className="w-4 h-4" /> View My Bracket</Button>
          </Link>
        )}
        {myStatus === 'none' && isLocked && (
          <p className="text-xs text-muted-foreground mt-1 font-medium">You didn't submit a bracket before the deadline.</p>
        )}
      </div>

      {/* Quick Links */}
      <div className={cn("grid gap-2.5 mb-6", isAdmin ? "grid-cols-3" : "grid-cols-2")}>
        <Link to={`/pools/${poolId}/leaderboard`}>
          <div className="glass-card p-4 text-center hover-lift cursor-pointer">
            <Trophy className="w-6 h-6 text-gold mx-auto mb-2" />
            <p className="text-sm font-bold">Leaderboard</p>
          </div>
        </Link>
        <Link to={`/pools/${poolId}/games`}>
          <div className="glass-card p-4 text-center hover-lift cursor-pointer">
            <Activity className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-bold">Game Center</p>
          </div>
        </Link>
        {isAdmin && (
          <Link to={`/pools/${poolId}/admin`}>
            <div className="glass-card p-4 text-center hover-lift cursor-pointer">
              <Settings className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-bold">Admin Tools</p>
            </div>
          </Link>
        )}
      </div>

      {/* Members */}
      <h2 className="section-header">Members</h2>
      <div className="glass-card divide-y divide-border/30 overflow-hidden">
        {members.map((m: any) => {
          const mb = memberBrackets.get(m.user_id);
          const memberStatus = getBracketDisplayStatus(mb?.status || null, pool.lock_time, 0, TOTAL_GAMES);
          const msCfg = STATUS_CONFIG[memberStatus];
          const canViewBracket = isLocked && mb && (mb.status === 'submitted' || memberStatus === 'locked');

          return (
            <div key={m.id} className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-extrabold text-primary flex-shrink-0">
                  {(m.profiles?.display_name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-semibold block truncate">{m.profiles?.display_name || 'Unknown'}</span>
                  {m.role === 'admin' && <span className="text-[10px] text-primary font-bold">Admin</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={cn("status-pill", msCfg.className)}>{msCfg.label}</span>
                {canViewBracket && m.user_id !== user?.id && (
                  <Link to={`/pools/${poolId}/bracket/${mb.id}`}>
                    <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
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
