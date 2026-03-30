import { PRESET_MAZES } from '@/lib/lockboxMazes';

interface Props {
  mazeId: number;
  size?: number;
}

export function MazePreview({ mazeId, size = 100 }: Props) {
  const maze = PRESET_MAZES.find(m => m.id === mazeId);
  if (!maze) return null;

  const cellSize = size / maze.size;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto rounded-lg overflow-hidden">
      <rect width={size} height={size} fill="hsl(160 8% 8%)" />
      {maze.grid.map((row, r) =>
        row.map((cell, c) => (
          <rect
            key={`${r}-${c}`}
            x={c * cellSize}
            y={r * cellSize}
            width={cellSize}
            height={cellSize}
            fill={cell === 1 ? 'hsl(160 8% 16%)' : 'transparent'}
            stroke="hsl(160 8% 12%)"
            strokeWidth={0.5}
          />
        ))
      )}
      {/* Start marker */}
      <circle cx={cellSize / 2} cy={cellSize / 2} r={cellSize * 0.25} fill="hsl(152 72% 46%)" />
      {/* Goal marker */}
      <circle cx={(maze.size - 0.5) * cellSize} cy={(maze.size - 0.5) * cellSize} r={cellSize * 0.25} fill="hsl(45 93% 52%)" />
    </svg>
  );
}
