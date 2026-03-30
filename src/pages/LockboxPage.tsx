import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, Shield, Swords, Trophy, ChevronRight } from 'lucide-react';
import { useCurrentWeek, useMyLock, useWeekLocks, useWeekScores } from '@/hooks/useLockbox';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LockCreator } from '@/components/lockbox/LockCreator';
import { CrackList } from '@/components/lockbox/CrackList';
import { LockboxLeaderboard } from '@/components/lockbox/LockboxLeaderboard';

export default function LockboxPage() {
  const { user } = useAuth();
  const { data: week, isLoading: weekLoading } = useCurrentWeek();
  const { data: myLock, isLoading: lockLoading } = useMyLock(week?.id);
  const { data: locks } = useWeekLocks(week?.id);
  const { data: scores } = useWeekScores(week?.id);
  const [tab, setTab] = useState('mylock');

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

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.2), hsl(var(--destructive) / 0.05))' }}>
            <Lock className="w-5 h-5" style={{ color: 'hsl(var(--destructive))' }} />
          </div>
          <div>
            <h1 className="page-header-title">DH Lockbox</h1>
            <p className="page-header-subtitle">{weekLabel} • {myLock ? 'Lock set' : 'Create your lock'}</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="glass-card p-3 text-center">
            <Shield className="w-4 h-4 mx-auto mb-1 text-primary" />
            <div className="text-lg font-bold">{myLock ? (myLock.is_cracked ? '💔' : '🔒') : '—'}</div>
            <div className="text-[10px] text-muted-foreground">Your Lock</div>
          </div>
          <div className="glass-card p-3 text-center">
            <Unlock className="w-4 h-4 mx-auto mb-1 text-accent" />
            <div className="text-lg font-bold">{crackedCount}/{totalLocks}</div>
            <div className="text-[10px] text-muted-foreground">Cracked</div>
          </div>
          <div className="glass-card p-3 text-center">
            <Trophy className="w-4 h-4 mx-auto mb-1 text-warning" />
            <div className="text-lg font-bold">{scores?.find((s: any) => s.user_id === user?.id)?.total_points || 0}</div>
            <div className="text-[10px] text-muted-foreground">Points</div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="mylock" className="flex-1 text-xs">
              <Shield className="w-3.5 h-3.5 mr-1" /> My Lock
            </TabsTrigger>
            <TabsTrigger value="crack" className="flex-1 text-xs">
              <Swords className="w-3.5 h-3.5 mr-1" /> Crack
            </TabsTrigger>
            <TabsTrigger value="scores" className="flex-1 text-xs">
              <Trophy className="w-3.5 h-3.5 mr-1" /> Board
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mylock">
            <LockCreator weekId={week?.id} myLock={myLock} />
          </TabsContent>

          <TabsContent value="crack">
            <CrackList locks={locks || []} weekId={week?.id} />
          </TabsContent>

          <TabsContent value="scores">
            <LockboxLeaderboard scores={scores || []} weekLabel={weekLabel} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
