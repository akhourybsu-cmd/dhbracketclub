import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const BOOT_FLAG = 'rd_boot_played_v1';
const DURATION = 1200;

/**
 * One-time fantasy boot/loading overlay. Plays when the user enters Rune
 * Delve from outside the module. Tracked via sessionStorage so it doesn't
 * replay between in-game route changes.
 */
export function RuneDelveBoot() {
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let played = false;
    try {
      played = sessionStorage.getItem(BOOT_FLAG) === '1';
    } catch {}
    if (played) return;

    setShow(true);
    try {
      sessionStorage.setItem(BOOT_FLAG, '1');
    } catch {}

    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const pct = Math.min(100, ((t - start) / DURATION) * 100);
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(tick);
      else setTimeout(() => setShow(false), 180);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 35%, hsl(var(--rd-arcane) / 0.22), transparent 65%), radial-gradient(ellipse 80% 60% at 50% 100%, hsl(var(--rd-ember) / 0.12), transparent 70%), hsl(var(--rd-stone))',
          }}
        >
          {/* Faint sigil ring */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative w-28 h-28 mb-6 rounded-full flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, hsl(var(--rd-arcane) / 0.35), transparent 70%)',
              boxShadow:
                '0 0 60px hsl(var(--rd-arcane) / 0.45), inset 0 0 30px hsl(var(--rd-arcane) / 0.25)',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
              className="absolute inset-0 rounded-full border"
              style={{
                borderColor: 'hsl(var(--rd-arcane) / 0.45)',
                borderStyle: 'dashed',
              }}
            />
            <Sparkles
              className="w-12 h-12"
              style={{ color: 'hsl(var(--rd-arcane))', filter: 'drop-shadow(0 0 10px hsl(var(--rd-arcane) / 0.7))' }}
            />
          </motion.div>

          <motion.h1
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="text-2xl font-extrabold tracking-tight text-foreground"
          >
            Rune Delve
          </motion.h1>
          <motion.p
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="text-[10px] font-bold uppercase tracking-[0.3em] mt-1.5"
            style={{ color: 'hsl(var(--rd-arcane))' }}
          >
            Entering the Realm
          </motion.p>

          {/* Progress bar */}
          <div
            className="mt-7 w-56 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'hsl(var(--rd-stone-edge))' }}
          >
            <div
              className="h-full transition-[width] duration-75 ease-linear"
              style={{
                width: `${progress}%`,
                background:
                  'linear-gradient(90deg, hsl(var(--rd-arcane)), hsl(var(--rd-rune-blue)))',
                boxShadow: '0 0 12px hsl(var(--rd-arcane) / 0.7)',
              }}
            />
          </div>
          <p className="mt-3 text-[10px] font-mono tabular-nums text-muted-foreground">
            {Math.floor(progress)}%
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
