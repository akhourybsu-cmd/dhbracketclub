import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnTheClockTimerProps {
  lastPickAt: string | null;
  draftStartedAt: string | null;
}

export function OnTheClockTimer({ lastPickAt, draftStartedAt }: OnTheClockTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    const baseTime = lastPickAt || draftStartedAt;
    if (baseTime) {
      startRef.current = new Date(baseTime).getTime();
    } else {
      startRef.current = Date.now();
    }
    setElapsed(0);

    const interval = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastPickAt, draftStartedAt]);

  const seconds = Math.floor(elapsed / 1000);
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const isUrgent = seconds >= 60;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center justify-center gap-1.5 mt-2"
    >
      <Clock className={cn(
        "w-3.5 h-3.5",
        isUrgent ? "animate-pulse" : ""
      )} style={{ color: isUrgent ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground) / 0.5)' }} />
      <span
        className={cn(
          "font-mono text-sm font-bold tracking-wider transition-colors duration-300",
          isUrgent ? "" : "text-muted-foreground/70"
        )}
        style={isUrgent ? { color: 'hsl(var(--gold))' } : undefined}
      >
        {min}:{sec.toString().padStart(2, '0')}
      </span>
    </motion.div>
  );
}
