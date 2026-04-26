import { useEffect, useState, useCallback } from 'react';

/**
 * Light-weight floating combat number layer. Holds a small stack of
 * numbers (damage, heal, mana, shield) anchored to a screen-space point
 * and self-evicts each entry after its CSS animation completes.
 *
 * The parent owns the array and triggers `add()` from any combat event.
 */
export type FloaterKind = 'damage' | 'heal' | 'mana' | 'shield' | 'crit' | 'block';

export interface Floater {
  id: string;
  /** Page-space coords (clientX/clientY equivalents). */
  x: number;
  y: number;
  text: string;
  kind: FloaterKind;
  /** Optional small horizontal jitter so multiple floaters fan out. */
  dx?: number;
}

const COLOR: Record<FloaterKind, string> = {
  damage: 'hsl(var(--destructive))',
  heal:   'hsl(var(--success))',
  mana:   'hsl(215 90% 70%)',
  shield: 'hsl(var(--gold))',
  crit:   'hsl(var(--gold))',
  block:  'hsl(var(--muted-foreground))',
};

const PREFIX: Record<FloaterKind, string> = {
  damage: '-',
  heal:   '+',
  mana:   '+',
  shield: '+',
  crit:   '',
  block:  '',
};

interface Props {
  floaters: Floater[];
  onComplete: (id: string) => void;
}

export function FloatingNumberLayer({ floaters, onComplete }: Props) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[55]">
      {floaters.map(f => (
        <FloaterNode key={f.id} f={f} onDone={() => onComplete(f.id)} />
      ))}
    </div>
  );
}

function FloaterNode({ f, onDone }: { f: Floater; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 950);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <span
      className="rd-floater"
      style={{
        left: f.x + (f.dx ?? 0),
        top: f.y,
        color: COLOR[f.kind],
        fontSize: f.kind === 'crit' ? 18 : 13,
      }}
    >
      {f.kind === 'crit' ? '✦ CRIT' : `${PREFIX[f.kind]}${f.text}${f.kind === 'shield' ? ' SHLD' : ''}`}
    </span>
  );
}

/* ─── Hook for managing a floater queue ───────────────────────────── */

let _id = 0;
const nextId = () => `flt-${++_id}`;

const MAX = 12;

export function useFloaters() {
  const [floaters, setFloaters] = useState<Floater[]>([]);

  const add = useCallback((entry: Omit<Floater, 'id'>) => {
    setFloaters(prev => {
      const next = [...prev, { ...entry, id: nextId() }];
      return next.length > MAX ? next.slice(next.length - MAX) : next;
    });
  }, []);

  /** Convenience: anchor to a DOM element, optionally with a vertical offset. */
  const addAt = useCallback(
    (el: Element | null | undefined, entry: Omit<Floater, 'id' | 'x' | 'y'>, yOffset = -8) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      add({
        ...entry,
        x: r.left + r.width / 2,
        y: r.top + yOffset,
        dx: ((Math.random() - 0.5) * 24) | 0,
      });
    },
    [add],
  );

  const complete = useCallback((id: string) => {
    setFloaters(prev => prev.filter(f => f.id !== id));
  }, []);

  return { floaters, add, addAt, complete };
}
