import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Shield, Swords, Trophy, History, BarChart3, Info } from 'lucide-react';
import { useCurrentWeek, useMyLock, useWeekLocks, useComputedLeaderboard, usePlayerStats } from '@/hooks/useLockbox';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LockCreator } from '@/components/lockbox/LockCreator';
import { CrackList } from '@/components/lockbox/CrackList';
import { LockboxLeaderboard } from '@/components/lockbox/LockboxLeaderboard';
import { LockboxStats } from '@/components/lockbox/LockboxStats';
import { LockboxHistory } from '@/components/lockbox/LockboxHistory';
import { LockboxScoringInfo } from '@/components/lockbox/LockboxScoringInfo';
import { LockboxOnboarding } from '@/components/lockbox/LockboxOnboarding';

const ONBOARDING_KEY = 'dh-lockbox-onboarding-dismissed';

export default function LockboxPage() {
  const { user } = useAuth();
  const { data: week, isLoading: weekLoading } = useCurrentWeek();
  const { data: myLock, isLoading: lockLoading } = useMyLock(week?.id);
  const { data: locks } = useWeekLocks(week?.id);
  const computed = useComputedLeaderboard(week?.id);
  const playerStats = usePlayerStats(user?.id);
  const [tab, setTab] = useState('mylock');
  const [showScoringInfo, setShowScoringInfo] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem(ONBOARDING_KEY)
  );

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem(ONBOARDING_KEY, '1');
  };

  if (weekLoading || lockLoading) {
    return (
      <div className="pb-6">
        <div className="page-header">
          <div className="page-header-icon"><Lock /></div>
          <div>
            <h1 className="page-header-title">DH Lockbox</h1>
            <p className="page-header-subtitle">Loading week…</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-12 bg-muted/30 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const weekLabel = week ? `Week ${week.week_number}` : '';
  const crackedCount = (locks || []).filter((l: any) => l.myAttempt?.is_solved).length;
  const totalLocks = (locks || []).length;
  const inProgressCount = (locks || []).filter((l: any) => l.myAttempt && !l.myAttempt.is_solved).length;

  const myRank = computed.data?.findIndex(p => p.userId === user?.id);
  const myPoints = computed.data?.find(p => p.userId === user?.id)?.totalPts || 0;

  // Subtitle helper
  const getSubtitle = () => {
    if (!myLock) return 'Create your lock to get started';
    if (totalLocks === 0) return 'Waiting for other players';
    if (inProgressCount > 0) return `${inProgressCount} lock${inProgressCount > 1 ? 's' : ''} in progress`;
    return `${crackedCount}/${totalLocks} cracked`;
  };

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="page-header">
          <div
            className="page-header-icon"
            style={{ background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.2), hsl(var(--destructive) / 0.05))' }}
          >
            <Lock className="w-5 h-5" style={{ color: 'hsl(var(--destructive))' }} />
          </div>
          <div className="flex-1">
            <h1 className="page-header-title">DH Lockbox</h1>
            <p className="page-header-subtitle">{weekLabel} • {getSubtitle()}</p>
          </div>
          <button
            onClick={() => setShowScoringInfo(!showScoringInfo)}
            className="p-2 rounded-lg hover:bg-muted/30 transition-colors"
            aria-label="How scoring works"
          >
            <Info className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scoring info panel */}
        <AnimatePresence>
          {showScoringInfo && <LockboxScoringInfo onClose={() => setShowScoringInfo(false)} />}
        </AnimatePresence>

        {/* Onboarding for new players */}
        <AnimatePresence>
          {showOnboarding && !myLock && (
            <LockboxOnboarding
              onDismiss={dismissOnboarding}
              onCreateLock={() => {
                dismissOnboarding();
                setTab('mylock');
              }}
            />
          )}
        </AnimatePresence>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="glass-card p-2.5 text-center">
            <Shield className="w-3.5 h-3.5 mx-auto mb-0.5 text-primary" />
            <div className="text-base font-bold">
              {myLock ? (myLock.is_cracked ? '💔' : '🔒') : '—'}
            </div>
            <div className="text-[9px] text-muted-foreground">
              {myLock ? (myLock.is_cracked ? 'Cracked' : 'Active') : 'No Lock'}
            </div>
          </div>
          <div className="glass-card p-2.5 text-center">
            <Swords className="w-3.5 h-3.5 mx-auto mb-0.5 text-amber-400" />
            <div className="text-base font-bold">{crackedCount}/{totalLocks}</div>
            <div className="text-[9px] text-muted-foreground">Cracked</div>
          </div>
          <div className="glass-card p-2.5 text-center">
            <Trophy className="w-3.5 h-3.5 mx-auto mb-0.5 text-amber-400" />
            <div className="text-base font-bold">{myPoints}</div>
            <div className="text-[9px] text-muted-foreground">Points</div>
          </div>
          <div className="glass-card p-2.5 text-center">
            <BarChart3 className="w-3.5 h-3.5 mx-auto mb-0.5 text-primary" />
            <div className="text-base font-bold">
              {myRank !== undefined && myRank >= 0 ? `#${myRank + 1}` : '—'}
            </div>
            <div className="text-[9px] text-muted-foreground">Rank</div>
          </div>
        </div>

        {/* CTA if no lock yet */}
        {!myLock && tab !== 'mylock' && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setTab('mylock')}
            className="w-full glass-card p-3.5 mb-4 border border-primary/15 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/12 flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-[12px]">Create Your Lock</div>
              <div className="text-[10px] text-muted-foreground">Set up your weekly defense</div>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-full bg-primary/15 text-primary font-bold">
              START
            </span>
          </motion.button>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="mylock" className="flex-1 text-[11px]">
              <Shield className="w-3 h-3 mr-1" /> Lock
            </TabsTrigger>
            <TabsTrigger value="crack" className="flex-1 text-[11px]">
              <Swords className="w-3 h-3 mr-1" /> Crack
            </TabsTrigger>
            <TabsTrigger value="board" className="flex-1 text-[11px]">
              <Trophy className="w-3 h-3 mr-1" /> Board
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex-1 text-[11px]">
              <BarChart3 className="w-3 h-3 mr-1" /> Stats
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 text-[11px]">
              <History className="w-3 h-3 mr-1" /> Past
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mylock">
            <LockCreator weekId={week?.id} myLock={myLock} />
          </TabsContent>

          <TabsContent value="crack">
            <CrackList locks={locks || []} weekId={week?.id} />
          </TabsContent>

          <TabsContent value="board">
            <LockboxLeaderboard
              computed={computed.data || []}
              formalScores={computed.formalScores || []}
              locks={computed.locks || []}
              attempts={computed.attempts || []}
              weekLabel={weekLabel}
              weekId={week?.id}
            />
          </TabsContent>

          <TabsContent value="stats">
            <LockboxStats stats={playerStats.data} isLoading={playerStats.isLoading} />
          </TabsContent>

          <TabsContent value="history">
            <LockboxHistory />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
