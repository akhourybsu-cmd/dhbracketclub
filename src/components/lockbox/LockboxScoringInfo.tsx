import { motion } from 'framer-motion';
import { X, Swords, Shield, Trophy, Zap, HelpCircle } from 'lucide-react';

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
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Swords className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Crack a Lock — 5 pts</div>
            <div className="text-[10px] text-muted-foreground">Solve all 3 phases (numbers → colors → maze)</div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Best Crack Bonus — +2 pts</div>
            <div className="text-[10px] text-muted-foreground">Fewest total attempts on a lock wins the bonus</div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Defend Your Lock — 5 pts</div>
            <div className="text-[10px] text-muted-foreground">No one cracks your lock by end of week</div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-[12px] font-bold">What Counts as an Attempt?</div>
            <div className="text-[10px] text-muted-foreground">Each number guess, color guess, or failed maze try = 1 attempt</div>
          </div>
        </div>

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
