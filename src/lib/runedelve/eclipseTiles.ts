// Eclipse Tiles (Band L56-L65) — dimmed runes can't START a chain but can
// EXTEND one normally. Forces players to plan their starting cell carefully.
//
// Engine model:
//   • A small set of "eclipsed" cells are placed deterministically per-level.
//   • Eclipsed state is permanent for the entire level (not consumed when the
//     rune clears — when a fresh rune spawns into the cell it remains eclipsed).
//   • Chain validation passes the eclipse set and rejects chains whose FIRST
//     cell is eclipsed. All other chain rules are unchanged.
//
// Visual: tile rendered at ~60% opacity with a thin dim ring (handled by
// RuneCell when an `eclipsed` prop is true).

import { mulberry32, rngInt } from './prng';
import { BOARD_SIZE } from './dungeonGenerator';

export type EclipseSet = Set<string>;

export function buildInitialEclipse(seed: number, enabled: boolean, seals?: Set<string>): EclipseSet {
  const eclipse: EclipseSet = new Set();
  if (!enabled) return eclipse;
  const rng = mulberry32(seed + 5151);
  const count = 2 + rngInt(rng, 2); // 2-3 eclipsed cells
  let guard = 0;
  while (eclipse.size < count && guard < 60) {
    guard += 1;
    const r = rngInt(rng, BOARD_SIZE);
    const c = rngInt(rng, BOARD_SIZE);
    const k = `${r}-${c}`;
    if (seals?.has(k)) continue;
    eclipse.add(k);
  }
  return eclipse;
}

/** True if `start` cannot legally begin a chain due to eclipse state. */
export function isEclipsedStart(eclipse: EclipseSet, startKey: string): boolean {
  return eclipse.has(startKey);
}
