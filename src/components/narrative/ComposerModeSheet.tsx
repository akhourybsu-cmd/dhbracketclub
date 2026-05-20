// DH Club — Narrative RPG · Mobile mode selector for the composer
//
// On phones the horizontal chip scroller ate ~36px of vertical space
// and was hard to scan. This component renders the active mode as a
// single tappable button; tapping opens a bottom sheet with the full
// list. Each mode shows its icon + label + a short blurb so the GM /
// player understands what each mode means at-a-glance.
//
// Desktop keeps the existing inline chip row (it has the space).

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp, Check } from 'lucide-react';
import { FLAMINGO } from '@/lib/narrative/flamingoTheme';
import { SPRING_SOFT, TAP_PRESS, haptic } from '@/lib/narrative/motion';

export interface ComposerModeOption<TMode extends string = string> {
  id: TMode;
  label: string;
  blurb: string;
  icon: ReactNode;
  disabled?: boolean;
}

interface TriggerProps<TMode extends string> {
  flamingo: boolean;
  active: ComposerModeOption<TMode>;
  onClick: () => void;
}

/** Single-button trigger that shows the current mode. */
export function ComposerModeTrigger<TMode extends string>({
  flamingo, active, onClick,
}: TriggerProps<TMode>) {
  return (
    <motion.button
      type="button"
      whileTap={TAP_PRESS}
      onClick={() => { haptic('light'); onClick(); }}
      aria-haspopup="dialog"
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition"
      style={flamingo ? {
        background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.18), hsl(${FLAMINGO.violet} / 0.1))`,
        border: `1px solid hsl(${FLAMINGO.pink} / 0.5)`,
        color: `hsl(${FLAMINGO.paper})`,
        boxShadow: `0 0 8px -2px hsl(${FLAMINGO.pink} / 0.45)`,
      } : {
        background: 'hsl(var(--primary) / 0.14)',
        border: '1px solid hsl(var(--primary) / 0.4)',
        color: 'hsl(var(--primary))',
      }}
    >
      <span className="inline-flex items-center gap-1">{active.icon}</span>
      <span className="truncate max-w-[14ch]">{active.label}</span>
      <ChevronUp className="w-3 h-3 opacity-70" />
    </motion.button>
  );
}

interface SheetProps<TMode extends string> {
  open: boolean;
  onClose: () => void;
  flamingo: boolean;
  modes: ComposerModeOption<TMode>[];
  value: TMode;
  onSelect: (next: TMode) => void;
}

/** Bottom sheet that lists every available mode with its blurb. */
export function ComposerModeSheet<TMode extends string>({
  open, onClose, flamingo, modes, value, onSelect,
}: SheetProps<TMode>) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[85] flex items-end justify-center"
          style={{
            background: flamingo
              ? `hsl(${FLAMINGO.midnight} / 0.7)`
              : 'hsl(218 50% 3% / 0.6)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
            transition={SPRING_SOFT}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[78dvh] rounded-t-2xl flex flex-col overflow-hidden"
            style={{
              paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
              background: flamingo
                ? `linear-gradient(180deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`
                : 'hsl(var(--card))',
              border: flamingo
                ? `1px solid hsl(${FLAMINGO.pink} / 0.4)`
                : '1px solid hsl(var(--border) / 0.4)',
              color: flamingo ? `hsl(${FLAMINGO.paper})` : undefined,
            }}
          >
            <div aria-hidden className="flex items-center justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: flamingo ? `hsl(${FLAMINGO.paper} / 0.25)` : 'hsl(var(--border))' }} />
            </div>
            <p
              className="px-4 pt-1 pb-3 text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--muted-foreground) / 0.7)' }}
            >
              Posting as
            </p>
            <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1.5">
              {modes.map(m => {
                const selected = m.id === value;
                return (
                  <motion.button
                    key={m.id}
                    type="button"
                    disabled={m.disabled}
                    whileTap={m.disabled ? undefined : TAP_PRESS}
                    onClick={() => {
                      if (m.disabled) return;
                      haptic('light');
                      onSelect(m.id);
                      onClose();
                    }}
                    className="w-full text-left rounded-xl p-3 flex items-start gap-3 transition disabled:opacity-40"
                    style={selected
                      ? flamingo
                        ? {
                            background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.22), hsl(${FLAMINGO.violet} / 0.12))`,
                            border: `1px solid hsl(${FLAMINGO.pink} / 0.55)`,
                            color: `hsl(${FLAMINGO.paper})`,
                          }
                        : {
                            background: 'hsl(var(--primary) / 0.12)',
                            border: '1px solid hsl(var(--primary) / 0.4)',
                          }
                      : flamingo
                        ? {
                            background: `hsl(${FLAMINGO.ink} / 0.7)`,
                            border: `1px solid hsl(${FLAMINGO.paper} / 0.12)`,
                            color: `hsl(${FLAMINGO.paper} / 0.85)`,
                          }
                        : {
                            background: 'hsl(var(--muted) / 0.25)',
                            border: '1px solid hsl(var(--border) / 0.4)',
                          }}
                  >
                    <span className="flex-shrink-0 mt-0.5" style={{ color: selected
                      ? (flamingo ? `hsl(${FLAMINGO.pink})` : 'hsl(var(--primary))')
                      : (flamingo ? `hsl(${FLAMINGO.paper} / 0.6)` : 'hsl(var(--muted-foreground) / 0.7)') }}>
                      {m.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-extrabold tracking-tight">{m.label}</p>
                      <p
                        className="text-[11px] leading-snug mt-0.5"
                        style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.62)` : 'hsl(var(--muted-foreground) / 0.78)' }}
                      >
                        {m.blurb}
                      </p>
                    </div>
                    {selected && <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: flamingo ? `hsl(${FLAMINGO.pink})` : 'hsl(var(--primary))' }} strokeWidth={3} />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
