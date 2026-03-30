// Custom maze system for DH Lockbox
// Cell types: 0=open, 1=wall, 2=mine, 3=start, 4=goal

export type CellType = 0 | 1 | 2 | 3 | 4;

export interface MazeGrid {
  size: number;
  grid: CellType[][];
}

export const CELL_LABELS: Record<CellType, string> = {
  0: 'Open',
  1: 'Wall',
  2: 'Mine',
  3: 'Start',
  4: 'Goal',
};

export const CELL_ICONS: Record<CellType, string> = {
  0: '⬜',
  1: '🧱',
  2: '💣',
  3: '🟢',
  4: '🏁',
};

export const MAZE_SIZE = 5;

export const LOCKBOX_COLORS = [
  { name: 'Red', value: 'hsl(0 72% 55%)' },
  { name: 'Blue', value: 'hsl(220 80% 55%)' },
  { name: 'Green', value: 'hsl(152 72% 46%)' },
  { name: 'Yellow', value: 'hsl(45 93% 52%)' },
  { name: 'Purple', value: 'hsl(270 70% 55%)' },
];

export const LOCKBOX_DIGITS = [0, 1, 2, 3, 4, 5];

// Create an empty 5x5 grid
export function createEmptyGrid(): CellType[][] {
  return Array.from({ length: MAZE_SIZE }, () =>
    Array.from({ length: MAZE_SIZE }, () => 0 as CellType)
  );
}

// Find start position in grid
export function findCell(grid: CellType[][], type: CellType): [number, number] | null {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === type) return [r, c];
    }
  }
  return null;
}

// BFS pathfinding that treats mines as open (for validation — path must exist ignoring mines)
export function findPath(grid: CellType[][], ignoreMines: boolean): [number, number][] | null {
  const start = findCell(grid, 3);
  const goal = findCell(grid, 4);
  if (!start || !goal) return null;

  const size = grid.length;
  const queue: { pos: [number, number]; path: [number, number][] }[] = [
    { pos: start, path: [start] },
  ];
  const visited = new Set<string>();
  visited.add(`${start[0]},${start[1]}`);
  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;
    if (pos[0] === goal[0] && pos[1] === goal[1]) return path;
    for (const [dr, dc] of dirs) {
      const nr = pos[0] + dr;
      const nc = pos[1] + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && !visited.has(key)) {
        const cell = grid[nr][nc];
        // Walls block. Mines block unless we're ignoring them (for validation).
        if (cell === 1) continue;
        if (cell === 2 && !ignoreMines) continue;
        visited.add(key);
        queue.push({ pos: [nr, nc], path: [...path, [nr, nc]] });
      }
    }
  }
  return null;
}

// Count all distinct paths (BFS-style with DFS for counting)
function countPaths(grid: CellType[][]): number {
  const start = findCell(grid, 3);
  const goal = findCell(grid, 4);
  if (!start || !goal) return 0;

  const size = grid.length;
  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  let count = 0;

  function dfs(r: number, c: number, visited: Set<string>) {
    if (r === goal![0] && c === goal![1]) { count++; return; }
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && !visited.has(key)) {
        const cell = grid[nr][nc];
        if (cell === 1 || cell === 2) continue; // walls and mines block the safe path
        visited.add(key);
        dfs(nr, nc, visited);
        visited.delete(key);
      }
    }
  }

  const visited = new Set<string>();
  visited.add(`${start[0]},${start[1]}`);
  dfs(start[0], start[1], visited);
  return count;
}

// Validate maze for saving
export interface MazeValidation {
  valid: boolean;
  errors: string[];
}

export function validateMaze(grid: CellType[][]): MazeValidation {
  const errors: string[] = [];

  const start = findCell(grid, 3);
  const goal = findCell(grid, 4);

  if (!start) errors.push('Place a Start tile');
  if (!goal) errors.push('Place a Goal tile');

  if (start && goal) {
    // Check path exists ignoring mines (so mines don't make it impossible)
    const pathIgnoringMines = findPath(grid, true);
    if (!pathIgnoringMines) {
      errors.push('No valid path from Start to Goal');
    } else {
      // Check exactly one safe path (avoiding mines)
      const safePathCount = countPaths(grid);
      if (safePathCount === 0) {
        errors.push('Mines block all paths — leave at least one safe route');
      } else if (safePathCount > 1) {
        errors.push('Multiple safe paths exist — add walls or mines to create exactly one');
      }
    }
  }

  // Count mines (limit to reasonable amount)
  let mineCount = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === 2) mineCount++;
    }
  }
  if (mineCount > 8) errors.push('Too many mines (max 8)');

  return { valid: errors.length === 0, errors };
}

// For attacker view: convert grid to hide mines (show them as open tiles)
export function getAttackerView(grid: CellType[][]): CellType[][] {
  return grid.map(row => row.map(cell => (cell === 2 ? 0 : cell) as CellType));
}
