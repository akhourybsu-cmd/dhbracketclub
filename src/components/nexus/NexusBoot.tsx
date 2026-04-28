import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import nexusEmblem from '@/assets/nexus-emblem.png';

const BOOT_FLAG = 'nx_boot_played_v1';
const DURATION = 1400;

const STAGES = [
  'Powering core systems…',
  'Syncing defense sectors…',
  'Online · Command interface ready',
];

/**
 * Sci-fi boot/initialization overlay for Nexus Defense.
 * Plays once per browser session on first entry into /nexus/*.
 */
export function NexusBoot() {
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
              'radial-gradient(ellipse 70% 50% at 50% 38%, hsl(188 92% 56% / 0.18), transparent 60%),' +
              'radial-gradient(ellipse 90% 60% at 50% 110%, hsl(230 75% 62% / 0.18), transparent 70%),' +
              'linear-gradient(180deg, hsl(218 45% 5%), hsl(220 50% 3%))',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Scanlines */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage:
                'repeating-linear-gradient(180deg, transparent 0px, transparent 2px, hsl(188 92% 56% / 0.08) 2px, hsl(188 92% 56% / 0.08) 3px)',
            }}
          />

          {/* Grid pulse */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(hsl(188 92% 56% / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(188 92% 56% / 0.6) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent 75%)',
            }}
          />

          {/* Emblem with rotating reticle */}
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
                  'radial-gradient(circle at 50% 50%, hsl(188 92% 56% / 0.55), transparent 70%)',
                filter: 'blur(10px)',
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
              style={{
                borderStyle: 'dashed',
                borderColor: 'hsl(188 92% 56% / 0.6)',
                boxShadow:
                  '0 0 24px hsl(188 92% 56% / 0.4), inset 0 0 18px hsl(188 92% 56% / 0.2)',
              }}
            />
            <motion.div
              className="absolute inset-3 rounded-full border"
              animate={{ rotate: -360 }}
              transition={{ duration: 14, ease: 'linear', repeat: Infinity }}
              style={{ borderColor: 'hsl(230 75% 62% / 0.45)', borderStyle: 'dotted' }}
            />
            <img
              src={nexusEmblem}
              alt="Nexus Defense"
              width={104}
              height={104}
              className="relative w-[104px] h-[104px] object-contain"
              style={{ filter: 'drop-shadow(0 0 18px hsl(188 92% 56% / 0.75))' }}
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
              className="nx-title text-[10px] mb-1.5"
              style={{ color: 'hsl(188 92% 56%)' }}
            >
              ◆ DH · Tactical Systems ◆
            </p>
            <h1
              className="nx-title text-[26px] leading-none"
              style={{
                background:
                  'linear-gradient(180deg, hsl(0 0% 100%) 0%, hsl(188 92% 56% / 0.9) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 24px hsl(188 92% 56% / 0.4)',
              }}
            >
              Nexus Defense
            </h1>
            <p className="text-[10px] font-bold mt-1.5" style={{ color: 'hsl(200 18% 78%)' }}>
              Initializing Nexus Grid
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
                background: 'hsl(218 35% 12%)',
                boxShadow:
                  'inset 0 1px 2px hsl(0 0% 0% / 0.7), inset 0 0 0 1px hsl(188 92% 56% / 0.2)',
              }}
            >
              <motion.div
                className="h-full relative"
                style={{
                  width: `${progress}%`,
                  background:
                    'linear-gradient(90deg, hsl(230 75% 62%), hsl(188 92% 56%) 60%, hsl(170 80% 55%))',
                  boxShadow: '0 0 14px hsl(188 92% 56% / 0.85)',
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
                  className="nx-title text-[9px]"
                  style={{ color: 'hsl(188 92% 56%)' }}
                >
                  {STAGES[stage]}
                </motion.p>
              </AnimatePresence>
              <span className="text-[10px] font-mono tabular-nums text-foreground/60">
                {progress}%
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
