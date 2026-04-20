import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RuneCell } from './RuneCell';
import { BOARD_SIZE, type RuneType } from '@/lib/runedelve/dungeonGenerator';
import { isAdjacent, cellKey, type Cell } from '@/lib/runedelve/boardEngine';
import { cn } from '@/lib/utils';

interface Props {
  grid: RuneType[][];
  disabled?: boolean;
  onChainComplete: (chain: Cell[]) => void;
}

// Mobile-first rune board with pointer-driven chain selection.
export function RuneBoard({ grid, disabled, onChainComplete }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chain, setChain] = useState<Cell[]>([]);
  const draggingRef = useRef(false);

  // Compute cell size from container width — keeps board crisp on any phone.
  const [cellSize, setCellSize] = useState(56);
  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.clientWidth ?? 320;
      const gap = 8;
      const usable = w - gap * (BOARD_SIZE - 1) - 16; // minus padding
      setCellSize(Math.max(40, Math.floor(usable / BOARD_SIZE)));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const chainSet = useMemo(() => new Set(chain.map(cellKey)), [chain]);
  const chainType = chain.length ? grid[chain[0].r]?.[chain[0].c] : null;

  const tryAddCell = useCallback((target: Cell) => {
    if (disabled) return;
    setChain(prev => {
      if (!prev.length) {
        return [target];
      }
      const key = cellKey(target);
      // Allow backtracking by one step.
      if (prev.length >= 2 && cellKey(prev[prev.length - 2]) === key) {
        return prev.slice(0, -1);
      }
      if (prev.some(c => cellKey(c) === key)) return prev;
      const last = prev[prev.length - 1];
      if (!isAdjacent(last, target)) return prev;
      const startType = grid[prev[0].r]?.[prev[0].c];
      if (grid[target.r]?.[target.c] !== startType) return prev;
      // light haptic feedback on add
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { (navigator as any).vibrate?.(8); } catch {}
      }
      return [...prev, target];
    });
  }, [disabled, grid]);

  const cellFromPoint = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const node = el.closest('[data-rune-cell]') as HTMLElement | null;
    if (!node) return null;
    const r = Number(node.dataset.r);
    const c = Number(node.dataset.c);
    if (Number.isNaN(r) || Number.isNaN(c)) return null;
    return { r, c };
  };

  const handlePointerDown = (r: number, c: number) => (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    draggingRef.current = true;
    // Do NOT setPointerCapture — capturing on the first cell prevents
    // pointermove from reporting the correct elementFromPoint for sibling cells on iOS.
    setChain([{ r, c }]);
  };

  // Use document-level move so dragging across cells works reliably on iOS Safari.
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!draggingRef.current || disabled) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (cell) tryAddCell(cell);
    };
    const handleUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setChain(prev => {
        if (prev.length >= 3) {
          onChainComplete(prev);
        }
        return [];
      });
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [disabled, onChainComplete, tryAddCell]);

  return (
    <div className="w-full flex flex-col items-center">
      <div
        ref={containerRef}
        className={cn(
          'w-full max-w-[400px] p-2 rounded-2xl select-none',
        )}
        style={{
          background: 'linear-gradient(160deg, hsl(var(--surface-overlay) / 0.6), hsl(var(--surface) / 0.4))',
          border: '1px solid hsl(var(--border) / 0.5)',
          touchAction: 'none',
        }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
            gridAutoRows: `${cellSize}px`,
            gap: 8,
            justifyContent: 'center',
          }}
        >
          {grid.map((row, r) =>
            row.map((rune, c) => {
              const isSel = chainSet.has(`${r}-${c}`);
              return (
                <RuneCell
                  key={`${r}-${c}`}
                  dataR={r}
                  dataC={c}
                  type={rune}
                  size={cellSize}
                  selected={isSel}
                  onPointerDown={handlePointerDown(r, c)}
                />
              );
            })
          )}
        </div>
      </div>
      {chain.length > 0 && (
        <div className="mt-3 text-[11px] font-bold text-muted-foreground tabular-nums">
          Chain: {chain.length}{chain.length < 3 ? ' (need 3+)' : ''} · {chainType?.toUpperCase()}
        </div>
      )}
    </div>
  );
}
