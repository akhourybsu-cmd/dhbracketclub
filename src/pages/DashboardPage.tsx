import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Users, ArrowRight, Trophy, BarChart3, Shield, Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBracketDisplayStatus, STATUS_CONFIG, TOTAL_GAMES } from '@/lib/bracketUtils';
import { cn } from '@/lib/utils';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import dhMonogram from '@/assets/dh-monogram.png';

export default function DashboardPage() {
  const { user } = useAuth();
  const { canInstall, install } = usePwaInstall();
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [bracketStatuses, setBracketStatuses] = useState<Map<string, string>>(new Map());
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());
  const [dismissedInstall, setDismissedInstall] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single();
      if (profile) setDisplayName(profile.display_name);

      const { data: memberships } = await supabase.from('pool_members').select('pool_id').eq('user_id', user.id);
      if (memberships && memberships.length > 0) {
        const poolIds = memberships.map(m => m.pool_id);
        const { data: poolData } = await supabase
          .from('pools')
          .select('id, name, invite_code, lock_time, tournaments(name, season_year)')
          .in('id', poolIds);
        if (poolData) setPools(poolData);

        const { data: brackets } = await supabase
          .from('brackets')
          .select('pool_id, status')
          .eq('user_id', user.id)
          .in('pool_id', poolIds);

        if (brackets && poolData) {
          const sm = new Map<string, string>();
          poolData.forEach(p => {
            const b = brackets.find(br => br.pool_id === p.id);
            const ds = getBracketDisplayStatus(b?.status || null, p.lock_time, 0, TOTAL_GAMES);
            sm.set(p.id, ds);
          });
          setBracketStatuses(sm);
        }

        const { data: allMembers } = await supabase
          .from('pool_members')
          .select('pool_id')
          .in('pool_id', poolIds);
        if (allMembers) {
          const counts = new Map<string, number>();
          allMembers.forEach(m => counts.set(m.pool_id, (counts.get(m.pool_id) || 0) + 1));
          setMemberCounts(counts);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const isLocked = (lt: string) => new Date(lt) <= new Date();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const bracketsIn = Array.from(bracketStatuses.values()).filter(s => s === 'submitted' || s === 'scored').length;
  const lockedCount = pools.filter(p => isLocked(p.lock_time)).length;

  return (
    <div className="pb-6">
      {/* ═══ Hero Section ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative mb-8"
      >
        {/* Arena ambient */}
        <div className="absolute -inset-x-8 -top-14 -bottom-8 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 90% 55% at 50% -15%, hsl(var(--primary) / 0.06), transparent)',
        }} />
        <div className="absolute -inset-x-8 -top-10 -bottom-8 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 40% 35% at 85% 5%, hsl(var(--accent) / 0.025), transparent)',
        }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <motion.img
              src={dhMonogram}
              alt="DH"
              className="w-9 h-9 object-contain"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05, type: 'spring', damping: 18 }}
              style={{ filter: 'drop-shadow(0 0 10px hsl(var(--primary) / 0.18))' }}
            />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.08 }}
              className="text-[9px] font-bold uppercase tracking-[0.25em]"
              style={{ color: 'hsl(var(--primary) / 0.5)' }}
            >
              {getGreeting()}
            </motion.p>
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="text-[1.75rem] font-extrabold tracking-tight leading-none"
          >
            {displayName || 'there'}{' '}
            <motion.span
              initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 15 }}
              className="inline-block"
            >
              👋
            </motion.span>
          </motion.h1>

          {!loading && pools.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-[13px] text-muted-foreground mt-1.5 font-medium"
            >
              {bracketsIn === pools.length && pools.length > 0
                ? 'All brackets submitted 🏀'
                : `${pools.length} pool${pools.length !== 1 ? 's' : ''} active`}
            </motion.p>
          )}
        </div>
      </motion.div>

      {/* ═══ Quick Actions ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="flex gap-2.5 mb-7"
      >
        <Link to="/pools/create" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2 font-bold h-[2.75rem] rounded-xl text-[13px] btn-premium btn-press">
            <Plus className="w-4 h-4" /> Create Pool
          </button>
        </Link>
        <Link to="/pools/join" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2 font-bold h-[2.75rem] rounded-xl text-[13px] btn-press transition-all duration-200" style={{
            background: 'hsl(var(--surface-elevated))',
            border: '1px solid hsl(var(--border) / 0.5)',
            color: 'hsl(var(--foreground))',
            boxShadow: 'var(--shadow-premium)',
          }}>
            <Users className="w-4 h-4 text-muted-foreground" /> Join Pool
          </button>
        </Link>
      </motion.div>

      {/* ═══ PWA Install Banner ═══ */}
      <AnimatePresence>
        {canInstall && !dismissedInstall && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-7 overflow-hidden"
          >
            <div className="glass-card arena-edge p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10" style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.06))',
              }}>
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-[13px] font-bold">Install App</p>
                <p className="text-[10px] text-muted-foreground">Best experience on home screen</p>
              </div>
              <button onClick={install} className="rounded-xl font-bold text-xs h-8 px-3.5 flex-shrink-0 relative z-10 btn-premium">
                Install
              </button>
              <button onClick={() => setDismissedInstall(true)} className="text-muted-foreground/40 hover:text-foreground p-1 relative z-10 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Summary Stats ═══ */}
      {!loading && pools.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
          className="grid grid-cols-3 gap-2.5 mb-7"
        >
          {[
            { icon: Trophy, value: pools.length, label: 'Pools', colorVar: 'primary' },
            { icon: BarChart3, value: bracketsIn, label: 'Brackets', colorVar: 'accent' },
            { icon: Shield, value: lockedCount, label: 'Locked', colorVar: 'success' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + i * 0.06, type: 'spring', damping: 22 }}
              className="stat-card arena-edge"
            >
              <stat.icon className="w-3.5 h-3.5 relative z-10" style={{ color: `hsl(var(--${stat.colorVar}))` }} />
              <span className="stat-value relative z-10">{stat.value}</span>
              <span className="stat-label relative z-10">{stat.label}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ═══ My Pools ═══ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28 }}
        className="section-divider mb-3"
      >
        <h2 className="section-header mb-0">My Pools</h2>
      </motion.div>

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map(i => (
            <div key={i} className="glass-card p-5">
              <div className="h-4 rounded-lg w-1/3 mb-3 skeleton-shimmer" />
              <div className="h-3 rounded-lg w-1/2 skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : pools.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card arena-edge p-10 text-center"
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10">
            <img src={dhMonogram} alt="DH" className="w-10 h-10 object-contain opacity-50" />
          </div>
          <p className="text-sm font-bold relative z-10 mb-1">No pools yet</p>
          <p className="text-xs text-muted-foreground leading-relaxed relative z-10 mb-5">Create a pool or join one with an invite code.</p>
          <div className="flex gap-2.5 justify-center relative z-10">
            <Link to="/pools/create">
              <button className="flex items-center gap-2 font-bold rounded-xl px-4 py-2.5 text-[13px] btn-premium btn-press">
                <Plus className="w-4 h-4" /> Create
              </button>
            </Link>
            <Link to="/pools/join">
              <button className="flex items-center gap-2 font-bold rounded-xl px-4 py-2.5 text-[13px] btn-press" style={{
                background: 'hsl(var(--surface-elevated))',
                border: '1px solid hsl(var(--border) / 0.5)',
              }}>
                <Users className="w-4 h-4" /> Join
              </button>
            </Link>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-2.5">
          {pools.map((pool, i) => {
            const bs = bracketStatuses.get(pool.id) || 'none';
            const bsCfg = STATUS_CONFIG[bs];
            const locked = isLocked(pool.lock_time);
            const members = memberCounts.get(pool.id) || 0;

            return (
              <motion.div
                key={pool.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05, type: 'spring', damping: 24, stiffness: 300 }}
              >
                <Link to={`/pools/${pool.id}`} className="block group">
                  <div className="glass-card p-4 transition-all duration-200 group-hover:border-primary/15" style={{
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  }}>
                    <div className="flex items-center gap-3 relative z-10">
                      {/* Pool icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                        background: locked
                          ? 'hsl(var(--muted) / 0.5)'
                          : 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.04))',
                      }}>
                        <Trophy className={cn("w-4.5 h-4.5", locked ? "text-muted-foreground/60" : "text-primary")} />
                      </div>

                      {/* Pool info */}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[14px] truncate tracking-tight group-hover:text-primary transition-colors duration-150">{pool.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground/50 font-medium">
                            {pool.tournaments?.name}
                          </span>
                          <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/15" />
                          <span className="text-[10px] text-muted-foreground/50 flex items-center gap-0.5 font-medium">
                            <Users className="w-2.5 h-2.5" /> {members}
                          </span>
                        </div>
                      </div>

                      {/* Status badges + arrow */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={cn("status-pill", bsCfg.className)}>{bsCfg.label}</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold" style={{
                          background: locked
                            ? 'linear-gradient(135deg, hsl(var(--destructive) / 0.1), hsl(var(--destructive) / 0.03))'
                            : 'linear-gradient(135deg, hsl(var(--success) / 0.1), hsl(var(--success) / 0.03))',
                          color: locked ? 'hsl(var(--destructive))' : 'hsl(var(--success))',
                        }}>
                          {locked ? 'Locked' : 'Open'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/15 group-hover:text-muted-foreground/50 group-hover:translate-x-0.5 transition-all duration-200" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

