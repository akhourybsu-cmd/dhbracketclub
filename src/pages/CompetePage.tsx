import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, BarChart3, MessageCircle, Bookmark, ChevronRight, Plus, Swords, Lock, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentDay, useMyLock, useDayLocks } from '@/hooks/useLockbox';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

// Non-lockbox modules
const modules = [
  { path: '/brackets', label: 'Brackets', description: 'March Madness pools & bracket challenges', icon: Trophy, color: 'primary', create: '/pools/create', countTable: 'pools' as const },
  { path: '/rankings', label: 'Rankings', description: 'Rank anything — movies, food, takes', icon: BarChart3, color: 'accent', create: '/rankings/create', countTable: 'rankings' as const },
  { path: '/polls', label: 'Polls', description: 'Quick votes and group decisions', icon: MessageCircle, color: 'warning', create: '/polls/create', countTable: 'polls' as const },
  { path: '/drafts', label: 'Drafts', description: 'Snake drafts on any topic', icon: Bookmark, color: 'gold', create: '/drafts/create', countTable: 'drafts' as const },
];

function LockboxCompeteCard() {
  const { user } = useAuth();
  const { data: day } = useCurrentDay();
  const { data: myLock } = useMyLock(day?.id);
  const { data: locks } = useDayLocks(day?.id);

  const crackedCount = (locks || []).filter((l: any) => l.myAttempt?.is_solved).length;
  const totalLocks = (locks || []).length;
  const inProgress = (locks || []).filter((l: any) => l.myAttempt && !l.myAttempt.is_solved).length;

  const dayLabel = day ? format(new Date(day.starts_at), 'MMM d') : 'Today';

  // Build context line
  let contextLine = dayLabel;
  if (!myLock) {
    contextLine += ' · Create your lock';
  } else if (inProgress > 0) {
    contextLine += ` · ${inProgress} in progress`;
  } else if (totalLocks > 0) {
    contextLine += ` · ${crackedCount}/${totalLocks} cracked`;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <div className="glass-card p-4 relative overflow-hidden border border-destructive/10">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.2), hsl(var(--destructive) / 0.05))' }}
            >
              <Lock className="w-5 h-5" style={{ color: 'hsl(var(--destructive))' }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-[15px] tracking-tight">DH Lockbox</h2>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-destructive/12 text-destructive">
                  DAILY
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground/70">{contextLine}</p>
            </div>
          </div>

          {/* Quick status chips */}
          <div className="flex gap-2 mb-3">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Shield className="w-3 h-3" />
              {myLock ? (myLock.is_cracked ? '💔 Cracked' : '🔒 Defending') : 'No lock'}
            </div>
            {totalLocks > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Swords className="w-3 h-3" />
                {crackedCount}/{totalLocks}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Link to="/lockbox" className="flex-1">
              <button className="w-full h-8 rounded-lg bg-muted/50 text-[11px] font-bold text-foreground/80 hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
                Open <ChevronRight className="w-3 h-3" />
              </button>
            </Link>
            {!myLock && (
              <Link to="/lockbox">
                <button
                  className="h-8 px-3 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5"
                  style={{ background: 'hsl(var(--destructive) / 0.15)', color: 'hsl(var(--destructive))' }}
                >
                  <Plus className="w-3 h-3" /> Create Lock
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function CompetePage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeDrafts, setActiveDrafts] = useState<any[]>([]);

  useEffect(() => {
    const fetchCounts = async () => {
      const [{ count: r }, { count: p }, { count: d }, { data: inProgressDrafts }] = await Promise.all([
        supabase.from('rankings').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('polls').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('drafts').select('*', { count: 'exact', head: true }).neq('status', 'complete'),
        supabase.from('drafts').select('topic, current_pick_user_id, current_pick_profiles:current_pick_user_id(display_name)').eq('status', 'in_progress').limit(3),
      ]);
      setCounts({ rankings: r || 0, polls: p || 0, drafts: d || 0 });
      if (inProgressDrafts) setActiveDrafts(inProgressDrafts);
    };
    fetchCounts();
  }, []);

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <div className="page-header-icon"><Swords /></div>
          <div>
            <h1 className="page-header-title">Compete</h1>
            <p className="page-header-subtitle">Lockbox, brackets, rankings, polls & drafts</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Lockbox — featured at top */}
          <LockboxCompeteCard />

          {/* Other modules */}
          {modules.map((mod, i) => {
            const activeCount = counts[mod.countTable] || 0;
            return (
              <motion.div key={mod.path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                <div className="glass-card p-4 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                        background: `linear-gradient(135deg, hsl(var(--${mod.color}) / 0.2), hsl(var(--${mod.color}) / 0.05))`,
                      }}>
                        <mod.icon className="w-5 h-5" style={{ color: `hsl(var(--${mod.color}))` }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="font-bold text-[15px] tracking-tight">{mod.label}</h2>
                          {activeCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold" style={{
                              background: `hsl(var(--${mod.color}) / 0.12)`,
                              color: `hsl(var(--${mod.color}))`,
                            }}>
                              {activeCount} active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground/70">{mod.description}</p>
                        {mod.countTable === 'drafts' && activeDrafts.length > 0 && activeDrafts[0].current_pick_user_id && (
                          <p className="text-[10px] font-semibold mt-0.5" style={{ color: activeDrafts[0].current_pick_user_id === user?.id ? 'hsl(var(--gold))' : 'hsl(var(--success))' }}>
                            🎯 {activeDrafts[0].current_pick_user_id === user?.id ? 'Your pick!' : `${activeDrafts[0].current_pick_profiles?.display_name || 'Someone'}'s pick`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to={mod.path} className="flex-1">
                        <button className="w-full h-8 rounded-lg bg-muted/50 text-[11px] font-bold text-foreground/80 hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
                          View All <ChevronRight className="w-3 h-3" />
                        </button>
                      </Link>
                      <Link to={mod.create}>
                        <button className="h-8 px-3 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5" style={{
                          background: `hsl(var(--${mod.color}) / 0.15)`,
                          color: `hsl(var(--${mod.color}))`,
                        }}>
                          <Plus className="w-3 h-3" /> Create
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
