import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import draftEmblem from '@/assets/draft-emblem.png';

const BOOT_FLAG = 'da_boot_played_v1';
const DURATION = 1300;

const STAGES = [
  'Loading league data…',
  'Syncing standings…',
  'Draft Arena online',
];

/**
 * One-time boot intro for the Draft Arena standalone shell.
 * Plays once per browser session on first entry into /drafts/*.
 * Matches the Pick'em / Nexus / RuneDelve "loading into another app" pattern.
 */
export function DraftArenaBoot() {
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
          className="da-mode da-boot fixed inset-0 z-[100] overflow-hidden flex flex-col items-center justify-center px-6"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Subtle arena floor grid */}
          <div
            aria-hidden
            className="da-boot-grid absolute inset-0 pointer-events-none opacity-40"
            style={{
              maskImage: 'linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)',
            }}
          />

          {/* Spotlight flares */}
          <div
            aria-hidden
            className="da-boot-corner-glow absolute inset-0 pointer-events-none"
          />

          {/* Emblem with rotating ring */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative w-32 h-32 mb-7 flex items-center justify-center"
          >
            <motion.div
              className="da-boot-emblem-glow absolute inset-0 rounded-full"
              animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ filter: 'blur(10px)' }}
            />
            <motion.div
              className="da-boot-emblem absolute inset-0 rounded-full border"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
              style={{ borderStyle: 'dashed' }}
            />
            <img
              src={draftEmblem}
              alt="Draft Arena"
              width={104}
              height={104}
              className="da-boot-emblem-img relative w-[104px] h-[104px] object-contain"
            />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="text-center"
          >
            <p className="da-boot-eyebrow text-[10px] font-extrabold uppercase tracking-[0.32em] mb-1.5">
              ◆ DH · Draft League ◆
            </p>
            <h1 className="da-boot-title text-[26px] font-black leading-none tracking-tight">
              Draft Arena
            </h1>
            <p className="text-[10px] font-bold mt-1.5 text-foreground/55">
              Stepping into the war room
            </p>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-8 w-full max-w-[260px]"
          >
            <div className="da-boot-bar-track relative h-1.5 rounded-full overflow-hidden">
              <motion.div
                className="da-boot-bar-fill h-full relative"
                style={{ width: `${progress}%` }}
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
                  className="da-boot-eyebrow text-[9px] font-extrabold uppercase tracking-[0.24em]"
                >
                  {STAGES[stage]}
                </motion.p>
              </AnimatePresence>
              <span className="text-[10px] font-mono tabular-nums text-foreground/55">
                {progress}%
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
