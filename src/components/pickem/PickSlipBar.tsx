import { Check, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Sticky bottom Pick Card — non-gambling pick summary.
 * Mobile-first; respects safe-area; collapses to a single bar.
 */
export function PickSlipBar({
  picked,
  total,
  remaining,
  status,
}: {
  picked: number;
  total: number;
  remaining: number;
  status: 'open' | 'partial' | 'complete' | 'locked';
}) {
  const [open, setOpen] = useState(false);

  if (total === 0) return null;

  const pct = Math.round((picked / total) * 100);
  const allDone = remaining === 0;

  const label =
    status === 'locked' ? 'All picks locked'
    : allDone ? 'Your card is complete'
    : `${remaining} pick${remaining === 1 ? '' : 's'} remaining`;

  const accent =
    status === 'locked' ? 'hsl(var(--muted-foreground))'
    : allDone ? 'hsl(var(--success))'
    : 'hsl(var(--gold))';

  return (
    <div
      className="fixed left-0 right-0 z-30 px-3"
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-[640px] mx-auto">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'w-full pk-scorebug px-4 py-2.5 flex items-center gap-3 active:scale-[0.99] transition-transform',
            'backdrop-blur-md',
          )}
          style={{ borderColor: `${accent.replace(')', ' / 0.45)')}`, boxShadow: `0 -2px 16px ${accent.replace(')', ' / 0.18)')}, var(--shadow-card)` }}
          aria-expanded={open}
        >
          {/* Status orb */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${accent.replace(')', ' / 0.15)')}`, border: `1px solid ${accent.replace(')', ' / 0.45)')}` }}
          >
            {allDone || status === 'locked' ? (
              <Check className="w-4 h-4" style={{ color: accent }} />
            ) : (
              <span className="text-[11px] font-extrabold tabular-nums" style={{ color: accent }}>
                {picked}
              </span>
            )}
          </div>

          {/* Text + progress */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: accent }}>
              Pick Card
            </p>
            <p className="text-[12px] font-extrabold text-white truncate">{label}</p>
            <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: accent, boxShadow: `0 0 8px ${accent.replace(')', ' / 0.6)')}` }}
              />
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-[14px] font-extrabold tabular-nums leading-none text-white">
              {picked}<span className="text-white/55 text-[11px]">/{total}</span>
            </p>
            <ChevronUp
              className={cn('w-3.5 h-3.5 text-white/60 mt-1 transition-transform inline-block', open && 'rotate-180')}
            />
          </div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 6, height: 0 }}
              transition={{ duration: 0.18 }}
              className="mt-1.5 pk-scorebug p-3 text-[11px] text-white/75 leading-relaxed"
            >
              <p>
                <strong className="text-white">Picks close at kickoff.</strong> You can change a pick anytime
                before its game starts. Each correct pick earns 1 point — climb the standings.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
