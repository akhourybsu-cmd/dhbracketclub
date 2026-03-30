import { PRESET_MAZES } from '@/lib/lockboxMazes';

interface Props {
  mazeId: number;
  size?: number;
}

export function MazePreview({ mazeId, size = 100 }: Props) {
  const maze = PRESET_MAZES.find(m => m.id === mazeId);
  if (!maze) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${maze.size} ${maze.size}`}
      className="mx-auto rounded-lg overflow-hidden"
    >
      <rect width={maze.size} height={maze.size} fill="hsl(var(--background))" />
      {maze.grid.map((row, r) =>
        row.map((cell, c) => (
          <rect
            key={`${r}-${c}`}
            x={c + 0.04}
            y={r + 0.04}
            width={0.92}
            height={0.92}
            rx={0.1}
            fill={cell === 1 ? 'hsl(var(--muted) / 0.4)' : 'hsl(var(--muted) / 0.08)'}
          />
        ))
      )}
      {/* Start */}
      <circle cx={0.5} cy={0.5} r={0.22} fill="hsl(var(--primary))" />
      {/* Goal */}
      <circle cx={maze.size - 0.5} cy={maze.size - 0.5} r={0.22} fill="hsl(45 93% 52%)" />
    </svg>
  );
}
