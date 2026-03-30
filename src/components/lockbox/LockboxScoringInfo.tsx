import { motion } from 'framer-motion';
import { X, Swords, Shield, Trophy, Zap } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function LockboxScoringInfo({ onClose }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 mb-4 border border-primary/10 relative">
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
            <div className="text-[10px] text-muted-foreground">Fully solve all 3 phases of another player's lock</div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Best Crack Bonus — +2 pts</div>
            <div className="text-[10px] text-muted-foreground">Crack a lock in the fewest total attempts among all players</div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Defend Your Lock — 5 pts</div>
            <div className="text-[10px] text-muted-foreground">If nobody cracks your lock by the end of the week</div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[12px] font-bold">Attempts Count</div>
            <div className="text-[10px] text-muted-foreground">Each number, color, or maze guess = 1 attempt. Fewer attempts = better crack.</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
