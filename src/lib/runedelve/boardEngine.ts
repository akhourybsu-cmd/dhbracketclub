import { BOARD_SIZE, RUNE_TYPES, type RuneType } from './dungeonGenerator';
import { rngInt, type Rng } from './prng';

export type Cell = { r: number; c: number };

export function isAdjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return (dr + dc) === 1; // orthogonal only
}

export function cellKey(c: Cell): string {
  return `${c.r}-${c.c}`;
}

// Validate a proposed chain: all cells share the same rune type and form a contiguous path of adjacents.
export function isValidChain(grid: RuneType[][], chain: Cell[]): boolean {
  if (chain.length < 3) return false;
  const type = grid[chain[0].r]?.[chain[0].c];
  if (!type) return false;
  for (let i = 0; i < chain.length; i++) {
    const cur = chain[i];
    if (grid[cur.r]?.[cur.c] !== type) return false;
    if (i > 0 && !isAdjacent(chain[i - 1], cur)) return false;
  }
  // No duplicate cells
  const seen = new Set<string>();
  for (const c of chain) {
    const k = cellKey(c);
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

// Apply gravity (remove matched cells, drop above cells), then refill empty cells using rng.
export function resolveBoard(grid: RuneType[][], chain: Cell[], rng: Rng): RuneType[][] {
  const removed = new Set(chain.map(cellKey));
  const next: (RuneType | null)[][] = grid.map(row => row.slice());
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (removed.has(`${r}-${c}`)) next[r][c] = null;
    }
  }
  // Apply gravity column by column.
  for (let c = 0; c < BOARD_SIZE; c++) {
    const stack: RuneType[] = [];
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const v = next[r][c];
      if (v) stack.push(v);
    }
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const v = stack.shift();
      next[r][c] = v ?? RUNE_TYPES[rngInt(rng, RUNE_TYPES.length)];
    }
  }
  return next as RuneType[][];
}
