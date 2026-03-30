import { Trophy, Swords, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  scores: any[];
  weekLabel: string;
}

export function LockboxLeaderboard({ scores, weekLabel }: Props) {
  if (scores.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Trophy className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
        <h3 className="font-bold text-sm mb-1">No Scores Yet</h3>
        <p className="text-[11px] text-muted-foreground">Scores update as locks are cracked</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold text-muted-foreground/60 mb-2 tracking-wider">{weekLabel.toUpperCase()} STANDINGS</div>
      {scores.map((score: any, i: number) => {
        const medals = ['🥇', '🥈', '🥉'];
        return (
          <motion.div
            key={score.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`glass-card p-3.5 flex items-center gap-3 ${i === 0 ? 'border border-primary/15' : ''}`}
          >
            <div className="w-8 text-center font-bold text-sm">
              {i < 3 ? medals[i] : <span className="text-muted-foreground">#{i + 1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] truncate">{score.profiles?.display_name || 'Player'}</div>
              <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <Swords className="w-3 h-3" /> {score.crack_points}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Shield className="w-3 h-3" /> {score.defense_points}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-lg">{score.total_points}</div>
              <div className="text-[9px] text-muted-foreground">pts</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
