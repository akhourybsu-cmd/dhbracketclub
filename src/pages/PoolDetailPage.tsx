import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Trophy, Edit3, Eye, Settings, Copy, Users, Clock, Activity, Trash2, SlidersHorizontal } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDeletePool = async () => {
    if (!poolId) return;
    setDeleting(true);
    try {
      const { data: brackets } = await supabase.from('brackets').select('id').eq('pool_id', poolId);
      if (brackets?.length) {
        const bracketIds = brackets.map(b => b.id);
        await supabase.from('bracket_picks').delete().in('bracket_id', bracketIds);
        await supabase.from('brackets').delete().eq('pool_id', poolId);
      }
      await supabase.from('standings').delete().eq('pool_id', poolId);
      await supabase.from('standings_snapshots').delete().eq('pool_id', poolId);
      await supabase.from('scoring_rules').delete().eq('pool_id', poolId);
      await supabase.from('admin_logs').delete().eq('pool_id', poolId);
      await supabase.from('pool_members').delete().eq('pool_id', poolId);
      const { error } = await supabase.from('pools').delete().eq('id', poolId);
      if (error) throw error;
      toast.success('Pool deleted');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete pool');
    } finally {
      setDeleting(false);
    }
  };

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
  const allowLateEntries = (pool as any)?.allow_late_entries === true;
  const canStillEdit = !isLocked || allowLateEntries;

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
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h left`;
    return 'Soon';
  }, [pool, isLocked]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading pool…</p>
      </div>
    );
  }

  if (!pool) {
    return <div className="text-center py-16 text-muted-foreground font-medium text-sm">Pool not found.</div>;
  }

  const statusCfg = STATUS_CONFIG[myStatus];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Pool Header */}
      <div className="mb-7 relative">
        <div className="absolute -inset-x-6 -top-10 -bottom-4 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -15%, hsl(var(--primary) / 0.05), transparent)',
        }} />
        <div className="flex items-start justify-between relative z-10">
          <div>
            <h1 className="text-[1.5rem] font-extrabold tracking-tight leading-none">{pool.name}</h1>
            <p className="text-[11px] text-muted-foreground/60 font-medium mt-1">
              {pool.tournaments?.name} {pool.tournaments?.season_year}
            </p>
          </div>
          <span className={cn(
            "status-pill",
            isLocked ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
          )}>
            {isLocked ? 'Locked' : 'Open'}
          </span>
        </div>
        {pool.description && <p className="text-[11px] text-muted-foreground/50 mt-2 leading-relaxed relative z-10">{pool.description}</p>}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-3 gap-2 mb-7">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="stat-card">
          <Users className="w-3.5 h-3.5 text-primary" />
          <p className="stat-value">{members.length}</p>
          <p className="stat-label">Members</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="stat-card">
          <Clock className="w-3.5 h-3.5" style={{ color: isLocked ? 'hsl(var(--destructive))' : 'hsl(var(--warning))' }} />
          <p className={cn("text-xs font-extrabold tabular-nums font-mono", isLocked ? "text-destructive" : "text-warning")}>{lockTimeDisplay}</p>
          <p className="stat-label">Deadline</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <button onClick={copyInvite} className="stat-card cursor-pointer w-full group">
            <Copy className="w-3.5 h-3.5 text-accent group-active:scale-90 transition-transform" />
            <p className="text-[10px] font-mono font-extrabold tracking-[0.2em] relative z-10">{pool.invite_code}</p>
            <p className="stat-label">Copy Code</p>
          </button>
        </motion.div>
      </div>

      {/* My Bracket Status — primary card */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card arena-edge p-5 mb-7"
      >
        <div className="flex items-center justify-between mb-3 relative z-10">
          <span className="section-header mb-0">My Bracket</span>
          <span className={cn("status-pill", statusCfg.className)}>{statusCfg.label}</span>
        </div>
        <div className="relative z-10">
          {myStatus === 'none' && !isLocked && (
            <Link to={`/pools/${poolId}/bracket/edit`}>
              <button className="w-full flex items-center justify-center gap-2 h-12 font-bold rounded-xl text-[13px] btn-premium btn-press">
                <Edit3 className="w-4 h-4" /> Start Your Bracket
              </button>
            </Link>
          )}
          {myStatus === 'draft' && (
            <>
              <p className="text-[11px] text-muted-foreground mb-2 font-medium">{myPicksCount}/{TOTAL_GAMES} picks made</p>
              <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, hsl(var(--warning)), hsl(var(--warning) / 0.5))' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(myPicksCount / TOTAL_GAMES) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <Link to={`/pools/${poolId}/bracket/edit`}>
                <button className="w-full flex items-center justify-center gap-2 h-12 font-bold rounded-xl text-[13px] btn-premium btn-press">
                  <Edit3 className="w-4 h-4" /> Continue Editing
                </button>
              </Link>
            </>
          )}
          {myStatus === 'submitted' && (
            <div className="flex gap-2 mt-1">
              <Link to={`/pools/${poolId}/bracket/edit`} className="flex-1">
                <Button variant="outline" className="w-full gap-2 h-11 font-bold rounded-xl btn-press text-[13px]"><Edit3 className="w-4 h-4" /> Edit</Button>
              </Link>
              <Link to={`/pools/${poolId}/bracket/${myBracket?.id}`} className="flex-1">
                <Button variant="outline" className="w-full gap-2 h-11 font-bold rounded-xl btn-press text-[13px]"><Eye className="w-4 h-4" /> View</Button>
              </Link>
            </div>
          )}
          {(myStatus === 'locked' || myStatus === 'incomplete') && myBracket && (
            <Link to={`/pools/${poolId}/bracket/${myBracket.id}`}>
              <Button variant="outline" className="w-full gap-2 h-11 font-bold rounded-xl mt-1 btn-press text-[13px]"><Eye className="w-4 h-4" /> View My Bracket</Button>
            </Link>
          )}
          {myStatus === 'none' && isLocked && (
            <p className="text-[11px] text-muted-foreground/60 mt-1">No bracket submitted before the deadline.</p>
          )}
        </div>
      </motion.div>

      {/* Quick Links — action tiles */}
      <div className={cn("grid gap-2.5 mb-7", isAdmin ? "grid-cols-4" : "grid-cols-2")}>
        {[
          { to: `/pools/${poolId}/leaderboard`, icon: Trophy, label: 'Leaderboard', color: 'gold' },
          { to: `/pools/${poolId}/games`, icon: Activity, label: 'Game Center', color: 'primary' },
          ...(isAdmin ? [
            { to: `/pools/${poolId}/settings`, icon: SlidersHorizontal, label: 'Settings', color: 'muted-foreground' },
            { to: `/pools/${poolId}/admin`, icon: Settings, label: 'Admin', color: 'muted-foreground' },
          ] : []),
        ].map((link, i) => (
          <motion.div key={link.to} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.04 }}>
            <Link to={link.to}>
              <div className="action-tile">
                <link.icon className="w-5 h-5 mx-auto mb-2 relative z-10" style={{ color: `hsl(var(--${link.color}))` }} />
                <p className="text-[11px] font-bold relative z-10">{link.label}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Members */}
      <div className="section-divider mb-2.5">
        <h2 className="section-header mb-0">Members</h2>
      </div>
      <div className="glass-card divide-y divide-border/10 overflow-hidden">
        {members.map((m: any, i: number) => {
          const mb = memberBrackets.get(m.user_id);
          const memberStatus = getBracketDisplayStatus(mb?.status || null, pool.lock_time, 0, TOTAL_GAMES);
          const msCfg = STATUS_CONFIG[memberStatus];
          const canViewBracket = isLocked && mb && (mb.status === 'submitted' || memberStatus === 'locked');

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.025 }}
              className="flex items-center justify-between px-4 py-3 relative z-10"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{
                  background: 'hsl(var(--surface-elevated))',
                  color: 'hsl(var(--foreground) / 0.6)',
                  border: '1px solid hsl(var(--border) / 0.2)',
                }}>
                  {(m.profiles?.display_name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold block truncate">{m.profiles?.display_name || 'Unknown'}</span>
                  {m.role === 'admin' && <span className="text-[8px] text-primary/60 font-bold uppercase tracking-[0.15em]">Admin</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={cn("status-pill", msCfg.className)}>{msCfg.label}</span>
                {canViewBracket && m.user_id !== user?.id && (
                  <Link to={`/pools/${poolId}/bracket/${mb.id}`} className="w-8 h-8 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 active:scale-95 transition-all" style={{
                    background: 'hsl(var(--surface-elevated))',
                    border: '1px solid hsl(var(--border) / 0.2)',
                  }}>
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  </Link>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Delete Pool (Admin only) */}
      {isAdmin && (
        <div className="mt-8 pt-5 border-t border-border/10">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2 text-destructive/60 border-destructive/15 hover:bg-destructive/8 font-bold rounded-xl text-[13px]">
                <Trash2 className="w-4 h-4" /> Delete Pool
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{pool.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the pool, all brackets, picks, and standings. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeletePool}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? 'Deleting…' : 'Delete Pool'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </motion.div>
  );
}
