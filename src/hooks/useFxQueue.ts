import { useCallback, useRef, useState } from 'react';
import type { RuneType } from '@/lib/runedelve/dungeonGenerator';
import type { HeroClass } from '@/lib/runedelve/classConfig';

export type FxKind = 'rune' | 'ability';

export interface FxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RuneFx {
  id: string;
  kind: 'rune';
  rune: RuneType;
  length: number;
  tier: 'normal' | 'big' | 'huge'; // 6, 7, 8+
  origin?: FxRect;
  target?: FxRect;
}

export interface AbilityFx {
  id: string;
  kind: 'ability';
  cls: HeroClass;
  origin?: FxRect;
  target?: FxRect;
}

export type FxEntry = RuneFx | AbilityFx;

let _seq = 0;
const nextId = () => `fx-${++_seq}`;

const MAX_QUEUE = 2;

export function useFxQueue() {
  const [queue, setQueue] = useState<FxEntry[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const trigger = useCallback((entry: Omit<FxEntry, 'id'>) => {
    setQueue(prev => {
      const next = [...prev, { ...entry, id: nextId() } as FxEntry];
      // Drop oldest if exceeding cap.
      return next.length > MAX_QUEUE ? next.slice(next.length - MAX_QUEUE) : next;
    });
  }, []);

  const complete = useCallback((id: string) => {
    setQueue(prev => prev.filter(e => e.id !== id));
  }, []);

  return { queue, trigger, complete };
}
