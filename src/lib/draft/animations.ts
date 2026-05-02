import { useEffect, useRef, useState } from 'react';
import type { Transition } from 'framer-motion';

/** Shared spring used across draft list rows + pick input feedback. */
export const springSnap: Transition = { type: 'spring', stiffness: 260, damping: 24 };

/** Slow breathing pulse used by the On-the-Clock hero glow. */
export const pulseGlow = {
  initial: { opacity: 0.45 },
  animate: {
    opacity: [0.45, 0.8, 0.45],
    transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const },
  },
};

/**
 * Animate a numeric value from 0 → target on first mount, and tween on
 * subsequent changes. Pure rAF, no deps.
 */
export function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const step = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      const next = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(next);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return display;
}

/**
 * Returns the set of IDs newly added since the previous render. The very
 * first render returns an empty set so we never highlight on initial mount.
 */
export function useFirstSeen<T extends string | number>(ids: T[]): Set<T> {
  const seenRef = useRef<Set<T> | null>(null);
  const [fresh, setFresh] = useState<Set<T>>(new Set());

  useEffect(() => {
    if (seenRef.current == null) {
      seenRef.current = new Set(ids);
      return;
    }
    const next = new Set<T>();
    for (const id of ids) {
      if (!seenRef.current.has(id)) next.add(id);
      seenRef.current.add(id);
    }
    if (next.size > 0) setFresh(next);
  }, [ids]);

  return fresh;
}
