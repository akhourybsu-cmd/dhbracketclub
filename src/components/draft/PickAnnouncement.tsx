import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { Flame } from 'lucide-react';

interface PickAnnouncementProps {
  pick: {
    displayName: string;
    pickText: string;
    round: number;
    pickNumber: number;
  } | null;
  onHide?: () => void;
}

export function PickAnnouncement({ pick, onHide }: PickAnnouncementProps) {
  const [visible, setVisible] = useState(false);
  const [currentPick, setCurrentPick] = useState(pick);
  const lastShownPickNumberRef = useRef<number | null>(null);

  useEffect(() => {
    if (pick && pick.pickNumber !== lastShownPickNumberRef.current) {
      lastShownPickNumberRef.current = pick.pickNumber;
      setCurrentPick(pick);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onHide?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pick, onHide]);

  return (
    <AnimatePresence>
      {visible && currentPick && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="mb-3 overflow-hidden"
        >
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--gold) / 0.12), hsl(var(--gold) / 0.04))',
              border: '1px solid hsl(var(--gold) / 0.2)',
            }}
          >
            <motion.span
              initial={{ rotate: -90, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              className="flex-shrink-0"
            >
              <Flame className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
            </motion.span>
            <p className="text-[12px] font-bold flex-1 min-w-0">
              <span style={{ color: 'hsl(var(--gold))' }}>{currentPick.displayName}</span>
              <span className="text-foreground"> picks </span>
              <span className="font-extrabold text-foreground">{currentPick.pickText}</span>
            </p>
            <span className="text-[10px] font-mono text-muted-foreground/60 flex-shrink-0">
              Rd {currentPick.round} • #{currentPick.pickNumber}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
