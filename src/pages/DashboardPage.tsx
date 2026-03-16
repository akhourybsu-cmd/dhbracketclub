import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Users, ArrowRight, Trophy, BarChart3, Shield, Download, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBracketDisplayStatus, STATUS_CONFIG, TOTAL_GAMES } from '@/lib/bracketUtils';
import { cn } from '@/lib/utils';
import { usePwaInstall } from '@/hooks/usePwaInstall';

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
    <div className="pb-8">
      {/* ═══ Hero Section ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative mb-10"
      >
        {/* Multi-layer ambient glow */}
        <div className="absolute -inset-x-6 -top-12 -bottom-6 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, hsl(var(--primary) / 0.07), transparent)',
        }} />
        <div className="absolute -inset-x-6 -top-8 -bottom-6 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 50% 40% at 80% 10%, hsl(var(--accent) / 0.03), transparent)',
        }} />

        <div className="relative z-10">
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2.5"
            style={{ color: 'hsl(var(--primary) / 0.6)' }}
          >
            {getGreeting()}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none"
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
              transition={{ delay: 0.25 }}
              className="text-sm text-muted-foreground mt-2 font-medium"
            >
              {bracketsIn === pools.length && pools.length > 0
                ? 'All brackets submitted — you\'re all set! 🏀'
                : `${pools.length} pool${pools.length !== 1 ? 's' : ''} active`}
            </motion.p>
          )}
        </div>
      </motion.div>

      {/* ═══ Quick Actions ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="flex gap-3 mb-8"
      >
        <Link to="/pools/create" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2.5 font-bold h-12 rounded-xl text-sm transition-all duration-200" style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
            color: 'hsl(var(--primary-foreground))',
            boxShadow: '0 0 20px hsl(var(--primary) / 0.2), 0 4px 12px rgba(0,0,0,0.2)',
          }}>
            <Plus className="w-4 h-4" /> Create Pool
          </button>
        </Link>
        <Link to="/pools/join" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2.5 font-bold h-12 rounded-xl text-sm transition-all duration-200" style={{
            background: 'hsl(var(--surface-elevated))',
            border: '1px solid hsl(var(--border) / 0.5)',
            color: 'hsl(var(--foreground))',
            boxShadow: 'var(--shadow-card)',
          }}>
            <Users className="w-4 h-4" /> Join Pool
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
            className="mb-8 overflow-hidden"
          >
            <div className="rounded-2xl p-4 flex items-center gap-3.5 relative overflow-hidden" style={{
              background: 'linear-gradient(135deg, hsl(var(--card)), hsl(var(--surface-elevated)))',
              border: '1px solid hsl(var(--primary) / 0.15)',
              boxShadow: '0 0 20px hsl(var(--primary) / 0.04), var(--shadow-card)',
            }}>
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse 60% 80% at 0% 50%, hsl(var(--primary) / 0.04), transparent)',
              }} />
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10" style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.06))',
              }}>
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-sm font-bold">Install Bracket Battle</p>
                <p className="text-[11px] text-muted-foreground">Add to home screen for the best experience</p>
              </div>
              <button onClick={install} className="rounded-xl font-bold text-xs h-9 px-4 flex-shrink-0 relative z-10 transition-all" style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
                color: 'white',
                boxShadow: '0 0 12px hsl(var(--primary) / 0.2)',
              }}>
                Install
              </button>
              <button onClick={() => setDismissedInstall(true)} className="text-muted-foreground/50 hover:text-foreground p-1 relative z-10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Summary Stats ═══ */}
      {!loading && pools.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="grid grid-cols-3 gap-3 mb-8"
        >
          {[
            { icon: Trophy, value: pools.length, label: 'Pools', colorVar: 'primary' },
            { icon: BarChart3, value: bracketsIn, label: 'Brackets In', colorVar: 'accent' },
            { icon: Shield, value: lockedCount, label: 'Locked', colorVar: 'success' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.07, type: 'spring', damping: 20 }}
              className="rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-1.5 relative overflow-hidden"
              style={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border) / 0.4)',
                boxShadow: 'var(--shadow-card)',
                minHeight: '6rem',
              }}
            >
              {/* Shine overlay */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-card-shine)', opacity: 0.4 }} />
              {/* Subtle colored glow */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-12 pointer-events-none" style={{
                background: `radial-gradient(ellipse at center, hsl(var(--${stat.colorVar}) / 0.08), transparent 70%)`,
              }} />

              <stat.icon className="w-4 h-4 mb-0.5 relative z-10" style={{ color: `hsl(var(--${stat.colorVar}))` }} />
              <span className="text-2xl font-extrabold tabular-nums leading-none tracking-tight relative z-10">{stat.value}</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground relative z-10">{stat.label}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ═══ My Pools ═══ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-3 mb-4"
      >
        <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">My Pools</h2>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, hsl(var(--border) / 0.5), transparent)' }} />
        {pools.length > 0 && (
          <span className="text-[10px] text-muted-foreground/40 tabular-nums font-medium">{pools.length}</span>
        )}
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl p-5" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.3)' }}>
              <div className="h-4 rounded-lg w-1/3 mb-3 skeleton-shimmer" style={{ background: 'hsl(var(--muted))' }} />
              <div className="h-3 rounded-lg w-1/2 skeleton-shimmer" style={{ background: 'hsl(var(--muted))' }} />
            </div>
          ))}
        </div>
      ) : pools.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl p-12 text-center relative overflow-hidden"
          style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border) / 0.4)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-card-shine)', opacity: 0.3 }} />
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 relative z-10" style={{
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.04))',
          }}>
            <Trophy className="w-7 h-7 text-primary/60" />
          </div>
          <p className="text-sm font-bold relative z-10 mb-1.5">No pools yet</p>
          <p className="text-xs text-muted-foreground leading-relaxed relative z-10 mb-6">Create a pool or join one with an invite code.</p>
          <div className="flex gap-3 justify-center relative z-10">
            <Link to="/pools/create">
              <button className="flex items-center gap-2 font-bold rounded-xl px-5 py-2.5 text-sm transition-all" style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
                color: 'white',
                boxShadow: '0 0 16px hsl(var(--primary) / 0.2)',
              }}>
                <Plus className="w-4 h-4" /> Create Pool
              </button>
            </Link>
            <Link to="/pools/join">
              <button className="flex items-center gap-2 font-bold rounded-xl px-5 py-2.5 text-sm transition-all" style={{
                background: 'hsl(var(--surface-elevated))',
                border: '1px solid hsl(var(--border) / 0.5)',
              }}>
                <Users className="w-4 h-4" /> Join Pool
              </button>
            </Link>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {pools.map((pool, i) => {
            const bs = bracketStatuses.get(pool.id) || 'none';
            const bsCfg = STATUS_CONFIG[bs];
            const locked = isLocked(pool.lock_time);
            const members = memberCounts.get(pool.id) || 0;

            return (
              <motion.div
                key={pool.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, type: 'spring', damping: 22, stiffness: 280 }}
              >
                <Link to={`/pools/${pool.id}`} className="block group">
                  <div className="rounded-2xl p-4 relative overflow-hidden transition-all duration-250" style={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border) / 0.4)',
                    boxShadow: 'var(--shadow-card)',
                  }}>
                    {/* Shine overlay */}
                    <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
                      background: 'var(--gradient-card-shine)',
                      opacity: 0.4,
                    }} />

                    <div className="flex items-center gap-3.5 relative z-10">
                      {/* Pool icon */}
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                        background: locked
                          ? 'hsl(var(--muted) / 0.6)'
                          : 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.04))',
                        boxShadow: locked ? 'none' : '0 0 12px hsl(var(--primary) / 0.06)',
                      }}>
                        <Trophy className={cn("w-5 h-5", locked ? "text-muted-foreground" : "text-primary")} />
                      </div>

                      {/* Pool info */}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[15px] truncate tracking-tight group-hover:text-primary transition-colors duration-200">{pool.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground/60 font-medium">
                            {pool.tournaments?.name} {pool.tournaments?.season_year}
                          </span>
                          <span className="w-0.5 h-0.5 rounded-full" style={{ background: 'hsl(var(--muted-foreground) / 0.2)' }} />
                          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5 font-medium">
                            <Users className="w-3 h-3" /> {members}
                          </span>
                        </div>
                      </div>

                      {/* Status badges + arrow */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn("status-pill", bsCfg.className)}>{bsCfg.label}</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold" style={{
                          background: locked
                            ? 'linear-gradient(135deg, hsl(var(--destructive) / 0.12), hsl(var(--destructive) / 0.04))'
                            : 'linear-gradient(135deg, hsl(var(--success) / 0.12), hsl(var(--success) / 0.04))',
                          color: locked ? 'hsl(var(--destructive))' : 'hsl(var(--success))',
                        }}>
                          {locked ? 'Locked' : 'Open'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-muted-foreground/60 group-hover:translate-x-0.5 transition-all duration-200" />
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
