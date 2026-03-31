import { motion } from 'framer-motion';
import { X, Swords, Shield, Trophy, Zap, HelpCircle, Target } from 'lucide-react';
import {
  BASE_CRACK_POINTS, BEST_CRACK_BONUS, UNCRACKED_DEFENSE_POINTS,
  EFFICIENCY_TIERS, DEFENSE_TIERS,
} from '@/lib/lockboxScoring';

interface Props {
  onClose: () => void;
}

export function LockboxScoringInfo({ onClose }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 mb-4 border border-primary/10 relative"
    >
      <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-muted/30">
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      <h3 className="font-bold text-sm mb-3">How Scoring Works</h3>

      <div className="space-y-3">
        {/* Crack base */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Swords className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Crack a Lock — {BASE_CRACK_POINTS} pts</div>
            <div className="text-[10px] text-muted-foreground">Solve all 3 phases (numbers → colors → maze)</div>
          </div>
        </div>

        {/* Efficiency bonus */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Efficiency Bonus</div>
            <div className="text-[10px] text-muted-foreground mb-1.5">Fewer attempts = more bonus points</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {EFFICIENCY_TIERS.map(t => (
                <div key={t.range} className="text-[9px] text-muted-foreground flex justify-between">
                  <span>{t.range}</span>
                  <span className="font-bold text-primary">{t.bonus}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Best crack */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Best Crack Bonus — +{BEST_CRACK_BONUS} pts</div>
            <div className="text-[10px] text-muted-foreground">Fewest attempts on a lock wins the bonus (ties: fastest time, then earliest finish)</div>
          </div>
        </div>

        {/* Defense */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Defense Points</div>
            <div className="text-[10px] text-muted-foreground mb-1.5">Harder locks earn more defense</div>
            <div className="space-y-0.5">
              {DEFENSE_TIERS.map(t => (
                <div key={t.condition} className="text-[9px] text-muted-foreground flex justify-between">
                  <span>{t.condition}</span>
                  <span className="font-bold text-primary">{t.points}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Attempts */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-[12px] font-bold">What Counts as an Attempt?</div>
            <div className="text-[10px] text-muted-foreground">Each number guess, color guess, or failed maze run = 1 attempt. Total across all phases.</div>
          </div>
        </div>

        {/* Weekly winner */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Weekly Winner</div>
            <div className="text-[10px] text-muted-foreground">Most total points at end of week wins. New locks reset every week.</div>
          </div>
        </div>
      </div>

      {/* Clue feedback legend */}
      <div className="mt-4 pt-3 border-t border-border/10">
        <div className="text-[10px] font-bold text-muted-foreground/60 mb-2 tracking-wider">CLUE FEEDBACK</div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px]">🎯</span>
            <span className="text-[10px] text-muted-foreground">Right value, right spot</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-amber-400/15 flex items-center justify-center text-[10px]">🔄</span>
            <span className="text-[10px] text-muted-foreground">Right value, wrong spot</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
