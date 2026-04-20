// Corrupted Tiles — Band 3 (levels 76-100).
//
// Mobile-friendly rule:
//   "Corruption spreads each turn. Clear the source (☠️) or be overrun.
//    Matching a corrupted rune costs you HP."
//
// Design constraints (kept tight on purpose):
// • Deterministic from the level seed so two players see the same start.
// • At most 2 sources at intro, scaling to 2 deeper in the band — never
//   so many that a 5x5 board feels uncrackable on a phone.
// • Corruption is a separate state layer (Set of "r-c" keys + Set of source
//   keys) so it composes with seals without coupling.
// • Spread is GENTLE: 1 cell per source per turn, only to orthogonal
//   neighbours, with a hard cap. The skill loop is "kill the source first".
// • Cost-to-clear: matching a chain that includes corruption deals
//   `CORRUPTION_BITE` HP per corrupted cell — small enough to absorb early,
//   meaningful when the board is overgrown. Encourages clearing fast.
// • Matching a SOURCE removes it permanently (the "kill the spreader" beat).
// • Once all sources are gone, existing corruption stops spreading but
//   remains on the board until matched away.

import { mulberry32, rngInt } from './prng';
import { BOARD_SIZE } from './dungeonGenerator';
import type { Cell } from './boardEngine';

export type CorruptKey = string; // `${r}-${c}`

export const corruptKey = (r: number, c: number): CorruptKey => `${r}-${c}`;

/** HP damage per corrupted cell included in a matched chain. */
export const CORRUPTION_BITE = 4;

/** Hard cap on total corrupted cells so the board stays playable. */
export const CORRUPTION_CAP = 7;

export interface CorruptionState {
  /** Every currently-corrupted cell, including sources. */
  cells: Set<CorruptKey>;
  /** The subset of `cells` that actively spread each turn. */
  sources: Set<CorruptKey>;
}

export function emptyCorruption(): CorruptionState {
  return { cells: new Set(), sources: new Set() };
}

/**
 * Build the initial corruption layout for a level. We place 1-2 sources for
 * intro levels (76-85), 2 sources from 86 onward. Sources are spaced so
 * spread doesn't immediately clump into a single quadrant.
 */
export function buildInitialCorruption(
  seed: number,
  enabled: boolean,
  level: number,
  blocked?: Set<string>, // e.g. sealed cells — never corrupt those
): CorruptionState {
  if (!enabled) return emptyCorruption();
  const rng = mulberry32(seed ^ 0xc0ff);
  const sourceCount = level >= 86 ? 2 : 1 + rngInt(rng, 2); // 1 or 2 → 2
  const sources = new Set<CorruptKey>();
  const cells = new Set<CorruptKey>();
  let guard = 0;
  while (sources.size < sourceCount && guard < 60) {
    guard++;
    const r = rngInt(rng, BOARD_SIZE);
    const c = rngInt(rng, BOARD_SIZE);
    const k = corruptKey(r, c);
    if (blocked?.has(k)) continue;
    // Keep sources at least 2 cells apart so spread fronts don't merge instantly.
    let ok = true;
    for (const existing of sources) {
      const [er, ec] = existing.split('-').map(Number);
      if (Math.abs(er - r) + Math.abs(ec - c) < 2) { ok = false; break; }
    }
    if (!ok) continue;
    sources.add(k);
    cells.add(k);
  }
  return { cells, sources };
}

/**
 * Advance corruption by one tick. Each source attempts to spread to one
 * random orthogonal neighbour that is not already corrupted, not sealed,
 * and inside the board. Stops once we hit `CORRUPTION_CAP`.
 *
 * Pure: returns a fresh state instead of mutating.
 */
export function spreadCorruption(
  state: CorruptionState,
  rngTick: number,
  seed: number,
  blocked?: Set<string>,
): CorruptionState {
  if (state.sources.size === 0) return state;
  if (state.cells.size >= CORRUPTION_CAP) return state;
  const rng = mulberry32((seed ^ 0xb10b) + rngTick * 31);
  const cells = new Set(state.cells);
  for (const src of state.sources) {
    if (cells.size >= CORRUPTION_CAP) break;
    const [r, c] = src.split('-').map(Number);
    const candidates: CorruptKey[] = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
      const k = corruptKey(nr, nc);
      if (cells.has(k)) continue;
      if (blocked?.has(k)) continue;
      candidates.push(k);
    }
    if (!candidates.length) continue;
    const pick = candidates[rngInt(rng, candidates.length)];
    cells.add(pick);
  }
  return { cells, sources: new Set(state.sources) };
}

/**
 * Apply chain results to corruption state:
 *   - Any source included in the chain is destroyed (removed from sources).
 *   - Any corrupted cell included in the chain is cleared (removed from cells).
 * Returns the new state PLUS the HP cost for the chain.
 */
export function resolveChainAgainstCorruption(
  state: CorruptionState,
  chain: Cell[],
): { next: CorruptionState; hpCost: number; sourcesCleared: number } {
  if (state.cells.size === 0) {
    return { next: state, hpCost: 0, sourcesCleared: 0 };
  }
  const cells = new Set(state.cells);
  const sources = new Set(state.sources);
  let hits = 0;
  let sourcesCleared = 0;
  for (const c of chain) {
    const k = corruptKey(c.r, c.c);
    if (cells.has(k)) {
      hits++;
      cells.delete(k);
      if (sources.has(k)) {
        sources.delete(k);
        sourcesCleared++;
      }
    }
  }
  return {
    next: { cells, sources },
    hpCost: hits * CORRUPTION_BITE,
    sourcesCleared,
  };
}
