// DH Club — Narrative RPG · Generic entity detail sheet
//
// One mobile-friendly bottom sheet used by every World/Cast tab card
// (NPC, clue, faction, location, clock). Cards show a one-line summary;
// tap opens this sheet with the full details — solves the mobile
// "everything is crammed inline" complaint without changing data shape.
//
// Theme-aware: a Flamingo campaign renders with neon accents, a
// generic campaign uses calm-shell defaults. Drawer slides up from
// the bottom, respects safe-area inset, dismisses on backdrop tap or
// the X button.
//
// Designed as a presentation primitive — the parent passes title +
// eyebrow + sections of content. Sections are arbitrary ReactNodes so
// callers can mix DossierRow / FlamingoMeter / FlamingoClueMarker
// / plain text however they need.

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { FLAMINGO } from '@/lib/narrative/flamingoTheme';
import { SPRING_SOFT, TAP_PRESS } from '@/lib/narrative/motion';

export interface DetailSheetSection {
  /** Short uppercase eyebrow label (e.g. "Description", "Heat", "Motives"). */
  label: string;
  /** Section content. Pass strings or fully-styled JSX. */
  content: ReactNode;
  /** Accent color override for the eyebrow label. Defaults to the
   *  sheet's tone. */
  accent?: string;
  /** GM-only marker — renders an amber lock chip next to the label. */
  gmOnly?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Short eyebrow above the title (e.g. "NPC · Crew boss"). */
  eyebrow?: string;
  title: string;
  /** Optional accent color hint for the title gradient stripe. */
  accent?: string;
  /** Ordered list of sections rendered top-to-bottom. */
  sections: DetailSheetSection[];
  /** When true, uses Flamingo neon tokens. */
  flamingo?: boolean;
  /** Optional footer slot — typically GM action buttons (Edit / Delete). */
  footer?: ReactNode;
}

export function NarrativeDetailSheet({
  open, onClose, eyebrow, title, accent, sections, flamingo, footer,
}: Props) {
  if (typeof document === 'undefined') return null;
  const stripe = accent ?? (flamingo ? FLAMINGO.pink : 'var(--primary)');

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[80] flex items-end justify-center"
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
            className="relative w-full max-w-md max-h-[88dvh] rounded-t-2xl flex flex-col overflow-hidden"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              background: flamingo
                ? `linear-gradient(180deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`
                : 'hsl(var(--card))',
              border: flamingo
                ? `1px solid hsl(${FLAMINGO.pink} / 0.4)`
                : '1px solid hsl(var(--border) / 0.4)',
              color: flamingo ? `hsl(${FLAMINGO.paper})` : undefined,
              boxShadow: flamingo
                ? `0 -8px 32px -8px hsl(${stripe} / 0.45)`
                : '0 -8px 32px -8px hsl(0 0% 0% / 0.4)',
            }}
          >
            {/* Drag handle */}
            <div aria-hidden className="flex items-center justify-center pt-2 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: flamingo ? `hsl(${FLAMINGO.paper} / 0.25)` : 'hsl(var(--border))' }}
              />
            </div>

            {/* Header */}
            <div className="px-4 pt-1 pb-3 flex items-start gap-3">
              <div
                aria-hidden
                className="w-1 self-stretch rounded-full flex-shrink-0"
                style={{ background: `hsl(${stripe})`, boxShadow: flamingo ? `0 0 8px hsl(${stripe} / 0.6)` : undefined }}
              />
              <div className="min-w-0 flex-1">
                {eyebrow && (
                  <p
                    className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                    style={{ color: `hsl(${stripe})` }}
                  >
                    {eyebrow}
                  </p>
                )}
                <h2
                  className="font-display text-[19px] sm:text-[22px] font-extrabold tracking-tight leading-[1.15] break-words mt-0.5"
                  style={flamingo ? {
                    backgroundImage: `linear-gradient(90deg, hsl(${FLAMINGO.paper}), hsl(${stripe}))`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                  } : undefined}
                >
                  {title}
                </h2>
              </div>
              <motion.button
                type="button"
                whileTap={TAP_PRESS}
                onClick={onClose}
                aria-label="Close"
                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                style={flamingo ? {
                  background: `hsl(${FLAMINGO.ink})`,
                  border: `1px solid hsl(${FLAMINGO.pink} / 0.4)`,
                  color: `hsl(${FLAMINGO.paper})`,
                } : {
                  background: 'hsl(var(--muted) / 0.4)',
                  border: '1px solid hsl(var(--border) / 0.4)',
                }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
              {sections.map((s, i) => (
                <section key={i}>
                  <p
                    className="text-[10px] font-extrabold uppercase tracking-[0.22em] mb-1.5 inline-flex items-center gap-1.5"
                    style={{ color: `hsl(${s.accent ?? stripe})` }}
                  >
                    {s.label}
                    {s.gmOnly && (
                      <span
                        className="inline-flex items-center px-1 py-px rounded text-[8.5px]"
                        style={flamingo ? {
                          background: `hsl(${FLAMINGO.gmAmber} / 0.2)`,
                          color: `hsl(${FLAMINGO.gmAmber})`,
                          border: `1px solid hsl(${FLAMINGO.gmAmber} / 0.5)`,
                        } : {
                          background: 'hsl(var(--warning) / 0.12)',
                          color: 'hsl(var(--warning))',
                          border: '1px solid hsl(var(--warning) / 0.4)',
                        }}
                      >
                        GM ONLY
                      </span>
                    )}
                  </p>
                  <div
                    className="text-[12.5px] leading-relaxed"
                    style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.92)` : 'hsl(var(--foreground) / 0.92)' }}
                  >
                    {s.content}
                  </div>
                </section>
              ))}
            </div>

            {footer && (
              <div
                className="px-4 py-3 border-t flex-shrink-0"
                style={{ borderColor: flamingo ? `hsl(${FLAMINGO.paper} / 0.12)` : 'hsl(var(--border) / 0.4)' }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
