// Sealed Tiles — the very first board mechanic introduced (band 26-50).
//
// Rule on a phone:
//   "Sealed runes can't be chained. Match a rune NEXT TO a seal to break it."
//
// Implementation notes
// --------------------
// • Sealed cells are a deterministic function of the level's generation seed
//   (so every player gets the exact same starting board state).
// • A small number of cells start sealed (1-3) — never the entire board, never
//   so many that the puzzle becomes unreadable on a 5x5 grid.
// • "Adjacent" reuses the same 8-direction adjacency that the chain engine
//   already enforces, so the rule mirrors how players already think about the
//   board.
// • Seals are a separate state layer; the underlying RuneType is unchanged
//   so the visual/glyph stays consistent once the seal breaks.

import { mulberry32, rngInt } from './prng';
import { BOARD_SIZE } from './dungeonGenerator';
import type { Cell } from './boardEngine';

export type SealKey = string; // `${r}-${c}`

export const sealKey = (r: number, c: number): SealKey => `${r}-${c}`;

// Build the initial set of sealed cells for a level.
// Returns an empty Set for levels that don't have the mechanic enabled.
export function buildInitialSeals(seed: number, enabled: boolean): Set<SealKey> {
  const seals = new Set<SealKey>();
  if (!enabled) return seals;
  // Use a derived seed so seal placement is independent from board layout
  // (otherwise nudging board RNG would shift seals too).
  const rng = mulberry32(seed + 7777);
  const count = 1 + rngInt(rng, 3); // 1-3 sealed cells
  let guard = 0;
  while (seals.size < count && guard < 50) {
    const r = rngInt(rng, BOARD_SIZE);
    const c = rngInt(rng, BOARD_SIZE);
    seals.add(sealKey(r, c));
    guard++;
  }
  return seals;
}

// Given the cells just matched in a chain, compute which seals should break.
// A seal breaks if it's adjacent (8-direction) to ANY matched cell.
export function sealsBrokenByChain(seals: Set<SealKey>, chain: Cell[]): SealKey[] {
  const broken: SealKey[] = [];
  for (const k of seals) {
    const [sr, sc] = k.split('-').map(Number);
    const touched = chain.some(c => Math.abs(c.r - sr) <= 1 && Math.abs(c.c - sc) <= 1);
    if (touched) broken.push(k);
  }
  return broken;
}
