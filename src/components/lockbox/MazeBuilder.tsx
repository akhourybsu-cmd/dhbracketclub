import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CellType, MAZE_SIZE, CELL_ICONS, CELL_LABELS,
  createEmptyGrid, validateMaze, findCell,
} from '@/lib/lockboxMazes';
import { MAX_BOMBS } from '@/lib/lockboxScoring';

interface Props {
  onSave: (grid: CellType[][]) => void;
  isPending: boolean;
}

const TOOLS: { type: CellType; label: string; icon: string; color: string }[] = [
  { type: 3, label: 'Start', icon: '🟢', color: 'hsl(var(--primary))' },
  { type: 4, label: 'Goal', icon: '🏁', color: 'hsl(45 93% 52%)' },
  { type: 1, label: 'Wall', icon: '🧱', color: 'hsl(var(--muted-foreground))' },
  { type: 2, label: 'Mine', icon: '💣', color: 'hsl(0 72% 55%)' },
  { type: 0, label: 'Clear', icon: '⬜', color: 'hsl(var(--muted))' },
];

function getCellBg(cell: CellType): string {
  switch (cell) {
    case 1: return 'hsl(var(--muted) / 0.55)';
    case 2: return 'hsl(0 72% 55% / 0.25)';
    case 3: return 'hsl(var(--primary) / 0.3)';
    case 4: return 'hsl(45 93% 52% / 0.3)';
    default: return 'hsl(var(--muted) / 0.08)';
  }
}

function getCellBorder(cell: CellType, isActive: boolean): string {
  if (!isActive) return 'transparent';
  switch (cell) {
    case 1: return 'hsl(var(--muted-foreground) / 0.4)';
    case 2: return 'hsl(0 72% 55% / 0.5)';
    case 3: return 'hsl(var(--primary) / 0.6)';
    case 4: return 'hsl(45 93% 52% / 0.6)';
    default: return 'hsl(var(--border) / 0.3)';
  }
}

export function MazeBuilder({ onSave, isPending }: Props) {
  const [grid, setGrid] = useState<CellType[][]>(createEmptyGrid);
  const [activeTool, setActiveTool] = useState<CellType>(3); // Start with start tool
  const [validation, setValidation] = useState<ReturnType<typeof validateMaze> | null>(null);

  const handleCellTap = useCallback((r: number, c: number) => {
    setGrid(prev => {
      const next = prev.map(row => [...row]);

      // If placing start or goal, clear any existing one first
      if (activeTool === 3 || activeTool === 4) {
        for (let rr = 0; rr < MAZE_SIZE; rr++) {
          for (let cc = 0; cc < MAZE_SIZE; cc++) {
            if (next[rr][cc] === activeTool) next[rr][cc] = 0;
          }
        }
      }

      // Toggle: if same type, clear to open; otherwise set
      next[r][c] = next[r][c] === activeTool ? 0 : activeTool;
      return next;
    });
    setValidation(null); // Reset validation on change
  }, [activeTool]);

  const handleValidate = () => {
    const result = validateMaze(grid);
    setValidation(result);
    if (result.valid) {
      onSave(grid);
    }
  };

  const hasStart = !!findCell(grid, 3);
  const hasGoal = !!findCell(grid, 4);
  let mineCount = 0;
  let wallCount = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === 2) mineCount++;
      if (cell === 1) wallCount++;
    }
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
      <div className="glass-card p-5">
        <h3 className="font-bold text-sm mb-1">Build Your Maze</h3>
        <p className="text-[10px] text-muted-foreground mb-4">
          Tap a tool, then tap cells. Must have exactly <strong>one safe path</strong> from Start to Goal. Mines are hidden from attackers! Max <strong>{MAX_BOMBS} mines</strong>.
        </p>

        {/* Tool palette */}
        <div className="flex gap-1.5 mb-4">
          {TOOLS.map(tool => (
            <button
              key={tool.type}
              onClick={() => setActiveTool(tool.type)}
              className={`flex-1 py-2 rounded-xl text-center transition-all active:scale-95 border-2 ${
                activeTool === tool.type
                  ? 'border-primary bg-primary/10 scale-[0.97]'
                  : 'border-transparent bg-muted/20 hover:bg-muted/30'
              }`}
            >
              <div className="text-base leading-none mb-0.5">{tool.icon}</div>
              <div className="text-[9px] font-bold text-muted-foreground">{tool.label}</div>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex justify-center mb-4">
          <div
            className="grid gap-1 rounded-xl overflow-hidden border border-border/20 p-1"
            style={{
              gridTemplateColumns: `repeat(${MAZE_SIZE}, 1fr)`,
              width: 'min(100%, 300px)',
              aspectRatio: '1',
            }}
          >
            {grid.map((row, r) =>
              row.map((cell, c) => (
                <button
                  key={`${r}-${c}`}
                  onClick={() => handleCellTap(r, c)}
                  className="rounded-lg flex items-center justify-center transition-all active:scale-90 border"
                  style={{
                    background: getCellBg(cell),
                    borderColor: getCellBorder(cell, cell !== 0),
                    aspectRatio: '1',
                  }}
                >
                  {cell !== 0 && (
                    <span className="text-sm leading-none">{CELL_ICONS[cell]}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className={`text-[9px] px-2 py-1 rounded-full font-bold ${hasStart ? 'bg-primary/15 text-primary' : 'bg-muted/20 text-muted-foreground/50'}`}>
            {hasStart ? '✓ Start' : '○ Start'}
          </span>
          <span className={`text-[9px] px-2 py-1 rounded-full font-bold ${hasGoal ? 'bg-amber-400/15 text-amber-400' : 'bg-muted/20 text-muted-foreground/50'}`}>
            {hasGoal ? '✓ Goal' : '○ Goal'}
          </span>
          <span className="text-[9px] px-2 py-1 rounded-full bg-muted/20 text-muted-foreground font-bold">
            {wallCount} walls
          </span>
          <span className={`text-[9px] px-2 py-1 rounded-full font-bold ${mineCount > MAX_BOMBS ? 'bg-destructive/15 text-destructive' : 'bg-destructive/10 text-destructive'}`}>
            {mineCount}/{MAX_BOMBS} mines
          </span>
        </div>

        {/* Validation errors */}
        {validation && !validation.valid && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-[11px] font-bold text-destructive">Fix these issues</span>
            </div>
            {validation.errors.map((err, i) => (
              <div key={i} className="text-[10px] text-destructive/80 ml-5">• {err}</div>
            ))}
          </motion.div>
        )}

        <Button
          onClick={handleValidate}
          disabled={!hasStart || !hasGoal || isPending}
          className="w-full h-11 font-bold"
        >
          {isPending ? 'Creating…' : (
            <>
              <Check className="w-4 h-4 mr-1.5" />
              Validate & Set Lock
            </>
          )}
        </Button>
      </div>

      {/* Tip */}
      <div className="glass-card p-3.5">
        <div className="text-[10px] text-muted-foreground">
          <span className="font-bold text-foreground">💡 Tips:</span>{' '}
          Place mines along tempting paths to trap attackers. They see walls but <em>not</em> mines. 
          The maze must have exactly one mine-free path.
        </div>
      </div>
    </motion.div>
  );
}
