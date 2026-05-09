import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import pwEmblem from '@/assets/portfolio-wars-emblem.png';

const BOOT_FLAG = 'pw_boot_played_v1';
const DURATION = 1300;

const STAGES = [
  'Connecting to market feed…',
  'Loading watchlist…',
  'Trading floor online',
];

/**
 * One-time trading-terminal boot intro for the Portfolio Wars standalone shell.
 * Plays once per browser session on first entry into /portfolio-wars.
 */
export function PwBoot() {
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let played = false;
    try { played = sessionStorage.getItem(BOOT_FLAG) === '1'; } catch {}
    if (played) return;

    setShow(true);
    try { sessionStorage.setItem(BOOT_FLAG, '1'); } catch {}

    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      const linear = Math.min(1, elapsed / DURATION);
      const eased = 1 - Math.pow(1 - linear, 1.7);
      setProgress(Math.round(eased * 100));
      if (linear > 0.45 && linear <= 0.85) setStage(1);
      if (linear > 0.85) setStage(2);
      if (linear < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setShow(false), 280);
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
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] overflow-hidden flex flex-col items-center justify-center px-6"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 38%, hsl(152 80% 35% / 0.32), transparent 60%),' +
              'radial-gradient(ellipse 90% 60% at 50% 110%, hsl(38 100% 55% / 0.16), transparent 70%),' +
              'linear-gradient(180deg, hsl(220 50% 4%), hsl(220 60% 2%))',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Candlestick grid */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, transparent 0, transparent 24px, hsl(152 80% 50% / 0.06) 24px, hsl(152 80% 50% / 0.06) 25px),' +
                'repeating-linear-gradient(0deg, transparent 0, transparent 24px, hsl(152 80% 50% / 0.04) 24px, hsl(152 80% 50% / 0.04) 25px)',
              maskImage: 'linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)',
            }}
          />

          {/* Scanline overlay */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent 0, transparent 2px, hsl(0 0% 100% / 0.04) 2px, hsl(0 0% 100% / 0.04) 3px)',
            }}
          />

          {/* Corner glows */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 18% 12%, hsl(38 100% 60% / 0.18), transparent 35%),' +
                'radial-gradient(circle at 82% 12%, hsl(152 80% 55% / 0.18), transparent 35%)',
            }}
          />

          {/* Emblem with rotating ring */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative w-32 h-32 mb-7 flex items-center justify-center"
          >
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, hsl(152 80% 50% / 0.55), transparent 70%)',
                filter: 'blur(10px)',
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
              style={{
                borderStyle: 'dashed',
                borderColor: 'hsl(152 80% 50% / 0.55)',
                boxShadow:
                  '0 0 24px hsl(152 80% 50% / 0.4), inset 0 0 18px hsl(38 100% 60% / 0.2)',
              }}
            />
            <img
              src={pwEmblem}
              alt="Portfolio Wars"
              width={104}
              height={104}
              className="relative w-[104px] h-[104px] object-contain"
              style={{ filter: 'drop-shadow(0 0 18px hsl(152 80% 50% / 0.65))' }}
            />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="text-center"
          >
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.32em] mb-1.5"
              style={{ color: 'hsl(38 100% 60%)' }}
            >
              ◆ DH · MARKET DESK ◆
            </p>
            <h1
              className="text-[26px] font-black leading-none tracking-tight"
              style={{
                background:
                  'linear-gradient(180deg, hsl(0 0% 100%) 0%, hsl(38 100% 60% / 0.95) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 24px hsl(152 80% 50% / 0.35)',
              }}
            >
              Portfolio Wars
            </h1>
            <p className="text-[10px] font-bold mt-1.5" style={{ color: 'hsl(150 12% 78%)' }}>
              Booting trading floor
            </p>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-8 w-full max-w-[260px]"
          >
            <div
              className="relative h-1.5 rounded-full overflow-hidden"
              style={{
                background: 'hsl(220 35% 8%)',
                boxShadow:
                  'inset 0 1px 2px hsl(0 0% 0% / 0.7), inset 0 0 0 1px hsl(152 80% 50% / 0.2)',
              }}
            >
              <motion.div
                className="h-full relative"
                style={{
                  width: `${progress}%`,
                  background:
                    'linear-gradient(90deg, hsl(152 80% 46%), hsl(152 80% 55%) 60%, hsl(38 100% 65%))',
                  boxShadow: '0 0 14px hsl(152 80% 50% / 0.85)',
                }}
              >
                <span
                  className="absolute right-0 top-0 bottom-0 w-5"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.55))',
                  }}
                />
              </motion.div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <AnimatePresence mode="wait">
                <motion.p
                  key={stage}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                  className="text-[9px] font-extrabold uppercase tracking-[0.24em]"
                  style={{ color: 'hsl(152 80% 60%)' }}
                >
                  {STAGES[stage]}
                </motion.p>
              </AnimatePresence>
              <span className="text-[10px] font-mono tabular-nums text-white/55">
                {progress}%
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
