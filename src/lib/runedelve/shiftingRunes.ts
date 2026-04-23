// Shifting Runes (Band L36-L45) — one column slides down by 1 each turn.
//
// Engine model:
//   • The level seed deterministically picks ONE column index on level start.
//   • Each turn, after enemiesAttack resolves, that column shifts down by 1:
//       - the bottom rune drops off the board
//       - all other runes in the column slide down one row
//       - a fresh rune spawns at the top from the level RNG
//   • Sealed cells in the shifting column anchor in place (they're walls).
//   • Other mechanic state (linked pairs, eclipse) updates indices through the
//     same shift helper so cell coordinates stay consistent.
//
// Mobile-first design choice: down-direction (recommended in plan) pairs with
// the existing gravity system, so players already understand the motion.

import { BOARD_SIZE, RUNE_TYPES, type RuneType } from './dungeonGenerator';
import { mulberry32, rngInt, type Rng } from './prng';

export interface ShiftState {
  /** The column index that drifts each turn, or -1 if mechanic disabled. */
  column: number;
}

export function buildInitialShift(seed: number, enabled: boolean): ShiftState {
  if (!enabled) return { column: -1 };
  const rng = mulberry32(seed + 4242);
  return { column: rngInt(rng, BOARD_SIZE) };
}

/**
 * Apply a single down-shift to the configured column. Returns a NEW grid.
 * Sealed cells in this column act like fixed pegs — runes above them slide
 * down only as far as the next seal (or the floor).
 */
export function applyShift(
  grid: RuneType[][],
  shift: ShiftState,
  rng: Rng,
  seals?: Set<string>,
): RuneType[][] {
  if (shift.column < 0) return grid;
  const c = shift.column;
  const next = grid.map(row => row.slice());

  // Walk top→bottom, building gravity segments that respect seals.
  let segmentTop = 0;
  for (let r = 0; r <= BOARD_SIZE; r += 1) {
    const isFloor = r === BOARD_SIZE;
    const isSealed = !isFloor && (seals?.has(`${r}-${c}`) ?? false);
    if (!isFloor && !isSealed) continue;
    // Segment is rows [segmentTop, r-1] inclusive.
    if (segmentTop <= r - 1) {
      // Drop the bottom of this segment off and slide the rest down by 1.
      // Then spawn a new rune at the top of the segment.
      for (let rr = r - 1; rr > segmentTop; rr -= 1) {
        next[rr][c] = next[rr - 1][c];
      }
      next[segmentTop][c] = RUNE_TYPES[rngInt(rng, RUNE_TYPES.length)];
    }
    segmentTop = r + 1;
  }
  return next;
}

/** UI helper — true if this column should render the drift indicator. */
export function isShiftingColumn(shift: ShiftState, c: number): boolean {
  return shift.column === c;
}
