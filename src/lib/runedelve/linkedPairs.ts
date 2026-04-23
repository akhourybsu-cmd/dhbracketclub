// Linked Pairs (Band L46-L55) — some runes are bound together by a glowing
// thread. When you match ONE half of a pair, its twin instantly clears too.
//
// Engine model:
//   • A small number of pairs (1-2) are placed deterministically from the
//     level seed. Each pair links two random NON-sealed cells.
//   • Pairs are stored as a Map<cellKey, cellKey> (bidirectional).
//   • When a chain resolves, ANY cell whose key is in the map causes its twin
//     to be added to the "extra cleared" set.
//   • Twins grant +25% extra score for the run (encourages going for them).
//
// Pairs survive across turns until BOTH halves have been cleared at least
// once. After a half is cleared, the link to its twin is dropped (the twin
// becomes a normal rune).

import { mulberry32, rngInt } from './prng';
import { BOARD_SIZE } from './dungeonGenerator';
import type { Cell } from './boardEngine';
import { cellKey } from './boardEngine';

export type LinkedPairsMap = Map<string, string>;

export interface LinkedPairsState {
  pairs: LinkedPairsMap;
}

export function buildInitialPairs(seed: number, enabled: boolean, seals?: Set<string>): LinkedPairsState {
  const pairs: LinkedPairsMap = new Map();
  if (!enabled) return { pairs };
  const rng = mulberry32(seed + 9191);
  const pairCount = 1 + rngInt(rng, 2); // 1 or 2 pairs
  const used = new Set<string>(seals ? Array.from(seals) : []);
  let guard = 0;
  while (pairs.size / 2 < pairCount && guard < 80) {
    guard += 1;
    const aR = rngInt(rng, BOARD_SIZE);
    const aC = rngInt(rng, BOARD_SIZE);
    const bR = rngInt(rng, BOARD_SIZE);
    const bC = rngInt(rng, BOARD_SIZE);
    const aK = `${aR}-${aC}`;
    const bK = `${bR}-${bC}`;
    if (aK === bK) continue;
    if (used.has(aK) || used.has(bK)) continue;
    used.add(aK); used.add(bK);
    pairs.set(aK, bK);
    pairs.set(bK, aK);
  }
  return { pairs };
}

/** Cells that should ALSO clear when the given chain resolves. */
export function pairsTriggeredByChain(state: LinkedPairsState, chain: Cell[]): Cell[] {
  if (state.pairs.size === 0) return [];
  const chainSet = new Set(chain.map(cellKey));
  const extra: Cell[] = [];
  const seen = new Set<string>();
  for (const c of chain) {
    const k = cellKey(c);
    const twin = state.pairs.get(k);
    if (!twin || chainSet.has(twin) || seen.has(twin)) continue;
    seen.add(twin);
    const [tr, tc] = twin.split('-').map(Number);
    extra.push({ r: tr, c: tc });
  }
  return extra;
}

/** Drop links for any cells that just cleared. Mutates the state. */
export function consumePairs(state: LinkedPairsState, clearedKeys: string[]): void {
  for (const k of clearedKeys) {
    const twin = state.pairs.get(k);
    if (twin) {
      state.pairs.delete(k);
      state.pairs.delete(twin);
    }
  }
}

/** UI helper — return the linked twin's key for rendering a connector line. */
export function getPairTwin(state: LinkedPairsState, key: string): string | undefined {
  return state.pairs.get(key);
}
