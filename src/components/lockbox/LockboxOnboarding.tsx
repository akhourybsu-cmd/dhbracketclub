import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Swords, Trophy, ChevronRight, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onDismiss: () => void;
  onCreateLock: () => void;
}

const steps = [
  {
    icon: Lock,
    title: 'Build Your Lock',
    desc: 'Create a 3-layer lock each day — numbers, colors, and a maze.',
    color: 'primary',
  },
  {
    icon: Swords,
    title: 'Crack Others',
    desc: 'Guess codes and solve mazes to break through other players\' locks.',
    color: 'amber-400',
  },
  {
    icon: Zap,
    title: 'Fewer Attempts Win',
    desc: 'Each guess counts. Crack locks in the fewest tries for bonus points.',
    color: 'primary',
  },
  {
    icon: Trophy,
    title: 'Daily Champion',
    desc: 'Earn points for cracking and defending. New competition every day.',
    color: 'amber-400',
  },
];

export function LockboxOnboarding({ onDismiss, onCreateLock }: Props) {
  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;
  const current = steps[step];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="glass-card p-5 mb-4 border border-primary/15 relative overflow-hidden"
    >
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted/30 transition-colors z-10"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      <div className="flex gap-1.5 mb-4">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-primary' : 'bg-muted/20'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-4"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, hsl(var(--${current.color}) / 0.2), hsl(var(--${current.color}) / 0.05))`,
            }}
          >
            <current.icon className="w-6 h-6" style={{ color: `hsl(var(--${current.color}))` }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-sm mb-1">{current.title}</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{current.desc}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-2 mt-4">
        {step > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} className="text-[11px] h-9 px-3">
            Back
          </Button>
        )}
        <div className="flex-1" />
        {isLast ? (
          <Button size="sm" onClick={onCreateLock} className="text-[11px] h-9 px-4 font-bold">
            <Lock className="w-3.5 h-3.5 mr-1.5" /> Create Your Lock
          </Button>
        ) : (
          <Button size="sm" onClick={() => setStep(step + 1)} className="text-[11px] h-9 px-4 font-bold">
            Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
