import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Lock, Unlock, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, Trophy, Swords, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubmitGuess, useAttemptGuesses } from '@/hooks/useLockbox';
import { LOCKBOX_COLORS, LOCKBOX_DIGITS, CellType, getAttackerView, findCell } from '@/lib/lockboxMazes';
import { logActivity } from '@/lib/activityLogger';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ── Phase Progress ──
function PhaseProgress({ currentPhase, isSolved }: { currentPhase: string; isSolved: boolean }) {
  const phases = [
    { key: 'number', label: 'Numbers', emoji: '#️⃣' },
    { key: 'color', label: 'Colors', emoji: '🎨' },
    { key: 'maze', label: 'Maze', emoji: '🏁' },
  ];
  const idx = phases.findIndex(p => p.key === currentPhase);

  return (
    <div className="glass-card p-3.5 mb-4">
      <div className="flex items-center gap-2">
        {phases.map((p, i) => {
          const done = isSolved || i < idx;
          const active = p.key === currentPhase && !isSolved;
          return (
            <div key={p.key} className="flex-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px]">{done ? '✅' : active ? p.emoji : '⬜'}</span>
                <span className={`text-[10px] font-bold ${active ? 'text-primary' : done ? 'text-primary/60' : 'text-muted-foreground/30'}`}>
                  {p.label}
                </span>
              </div>
              <div className={`h-1.5 rounded-full transition-all duration-500 ${
                done ? 'bg-primary' : active ? 'bg-primary/50 animate-pulse' : 'bg-muted/20'
              }`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Guess History Row ──
function GuessRow({ guess, index, type }: { guess: any; index: number; type: 'number' | 'color' }) {
  const values = guess.guess_value.split(',');
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-2.5 py-2"
    >
      <span className="text-[10px] text-muted-foreground/50 w-5 font-mono">#{index + 1}</span>
      <div className="flex gap-1.5">
        {values.map((v: string, j: number) => {
          if (type === 'color') {
            const color = LOCKBOX_COLORS.find(c => c.name === v);
            return <div key={j} className="w-8 h-8 rounded-lg border border-border/30" style={{ background: color?.value || 'gray' }} />;
          }
          return (
            <span key={j} className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center font-mono font-bold text-sm">
              {v}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-2.5 ml-auto">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
          <span className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px]">🎯</span>
          {guess.correct_position}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
          <span className="w-5 h-5 rounded-full bg-amber-400/15 flex items-center justify-center text-[10px]">🔄</span>
          {guess.correct_value}
        </span>
      </div>
    </motion.div>
  );
}

// ── Clue Legend (inline) ──
function ClueLegend() {
  return (
    <div className="flex items-center gap-4 text-[9px] text-muted-foreground mb-3 px-1">
      <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center text-[8px]">🎯</span> Right spot</span>
      <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-amber-400/15 flex items-center justify-center text-[8px]">🔄</span> Wrong spot</span>
    </div>
  );
}

// ── Number Phase ──
function NumberPhase({ onSubmit, guesses, isPending }: { onSubmit: (g: number[]) => void; guesses: any[]; isPending: boolean }) {
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (d: number) => {
    if (selected.includes(d)) setSelected(selected.filter(n => n !== d));
    else if (selected.length < 3) setSelected([...selected, d]);
  };

  const submit = () => { onSubmit(selected); setSelected([]); };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-black text-sm">Crack the Number Code</h3>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">PHASE 1</span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-4">Pick 3 unique digits (0–5). Order matters.</p>

        <div className="flex gap-2.5 mb-4 justify-center">
          {selected.map((d, i) => (
            <motion.div key={i} initial={{ scale: 0.5 }} animate={{ scale: 1 }}
              className="w-14 h-14 rounded-xl bg-primary/15 border-2 border-primary/40 flex items-center justify-center font-mono font-black text-2xl text-primary">
              {d}
            </motion.div>
          ))}
          {Array.from({ length: 3 - selected.length }).map((_, i) => (
            <div key={`e-${i}`} className="w-14 h-14 rounded-xl border-2 border-dashed border-muted-foreground/15 flex items-center justify-center">
              <span className="text-muted-foreground/20 text-2xl font-mono">?</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-6 gap-2 mb-4">
          {LOCKBOX_DIGITS.map(d => (
            <button key={d} onClick={() => toggle(d)}
              className={`h-12 rounded-xl font-mono font-bold text-lg transition-all active:scale-90 ${
                selected.includes(d)
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'bg-muted/30 hover:bg-muted/50 text-foreground'
              }`}>
              {d}
            </button>
          ))}
        </div>

        <Button onClick={submit} disabled={selected.length !== 3 || isPending} className="w-full h-12 font-bold">
          {isPending ? 'Checking…' : 'Submit Guess'}
        </Button>
      </div>

      {guesses.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground/60 tracking-wider">GUESS HISTORY</span>
            <span className="text-[10px] text-muted-foreground">{guesses.length} guess{guesses.length !== 1 ? 'es' : ''}</span>
          </div>
          <ClueLegend />
          <div className="divide-y divide-border/10">
            {guesses.map((g: any, i: number) => (
              <GuessRow key={g.id} guess={g} index={i} type="number" />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Color Phase ──
function ColorPhase({ onSubmit, guesses, isPending }: { onSubmit: (g: string[]) => void; guesses: any[]; isPending: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (name: string) => {
    if (selected.includes(name)) setSelected(selected.filter(n => n !== name));
    else if (selected.length < 3) setSelected([...selected, name]);
  };

  const submit = () => { onSubmit(selected); setSelected([]); };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-black text-sm">Crack the Color Code</h3>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">PHASE 2</span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-4">Pick 3 unique colors. Order matters.</p>

        <div className="flex gap-2.5 mb-4 justify-center">
          {selected.map((c, i) => {
            const color = LOCKBOX_COLORS.find(lc => lc.name === c);
            return (
              <motion.div key={i} initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                className="w-14 h-14 rounded-xl border-2 border-primary/40 shadow-lg"
                style={{ background: color?.value }} />
            );
          })}
          {Array.from({ length: 3 - selected.length }).map((_, i) => (
            <div key={`e-${i}`} className="w-14 h-14 rounded-xl border-2 border-dashed border-muted-foreground/15" />
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {LOCKBOX_COLORS.map(c => (
            <button key={c.name} onClick={() => toggle(c.name)}
              className={`h-14 rounded-xl transition-all active:scale-90 border-2 ${
                selected.includes(c.name)
                  ? 'border-primary ring-2 ring-primary/30 scale-95'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ background: c.value }}>
              <span className="text-[9px] font-bold text-white/90 drop-shadow-md">{c.name}</span>
            </button>
          ))}
        </div>

        <Button onClick={submit} disabled={selected.length !== 3 || isPending} className="w-full h-12 font-bold">
          {isPending ? 'Checking…' : 'Submit Guess'}
        </Button>
      </div>

      {guesses.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground/60 tracking-wider">GUESS HISTORY</span>
            <span className="text-[10px] text-muted-foreground">{guesses.length} guess{guesses.length !== 1 ? 'es' : ''}</span>
          </div>
          <ClueLegend />
          <div className="divide-y divide-border/10">
            {guesses.map((g: any, i: number) => (
              <GuessRow key={g.id} guess={g} index={i} type="color" />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Custom Maze Phase ──
function MazePhase({ mazeGrid, onSolve, onFail, isPending, mazeAttempts }: {
  mazeGrid: CellType[][];
  onSolve: () => void;
  onFail: () => void;
  isPending: boolean;
  mazeAttempts: number;
}) {
  const attackerGrid = useMemo(() => getAttackerView(mazeGrid), [mazeGrid]);
  const start = useMemo(() => findCell(mazeGrid, 3) || [0, 0] as [number, number], [mazeGrid]);
  const goal = useMemo(() => findCell(mazeGrid, 4) || [4, 4] as [number, number], [mazeGrid]);

  const [pos, setPos] = useState<[number, number]>(start);
  const [path, setPath] = useState<[number, number][]>([start]);
  const [hitMine, setHitMine] = useState(false);
  const [solved, setSolved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const onSolveRef = useRef(onSolve);
  onSolveRef.current = onSolve;

  const mazeSize = mazeGrid.length;

  // Responsive sizing
  const [containerWidth, setContainerWidth] = useState(300);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(Math.min(entry.contentRect.width - 16, 340));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cellPx = containerWidth / mazeSize;
  const svgSize = cellPx * mazeSize;

  const move = useCallback((dr: number, dc: number) => {
    if (solved || hitMine) return;
    setPos(prev => {
      const nr = prev[0] + dr;
      const nc = prev[1] + dc;
      if (nr < 0 || nr >= mazeSize || nc < 0 || nc >= mazeSize) return prev;
      // Check wall in attacker view
      if (attackerGrid[nr][nc] === 1) return prev;
      // Check mine in real grid
      if (mazeGrid[nr][nc] === 2) {
        setHitMine(true);
        setPath(p => [...p, [nr, nc]]);
        return [nr, nc] as [number, number];
      }
      const newPos: [number, number] = [nr, nc];
      setPath(p => [...p, newPos]);
      if (nr === goal[0] && nc === goal[1]) {
        setSolved(true);
        setTimeout(() => onSolveRef.current(), 400);
      }
      return newPos;
    });
  }, [mazeSize, attackerGrid, mazeGrid, solved, hitMine, goal]);

  const handleCellTap = useCallback((r: number, c: number) => {
    if (attackerGrid[r][c] === 1) return;
    const dr = r - pos[0];
    const dc = c - pos[1];
    if (Math.abs(dr) + Math.abs(dc) !== 1) return;
    move(dr, dc);
  }, [pos, attackerGrid, move]);

  const reset = () => {
    if (solved) return;
    if (hitMine) {
      // Mine hit — count as failed attempt, then reset
      setHitMine(false);
    }
    setPos(start);
    setPath([start]);
  };

  const handleMineFail = () => {
    onFail();
    setHitMine(false);
    setPos(start);
    setPath([start]);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="glass-card p-5" ref={containerRef}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-black text-sm">Navigate the Maze</h3>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">FINAL PHASE</span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-1">
          Reach the <span className="text-amber-400 font-bold">🏁 Goal</span> from <span className="text-primary font-bold">🟢 Start</span>.
        </p>
        <p className="text-[10px] text-destructive/70 mb-4">
          ⚠️ Hidden mines! Stepping on one fails this attempt.
        </p>

        {/* Mine hit overlay */}
        <AnimatePresence>
          {hitMine && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-center"
            >
              <div className="text-2xl mb-1">💥💣</div>
              <div className="text-sm font-bold text-destructive mb-1">Mine Hit!</div>
              <div className="text-[10px] text-muted-foreground mb-3">This maze attempt failed. +1 try.</div>
              <Button onClick={handleMineFail} disabled={isPending} variant="destructive" size="sm" className="h-9">
                {isPending ? 'Recording…' : 'Try Again'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Maze grid */}
        {!hitMine && (
          <>
            <div className="flex justify-center mb-4">
              <svg
                width={svgSize}
                height={svgSize}
                viewBox={`0 0 ${mazeSize} ${mazeSize}`}
                className="rounded-xl overflow-hidden border border-border/20"
                style={{ touchAction: 'none' }}
              >
                <rect width={mazeSize} height={mazeSize} fill="hsl(var(--background))" />

                {attackerGrid.map((row, r) =>
                  row.map((cell, c) => {
                    const isPath = cell !== 1;
                    const isAdjacent = isPath && !solved && Math.abs(r - pos[0]) + Math.abs(c - pos[1]) === 1;
                    const isStart = mazeGrid[r][c] === 3;
                    const isGoal = mazeGrid[r][c] === 4;
                    return (
                      <rect
                        key={`${r}-${c}`}
                        x={c + 0.04}
                        y={r + 0.04}
                        width={0.92}
                        height={0.92}
                        rx={0.12}
                        fill={
                          cell === 1
                            ? 'hsl(var(--muted) / 0.5)'
                            : isStart
                            ? 'hsl(var(--primary) / 0.15)'
                            : isGoal
                            ? 'hsl(45 93% 52% / 0.15)'
                            : isAdjacent
                            ? 'hsl(var(--primary) / 0.1)'
                            : 'hsl(var(--muted) / 0.08)'
                        }
                        stroke={isAdjacent ? 'hsl(var(--primary) / 0.25)' : 'transparent'}
                        strokeWidth={0.03}
                        onClick={() => handleCellTap(r, c)}
                        style={{ cursor: isAdjacent ? 'pointer' : 'default' }}
                      />
                    );
                  })
                )}

                {/* Trail */}
                {path.map(([r, c], i) => (
                  <rect
                    key={`trail-${i}`}
                    x={c + 0.2}
                    y={r + 0.2}
                    width={0.6}
                    height={0.6}
                    rx={0.1}
                    fill={solved ? 'hsl(var(--primary) / 0.35)' : 'hsl(var(--primary) / 0.18)'}
                  />
                ))}

                {/* Start label */}
                <text x={start[1] + 0.5} y={start[0] + 0.15} textAnchor="middle" fill="hsl(var(--primary))" fontSize={0.2} fontWeight="bold">
                  START
                </text>

                {/* Goal */}
                <circle cx={goal[1] + 0.5} cy={goal[0] + 0.5} r={0.3} fill="hsl(45 93% 52%)" opacity={0.9} />
                <circle cx={goal[1] + 0.5} cy={goal[0] + 0.5} r={0.16} fill="hsl(45 93% 62%)" />
                <text x={goal[1] + 0.5} y={goal[0] - 0.05} textAnchor="middle" fill="hsl(45 93% 52%)" fontSize={0.2} fontWeight="bold">
                  GOAL
                </text>

                {/* Player */}
                <circle cx={pos[1] + 0.5} cy={pos[0] + 0.5} r={0.32} fill="hsl(var(--primary))" />
                <circle cx={pos[1] + 0.5} cy={pos[0] + 0.5} r={0.18} fill="hsl(var(--primary-foreground))" opacity={0.9} />
              </svg>
            </div>

            {/* D-pad controls */}
            <div className="flex flex-col items-center gap-1.5 mb-4">
              <Button variant="outline" size="icon" onClick={() => move(-1, 0)} disabled={solved} className="w-14 h-11 rounded-xl active:scale-90">
                <ChevronUp className="w-5 h-5" />
              </Button>
              <div className="flex gap-1.5">
                <Button variant="outline" size="icon" onClick={() => move(0, -1)} disabled={solved} className="w-14 h-11 rounded-xl active:scale-90">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button variant="outline" size="icon" onClick={reset} disabled={solved} className="w-14 h-11 rounded-xl active:scale-90 text-muted-foreground">
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => move(0, 1)} disabled={solved} className="w-14 h-11 rounded-xl active:scale-90">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
              <Button variant="outline" size="icon" onClick={() => move(1, 0)} disabled={solved} className="w-14 h-11 rounded-xl active:scale-90">
                <ChevronDown className="w-5 h-5" />
              </Button>
            </div>

            {mazeAttempts > 0 && (
              <div className="text-center text-[10px] text-muted-foreground mb-2">
                Failed maze attempts: <span className="font-bold text-destructive">{mazeAttempts}</span>
              </div>
            )}

            <Button variant="ghost" onClick={() => { onFail(); reset(); }} disabled={isPending || solved} className="w-full text-xs text-muted-foreground">
              Give Up This Attempt (+1 try)
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Success Screen ──
function SuccessScreen({ lock, attempt, onBack }: { lock: any; attempt: any; onBack: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
      <div className="glass-card p-6 text-center border border-primary/20">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <Unlock className="w-8 h-8 text-primary" />
          </div>
        </motion.div>
        <h2 className="font-black text-xl mb-1">Lock Cracked! 🔓</h2>
        <p className="text-[12px] text-muted-foreground mb-4">
          You cracked <span className="font-bold text-foreground">{lock.profiles?.display_name}'s</span> lock
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-muted/20 rounded-xl p-3">
            <div className="text-2xl font-black text-primary">{attempt?.total_attempts}</div>
            <div className="text-[10px] text-muted-foreground font-semibold">Total Attempts</div>
          </div>
          <div className="bg-muted/20 rounded-xl p-3">
            <div className="text-2xl font-black text-primary">3/3</div>
            <div className="text-[10px] text-muted-foreground font-semibold">Phases Cleared</div>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground mb-2">
          +5 crack points earned{attempt?.total_attempts <= 5 ? ' · Potential best crack bonus!' : ''}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onBack} className="h-11">
          <Swords className="w-4 h-4 mr-1.5" /> More Locks
        </Button>
        <Button onClick={onBack} className="h-11">
          <Trophy className="w-4 h-4 mr-1.5" /> Leaderboard
        </Button>
      </div>
    </motion.div>
  );
}

// ── Main Page ──
export default function LockboxCrackPage() {
  const { lockId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const submitGuess = useSubmitGuess();
  const qc = useQueryClient();

  const { data: lock, isLoading: lockLoading } = useQuery({
    queryKey: ['lockbox-lock', lockId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_locks')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('id', lockId!)
        .single();
      return data;
    },
    enabled: !!lockId,
  });

  const { data: attempt, isLoading: attemptLoading } = useQuery({
    queryKey: ['lockbox-attempt', lockId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_attempts')
        .select('*')
        .eq('lock_id', lockId!)
        .eq('attacker_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!lockId && !!user,
  });

  const { data: guesses } = useAttemptGuesses(attempt?.id);

  const currentPhase = attempt?.phase || 'number';
  const isSolved = !!attempt?.is_solved;
  const mazeGrid = lock?.maze_grid as CellType[][] | null;

  const numberGuesses = useMemo(() => (guesses || []).filter((g: any) => g.phase === 'number'), [guesses]);
  const colorGuesses = useMemo(() => (guesses || []).filter((g: any) => g.phase === 'color'), [guesses]);
  const mazeFailedAttempts = useMemo(() => (guesses || []).filter((g: any) => g.phase === 'maze' && !g.is_correct).length, [guesses]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['lockbox-attempt', lockId] });
    qc.invalidateQueries({ queryKey: ['lockbox-guesses'] });
    qc.invalidateQueries({ queryKey: ['lockbox-locks'] });
  };

  const handleNumberSubmit = async (guess: number[]) => {
    if (!lock || !user) return;
    try {
      const result = await submitGuess.mutateAsync({
        lockId: lock.id, attackerId: user.id, phase: 'number',
        guessValue: guess.join(','), lockCode: lock.number_code,
      });
      invalidateAll();
      if (result.isCorrect) toast.success('Number code cracked! 🎉');
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit guess');
    }
  };

  const handleColorSubmit = async (guess: string[]) => {
    if (!lock || !user) return;
    try {
      const result = await submitGuess.mutateAsync({
        lockId: lock.id, attackerId: user.id, phase: 'color',
        guessValue: guess.join(','), lockCode: lock.color_code,
      });
      invalidateAll();
      if (result.isCorrect) toast.success('Color code cracked! 🎨');
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit guess');
    }
  };

  const handleMazeSolve = useCallback(async () => {
    if (!lock || !user) return;
    try {
      await submitGuess.mutateAsync({
        lockId: lock.id, attackerId: user.id, phase: 'maze',
        guessValue: 'solved', lockCode: 'solved',
      });
      invalidateAll();
      toast.success('Lock fully cracked! 🔓🎉');
      logActivity(user.id, {
        event_type: 'lockbox_cracked',
        target_type: 'lockbox_lock',
        target_id: lock.id,
        metadata: { lock_owner: lock.profiles?.display_name },
      });
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit');
    }
  }, [lock, user, submitGuess, qc, lockId]);

  const handleMazeFail = useCallback(async () => {
    if (!lock || !user) return;
    try {
      await submitGuess.mutateAsync({
        lockId: lock.id, attackerId: user.id, phase: 'maze',
        guessValue: 'failed', lockCode: 'solved',
      });
      invalidateAll();
      toast.error('Maze attempt failed — +1 try');
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit');
    }
  }, [lock, user, submitGuess, qc, lockId]);

  const goBack = () => navigate('/lockbox');

  if (lockLoading || !lock) {
    return (
      <div className="pb-6">
        <div className="page-header">
          <button onClick={goBack} className="page-header-icon"><ArrowLeft className="w-5 h-5" /></button>
          <div><h1 className="page-header-title">Loading…</h1></div>
        </div>
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="glass-card p-4 animate-pulse"><div className="h-16 bg-muted/20 rounded-lg" /></div>)}
        </div>
      </div>
    );
  }

  // Guard: own lock
  if (lock.user_id === user?.id) {
    return (
      <div className="pb-6">
        <div className="page-header">
          <button onClick={goBack} className="page-header-icon"><ArrowLeft className="w-5 h-5" /></button>
          <div><h1 className="page-header-title">Your Lock</h1></div>
        </div>
        <div className="glass-card p-6 text-center">
          <Shield className="w-8 h-8 mx-auto mb-3 text-primary/40" />
          <h3 className="font-bold text-sm mb-1">This is your lock</h3>
          <p className="text-[11px] text-muted-foreground mb-4">You can't crack your own lock — go crack someone else's!</p>
          <Button onClick={goBack}>Back to Lockbox</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <button onClick={goBack} className="page-header-icon">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="page-header-title truncate">{lock.profiles?.display_name}'s Lock</h1>
            <p className="page-header-subtitle">
              {isSolved
                ? `🔓 Cracked in ${attempt?.total_attempts} attempts`
                : attempt
                ? `${attempt.total_attempts} attempt${attempt.total_attempts !== 1 ? 's' : ''} so far`
                : 'Ready to crack'}
            </p>
          </div>
          {!isSolved && attempt && (
            <div className="glass-card px-3 py-1.5 text-center">
              <div className="text-lg font-black text-primary">{attempt.total_attempts}</div>
              <div className="text-[8px] text-muted-foreground font-bold tracking-wider">TRIES</div>
            </div>
          )}
        </div>

        <PhaseProgress currentPhase={currentPhase} isSolved={isSolved} />

        <AnimatePresence mode="wait">
          {isSolved ? (
            <SuccessScreen key="success" lock={lock} attempt={attempt} onBack={goBack} />
          ) : currentPhase === 'number' ? (
            <NumberPhase key="number" onSubmit={handleNumberSubmit} guesses={numberGuesses} isPending={submitGuess.isPending} />
          ) : currentPhase === 'color' ? (
            <ColorPhase key="color" onSubmit={handleColorSubmit} guesses={colorGuesses} isPending={submitGuess.isPending} />
          ) : currentPhase === 'maze' && mazeGrid ? (
            <MazePhase
              key="maze"
              mazeGrid={mazeGrid}
              onSolve={handleMazeSolve}
              onFail={handleMazeFail}
              isPending={submitGuess.isPending}
              mazeAttempts={mazeFailedAttempts}
            />
          ) : currentPhase === 'maze' && !mazeGrid ? (
            <div className="glass-card p-6 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-400/40" />
              <h3 className="font-bold text-sm mb-1">No Maze Data</h3>
              <p className="text-[11px] text-muted-foreground">This lock was created before custom mazes. Contact the lock owner.</p>
            </div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
