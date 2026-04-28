// Battlefield grid: 7 cols × 9 rows. Single S-curve path to fit portrait.
// Build tiles flank the path. Coordinates are { col, row }.

export const GRID_COLS = 7;
export const GRID_ROWS = 9;

export interface Cell { col: number; row: number; }

// Path cells in order (enemy traversal)
export const PATH: Cell[] = [
  { col: 0, row: 0 },
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 3, row: 0 },
  { col: 3, row: 1 },
  { col: 3, row: 2 },
  { col: 4, row: 2 },
  { col: 5, row: 2 },
  { col: 5, row: 3 },
  { col: 5, row: 4 },
  { col: 4, row: 4 },
  { col: 3, row: 4 },
  { col: 2, row: 4 },
  { col: 1, row: 4 },
  { col: 1, row: 5 },
  { col: 1, row: 6 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  { col: 5, row: 7 },
  { col: 5, row: 8 },
  { col: 6, row: 8 }, // nexus core
];

const pathSet = new Set(PATH.map(c => `${c.col},${c.row}`));
export function isPath(col: number, row: number): boolean {
  return pathSet.has(`${col},${row}`);
}

// Build tiles = every non-path cell that touches the path orthogonally
const buildList: Cell[] = [];
for (let r = 0; r < GRID_ROWS; r++) {
  for (let c = 0; c < GRID_COLS; c++) {
    if (isPath(c, r)) continue;
    const adj = [
      [c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1],
    ];
    if (adj.some(([cc, rr]) => isPath(cc, rr))) buildList.push({ col: c, row: r });
  }
}
export const BUILD_TILES: Cell[] = buildList;
const buildSet = new Set(BUILD_TILES.map(c => `${c.col},${c.row}`));
export function isBuildable(col: number, row: number): boolean {
  return buildSet.has(`${col},${row}`);
}

export const NEXUS_CELL: Cell = PATH[PATH.length - 1];

// Convert a path-progress (index + fractional 0..1) to (x, y) in cell units
export function pathToXY(pathIndex: number, progress: number): { x: number; y: number } {
  const a = PATH[Math.min(pathIndex, PATH.length - 1)];
  const b = PATH[Math.min(pathIndex + 1, PATH.length - 1)];
  return {
    x: a.col + (b.col - a.col) * progress,
    y: a.row + (b.row - a.row) * progress,
  };
}

export function distanceCells(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
