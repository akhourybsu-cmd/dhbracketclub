import { motion } from 'framer-motion';
import { Trophy, Swords, Shield, Unlock, Lock, Target, Flame, BarChart3 } from 'lucide-react';

interface PlayerStats {
  totalPoints: number;
  crackPoints: number;
  defensePoints: number;
  weeklyWins: number;
  topThree: number;
  locksCracked: number;
  locksDefended: number;
  totalLocks: number;
  avgAttempts: number;
  bestCrack: number;
  weeksPlayed: number;
  placements: any[];
}

interface Props {
  stats: PlayerStats | undefined;
  isLoading: boolean;
}

export function LockboxStats({ stats, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-card p-4 animate-pulse"><div className="h-10 bg-muted/20 rounded-lg" /></div>
        ))}
      </div>
    );
  }

  if (!stats || stats.weeksPlayed === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <BarChart3 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
        <h3 className="font-bold text-sm mb-1">No Stats Yet</h3>
        <p className="text-[11px] text-muted-foreground">Complete a full week to start building your Lockbox stats</p>
      </div>
    );
  }

  const statGroups = [
    {
      title: 'OVERVIEW',
      items: [
        { icon: Trophy, label: 'Total Points', value: stats.totalPoints },
        { icon: Flame, label: 'Weekly Wins', value: stats.weeklyWins },
        { icon: Trophy, label: 'Top 3 Finishes', value: stats.topThree },
        { icon: BarChart3, label: 'Weeks Played', value: stats.weeksPlayed },
      ],
    },
    {
      title: 'OFFENSE',
      items: [
        { icon: Swords, label: 'Crack Points', value: stats.crackPoints },
        { icon: Unlock, label: 'Locks Cracked', value: stats.locksCracked },
        { icon: Target, label: 'Avg Attempts per Crack', value: stats.avgAttempts || '—' },
        { icon: Target, label: 'Best Single Crack', value: stats.bestCrack > 0 ? `${stats.bestCrack} tries` : '—' },
      ],
    },
    {
      title: 'DEFENSE',
      items: [
        { icon: Shield, label: 'Defense Points', value: stats.defensePoints },
        { icon: Lock, label: 'Locks Defended', value: `${stats.locksDefended} of ${stats.totalLocks}` },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {statGroups.map((group, gi) => (
        <motion.div key={group.title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.05 }}>
          <div className="text-[10px] font-bold text-muted-foreground/60 mb-2 tracking-wider">{group.title}</div>
          <div className="glass-card p-1">
            {group.items.map((item, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 ${i < group.items.length - 1 ? 'border-b border-border/10' : ''}`}>
                <item.icon className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-[12px] text-muted-foreground flex-1">{item.label}</span>
                <span className="font-bold text-sm">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {stats.placements.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="text-[10px] font-bold text-muted-foreground/60 mb-2 tracking-wider">RECENT WEEKS</div>
          <div className="glass-card p-1">
            {stats.placements.map((p: any, i: number) => (
              <div key={p.id} className={`flex items-center gap-3 p-3 ${i < stats.placements.length - 1 ? 'border-b border-border/10' : ''}`}>
                <div className="w-7 text-center">
                  {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : <span className="text-[11px] text-muted-foreground">#{p.rank || '—'}</span>}
                </div>
                <span className="text-[12px] text-muted-foreground flex-1">{p.total_points} pts</span>
                <div className="flex gap-2.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Swords className="w-3 h-3" />{p.crack_points}</span>
                  <span className="flex items-center gap-0.5"><Shield className="w-3 h-3" />{p.defense_points}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
