import { CellType, MAZE_SIZE, findCell } from '@/lib/lockboxMazes';

interface Props {
  grid: CellType[][];
  size?: number;
  showMines?: boolean;
}

export function MazePreview({ grid, size = 100, showMines = true }: Props) {
  if (!grid || grid.length === 0) return null;
  const mazeSize = grid.length;
  const start = findCell(grid, 3);
  const goal = findCell(grid, 4);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${mazeSize} ${mazeSize}`}
      className="mx-auto rounded-lg overflow-hidden"
    >
      <rect width={mazeSize} height={mazeSize} fill="hsl(var(--background))" />
      {grid.map((row, r) =>
        row.map((cell, c) => {
          let fill = 'hsl(var(--muted) / 0.08)';
          if (cell === 1) fill = 'hsl(var(--muted) / 0.4)';
          else if (cell === 2 && showMines) fill = 'hsl(0 72% 55% / 0.2)';
          return (
            <rect
              key={`${r}-${c}`}
              x={c + 0.04}
              y={r + 0.04}
              width={0.92}
              height={0.92}
              rx={0.1}
              fill={fill}
            />
          );
        })
      )}
      {start && <circle cx={start[1] + 0.5} cy={start[0] + 0.5} r={0.22} fill="hsl(var(--primary))" />}
      {goal && <circle cx={goal[1] + 0.5} cy={goal[0] + 0.5} r={0.22} fill="hsl(45 93% 52%)" />}
      {showMines && grid.map((row, r) =>
        row.map((cell, c) =>
          cell === 2 ? (
            <text key={`mine-${r}-${c}`} x={c + 0.5} y={r + 0.62} textAnchor="middle" fontSize={0.4}>💣</text>
          ) : null
        )
      )}
    </svg>
  );
}
