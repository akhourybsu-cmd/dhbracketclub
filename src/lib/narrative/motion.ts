// DH Club — Narrative RPG · Motion library
//
// One source of truth for the motion vocabulary the Narrative RPG uses.
// Premium feel comes from restraint: 95% of surfaces use a single
// soft entrance + a tap-scale; the remaining 5% (dice crit, chapter
// drop, scene opener) earn dramatic motion.
//
// All variants honor prefers-reduced-motion by collapsing to opacity-
// only transitions where they're consumed via `motionSafe()` below.
//
// Timing reference (don't tune these per-call — adjust here):
//   • SNAP   90ms  — taps, toggles, instant feedback
//   • CRISP  220ms — entrances, sheet open/close
//   • CINE   450ms — hero reveals (chapter, scene opener)
//   • EPIC   900ms — once-in-a-while moments (crit celebrate fade)
//
// Eases:
//   • EASE_OUT_QUART  — most entrances. Decelerates fast and settles.
//   • SPRING_SOFT     — list items, tap pops. Gentle overshoot.
//   • SPRING_HERO     — dice total reveal, count-up. Confident bounce.

import type { Variants, Transition, MotionProps } from 'framer-motion';

export const TIMING = {
  snap: 0.09,
  crisp: 0.22,
  cine: 0.45,
  epic: 0.9,
} as const;

export const EASE_OUT_QUART: Transition['ease'] = [0.22, 1, 0.36, 1];

export const SPRING_SOFT: Transition = {
  type: 'spring',
  stiffness: 240,
  damping: 22,
  mass: 0.9,
};

export const SPRING_HERO: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 18,
  mass: 1.1,
};

/** Default entrance for cards / tiles / list rows. Subtle lift + fade. */
export const ENTER_LIFT: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: TIMING.crisp, ease: EASE_OUT_QUART } },
  exit:    { opacity: 0, y: -4, transition: { duration: TIMING.snap, ease: EASE_OUT_QUART } },
};

/** Entrance with a confident spring overshoot. Use for hero elements. */
export const ENTER_SPRING: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: SPRING_SOFT },
  exit:    { opacity: 0, y: 8, scale: 0.98, transition: { duration: TIMING.snap, ease: EASE_OUT_QUART } },
};

/** Stagger container for message streams + card grids. */
export const STAGGER_PARENT: Variants = {
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0 } },
};

/** Child variant designed to nest under STAGGER_PARENT. */
export const STAGGER_CHILD: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: TIMING.crisp, ease: EASE_OUT_QUART } },
};

/** Tap response — physical-feeling scale press. Apply via `whileTap`. */
export const TAP_PRESS: MotionProps['whileTap'] = { scale: 0.96 };
export const TAP_PRESS_FIRM: MotionProps['whileTap'] = { scale: 0.93 };

/** Hover lift — desktop only, framer ignores on touch. */
export const HOVER_LIFT: MotionProps['whileHover'] = { y: -2 };

/** Cinematic full-screen overlay used by the chapter-drop hero. */
export const HERO_OVERLAY: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: TIMING.crisp, ease: EASE_OUT_QUART } },
  exit:    { opacity: 0, transition: { duration: TIMING.cine, ease: EASE_OUT_QUART } },
};

/** Hero-content reveal — used for chapter title inside the overlay. */
export const HERO_CONTENT: Variants = {
  initial: { opacity: 0, y: 28, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { ...SPRING_HERO, delay: 0.05 } },
  exit:    { opacity: 0, y: -20, scale: 0.96, transition: { duration: TIMING.crisp, ease: EASE_OUT_QUART } },
};

/** Subtle pulse used to draw the eye to a fresh draft / new clue. */
export const PULSE_HIGHLIGHT: Variants = {
  initial: { boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
  animate: {
    boxShadow: [
      '0 0 0 0 rgba(255,255,255,0)',
      '0 0 24px 8px rgba(255,255,255,0.06)',
      '0 0 0 0 rgba(255,255,255,0)',
    ],
    transition: { duration: 1.4, ease: EASE_OUT_QUART, repeat: 1 },
  },
};

/** Tiny haptic suggestion for premium tap feel. Uses navigator.vibrate
 *  where available; gracefully no-ops elsewhere (desktop, Safari iOS
 *  without permission). Call from event handlers — keep durations
 *  short so it never feels like a notification. */
export function haptic(intensity: 'light' | 'medium' | 'success' | 'fail' = 'light') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    const ms =
      intensity === 'light'   ? 8
    : intensity === 'medium'  ? 16
    : intensity === 'success' ? [10, 30, 10]
    :                            [40, 60, 40];
    navigator.vibrate(ms as any);
  } catch {
    // some browsers throw if not user-gesture initiated — ignore.
  }
}

/** Returns motion props that respect prefers-reduced-motion: when the
 *  user has reduced motion enabled, we fall back to opacity-only on
 *  the same duration so layouts don't jank. */
export function motionSafe(variants: Variants): { variants: Variants } {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return {
      variants: {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: TIMING.crisp } },
        exit:    { opacity: 0, transition: { duration: TIMING.snap } },
      },
    };
  }
  return { variants };
}

/** Count-up animation target value for tabular-num readouts like the
 *  d20 total. framer-motion's `useMotionValue` + `useTransform` can
 *  drive this; the spring config below gives a confident pop. */
export const COUNT_UP_SPRING: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 14,
  mass: 0.8,
};
