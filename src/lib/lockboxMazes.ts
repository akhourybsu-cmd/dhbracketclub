// Preset mazes for DH Lockbox MVP
// Each maze is a grid where 0=path, 1=wall
// Start is top-left path, Goal is bottom-right path

export interface MazeData {
  id: number;
  name: string;
  grid: number[][];
  size: number;
}

export const PRESET_MAZES: MazeData[] = [
  {
    id: 1,
    name: 'Serpent',
    size: 5,
    grid: [
      [0, 0, 0, 0, 1],
      [1, 1, 1, 0, 1],
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1],
      [0, 0, 0, 0, 0],
    ],
  },
  {
    id: 2,
    name: 'Spiral',
    size: 5,
    grid: [
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 0],
      [0, 0, 0, 1, 0],
      [0, 1, 0, 1, 0],
      [0, 1, 0, 0, 0],
    ],
  },
  {
    id: 3,
    name: 'Zigzag',
    size: 5,
    grid: [
      [0, 1, 0, 0, 0],
      [0, 1, 0, 1, 1],
      [0, 0, 0, 0, 0],
      [1, 1, 0, 1, 0],
      [0, 0, 0, 1, 0],
    ],
  },
  {
    id: 4,
    name: 'Fortress',
    size: 6,
    grid: [
      [0, 0, 1, 0, 0, 0],
      [1, 0, 1, 0, 1, 0],
      [0, 0, 0, 0, 1, 0],
      [0, 1, 1, 0, 0, 0],
      [0, 1, 0, 0, 1, 1],
      [0, 0, 0, 1, 0, 0],
    ],
  },
  {
    id: 5,
    name: 'Labyrinth',
    size: 6,
    grid: [
      [0, 0, 0, 1, 0, 0],
      [1, 1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0, 1],
      [0, 1, 1, 1, 0, 0],
      [0, 0, 0, 1, 1, 0],
      [1, 1, 0, 0, 0, 0],
    ],
  },
];

export const LOCKBOX_COLORS = [
  { name: 'Red', value: 'hsl(0 72% 55%)' },
  { name: 'Blue', value: 'hsl(220 80% 55%)' },
  { name: 'Green', value: 'hsl(152 72% 46%)' },
  { name: 'Yellow', value: 'hsl(45 93% 52%)' },
  { name: 'Purple', value: 'hsl(270 70% 55%)' },
];

export const LOCKBOX_DIGITS = [0, 1, 2, 3, 4, 5];

// Find shortest path using BFS (for validation)
export function solveMaze(grid: number[][]): [number, number][] | null {
  const size = grid.length;
  const queue: { pos: [number, number]; path: [number, number][] }[] = [
    { pos: [0, 0], path: [[0, 0]] },
  ];
  const visited = new Set<string>();
  visited.add('0,0');
  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;
    if (pos[0] === size - 1 && pos[1] === size - 1) return path;
    for (const [dr, dc] of dirs) {
      const nr = pos[0] + dr;
      const nc = pos[1] + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] === 0 && !visited.has(key)) {
        visited.add(key);
        queue.push({ pos: [nr, nc], path: [...path, [nr, nc]] });
      }
    }
  }
  return null;
}
