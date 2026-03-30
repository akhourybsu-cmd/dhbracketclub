import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubmitGuess, useAttemptGuesses } from '@/hooks/useLockbox';
import { LOCKBOX_COLORS, LOCKBOX_DIGITS, PRESET_MAZES, solveMaze } from '@/lib/lockboxMazes';
import { MazePreview } from '@/components/lockbox/MazePreview';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function LockboxCrackPage() {
  const { lockId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const submitGuess = useSubmitGuess();
  const qc = useQueryClient();

  // Load lock + attempt
  const { data: lock } = useQuery({
    queryKey: ['lockbox-lock', lockId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_locks')
        .select('*, profiles:user_id(display_name)')
        .eq('id', lockId!)
        .single();
      return data;
    },
    enabled: !!lockId,
  });

  const { data: attempt } = useQuery({
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
  const isSolved = attempt?.is_solved;

  // Number guess state
  const [numberGuess, setNumberGuess] = useState<number[]>([]);
  // Color guess state
  const [colorGuess, setColorGuess] = useState<string[]>([]);
  // Maze state
  const [mazePath, setMazePath] = useState<[number, number][]>([]);
  const [mazePos, setMazePos] = useState<[number, number]>([0, 0]);

  const handleNumberGuess = async () => {
    if (!lock || !user || numberGuess.length !== 3) return;
    const result = await submitGuess.mutateAsync({
      lockId: lock.id,
      attackerId: user.id,
      phase: 'number',
      guessValue: numberGuess.join(','),
      lockCode: lock.number_code,
    });
    setNumberGuess([]);
    qc.invalidateQueries({ queryKey: ['lockbox-attempt'] });
    qc.invalidateQueries({ queryKey: ['lockbox-guesses'] });
    if (result.isCorrect) toast.success('Number code cracked! 🎉');
  };

  const handleColorGuess = async () => {
    if (!lock || !user || colorGuess.length !== 3) return;
    const result = await submitGuess.mutateAsync({
      lockId: lock.id,
      attackerId: user.id,
      phase: 'color',
      guessValue: colorGuess.join(','),
      lockCode: lock.color_code,
    });
    setColorGuess([]);
    qc.invalidateQueries({ queryKey: ['lockbox-attempt'] });
    qc.invalidateQueries({ queryKey: ['lockbox-guesses'] });
    if (result.isCorrect) toast.success('Color code cracked! 🎨');
  };

  const handleMazeAttempt = async (success: boolean) => {
    if (!lock || !user) return;
    await submitGuess.mutateAsync({
      lockId: lock.id,
      attackerId: user.id,
      phase: 'maze',
      guessValue: success ? 'solved' : 'failed',
      lockCode: 'solved',
    });
    qc.invalidateQueries({ queryKey: ['lockbox-attempt'] });
    qc.invalidateQueries({ queryKey: ['lockbox-guesses'] });
    if (success) toast.success('Lock fully cracked! 🔓🎉');
    else {
      toast.error('Maze attempt failed!');
      setMazePath([]);
      setMazePos([0, 0]);
    }
  };

  const maze = lock ? PRESET_MAZES.find(m => m.id === lock.maze_id) : null;

  const handleMazeMove = (dr: number, dc: number) => {
    if (!maze) return;
    const nr = mazePos[0] + dr;
    const nc = mazePos[1] + dc;
    if (nr < 0 || nr >= maze.size || nc < 0 || nc >= maze.size) return;
    if (maze.grid[nr][nc] === 1) return;
    const newPos: [number, number] = [nr, nc];
    setMazePos(newPos);
    setMazePath(prev => [...prev, newPos]);
    // Check if reached goal
    if (nr === maze.size - 1 && nc === maze.size - 1) {
      handleMazeAttempt(true);
    }
  };

  const numberGuesses = (guesses || []).filter((g: any) => g.phase === 'number');
  const colorGuesses = (guesses || []).filter((g: any) => g.phase === 'color');

  if (!lock) {
    return (
      <div className="pb-6">
        <div className="page-header">
          <button onClick={() => navigate('/lockbox')} className="page-header-icon"><ArrowLeft /></button>
          <div><h1 className="page-header-title">Loading…</h1></div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <button onClick={() => navigate('/lockbox')} className="page-header-icon">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="page-header-title">{lock.profiles?.display_name}'s Lock</h1>
            <p className="page-header-subtitle">
              {isSolved ? '🔓 Cracked!' : `Phase: ${currentPhase} • ${attempt?.total_attempts || 0} attempts`}
            </p>
          </div>
        </div>

        {/* Phase indicators */}
        <div className="flex gap-1 mb-4">
          {['number', 'color', 'maze'].map((p) => {
            const done = p === 'number' ? (currentPhase !== 'number') :
                         p === 'color' ? (currentPhase === 'maze' || isSolved) :
                         isSolved;
            const active = p === currentPhase && !isSolved;
            return (
              <div key={p} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${done ? 'bg-primary' : active ? 'bg-primary/40' : 'bg-muted/30'}`} />
                <div className={`text-[9px] mt-1 font-semibold capitalize ${active ? 'text-primary' : 'text-muted-foreground/40'}`}>{p}</div>
              </div>
            );
          })}
        </div>

        {isSolved && (
          <div className="glass-card p-5 text-center mb-4 border border-primary/20">
            <div className="text-3xl mb-2">🔓</div>
            <h3 className="font-bold text-base">Lock Cracked!</h3>
            <p className="text-[11px] text-muted-foreground">Solved in {attempt?.total_attempts} attempts</p>
          </div>
        )}

        {/* NUMBER PHASE */}
        {currentPhase === 'number' && !isSolved && (
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-bold text-sm">Crack the Number Code</h3>

            {/* Guess history */}
            {numberGuesses.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold text-muted-foreground">PREVIOUS GUESSES</div>
                {numberGuesses.map((g: any, i: number) => (
                  <div key={g.id} className="flex items-center gap-2 text-[11px]">
                    <span className="text-muted-foreground w-5">#{i + 1}</span>
                    <div className="flex gap-1">
                      {g.guess_value.split(',').map((d: string, j: number) => (
                        <span key={j} className="w-7 h-7 rounded bg-muted/40 flex items-center justify-center font-mono font-bold text-xs">{d}</span>
                      ))}
                    </div>
                    <span className="text-primary text-[10px] font-bold">{g.correct_position}🎯</span>
                    <span className="text-warning text-[10px] font-bold">{g.correct_value}🔄</span>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div>
              <div className="flex gap-2 mb-3 justify-center">
                {numberGuess.map((d, i) => (
                  <div key={i} className="w-12 h-12 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center font-mono font-bold text-xl text-primary">{d}</div>
                ))}
                {Array.from({ length: 3 - numberGuess.length }).map((_, i) => (
                  <div key={`e-${i}`} className="w-12 h-12 rounded-lg border border-dashed border-muted-foreground/20 flex items-center justify-center">
                    <span className="text-muted-foreground/30 text-xl">?</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-2 mb-3">
                {LOCKBOX_DIGITS.map(d => (
                  <button key={d} onClick={() => {
                    if (numberGuess.includes(d)) setNumberGuess(numberGuess.filter(n => n !== d));
                    else if (numberGuess.length < 3) setNumberGuess([...numberGuess, d]);
                  }}
                    className={`h-11 rounded-lg font-mono font-bold text-lg transition-all ${
                      numberGuess.includes(d) ? 'bg-primary text-primary-foreground scale-95' : 'bg-muted/40 hover:bg-muted/60'
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
              <Button onClick={handleNumberGuess} disabled={numberGuess.length !== 3 || submitGuess.isPending} className="w-full">
                Submit Guess
              </Button>
            </div>
          </div>
        )}

        {/* COLOR PHASE */}
        {currentPhase === 'color' && !isSolved && (
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-bold text-sm">Crack the Color Code</h3>

            {colorGuesses.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold text-muted-foreground">PREVIOUS GUESSES</div>
                {colorGuesses.map((g: any, i: number) => (
                  <div key={g.id} className="flex items-center gap-2 text-[11px]">
                    <span className="text-muted-foreground w-5">#{i + 1}</span>
                    <div className="flex gap-1">
                      {g.guess_value.split(',').map((c: string, j: number) => {
                        const color = LOCKBOX_COLORS.find(lc => lc.name === c);
                        return <div key={j} className="w-7 h-7 rounded" style={{ background: color?.value || 'gray' }} />;
                      })}
                    </div>
                    <span className="text-primary text-[10px] font-bold">{g.correct_position}🎯</span>
                    <span className="text-warning text-[10px] font-bold">{g.correct_value}🔄</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <div className="flex gap-2 mb-3 justify-center">
                {colorGuess.map((c, i) => {
                  const color = LOCKBOX_COLORS.find(lc => lc.name === c);
                  return <div key={i} className="w-12 h-12 rounded-lg border-2 border-primary/30" style={{ background: color?.value }} />;
                })}
                {Array.from({ length: 3 - colorGuess.length }).map((_, i) => (
                  <div key={`e-${i}`} className="w-12 h-12 rounded-lg border border-dashed border-muted-foreground/20" />
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                {LOCKBOX_COLORS.map(c => (
                  <button key={c.name} onClick={() => {
                    if (colorGuess.includes(c.name)) setColorGuess(colorGuess.filter(n => n !== c.name));
                    else if (colorGuess.length < 3) setColorGuess([...colorGuess, c.name]);
                  }}
                    className={`flex-1 h-12 rounded-lg transition-all border-2 ${
                      colorGuess.includes(c.name) ? 'border-primary scale-95 opacity-60' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ background: c.value }}>
                    <span className="text-[8px] font-bold text-white/90 drop-shadow">{c.name}</span>
                  </button>
                ))}
              </div>
              <Button onClick={handleColorGuess} disabled={colorGuess.length !== 3 || submitGuess.isPending} className="w-full">
                Submit Guess
              </Button>
            </div>
          </div>
        )}

        {/* MAZE PHASE */}
        {currentPhase === 'maze' && !isSolved && maze && (
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-bold text-sm">Solve the Maze</h3>
            <p className="text-[11px] text-muted-foreground">Navigate from 🟢 start to 🟡 goal</p>

            {/* Maze grid */}
            <div className="flex justify-center">
              <div className="relative">
                <svg width={240} height={240} viewBox={`0 0 ${maze.size} ${maze.size}`}>
                  <rect width={maze.size} height={maze.size} fill="hsl(160 8% 6%)" />
                  {maze.grid.map((row, r) =>
                    row.map((cell, c) => (
                      <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1}
                        fill={cell === 1 ? 'hsl(160 8% 18%)' : 'hsl(160 8% 8%)'}
                        stroke="hsl(160 8% 12%)" strokeWidth={0.03} />
                    ))
                  )}
                  {/* Path trail */}
                  {mazePath.map(([r, c], i) => (
                    <rect key={`p-${i}`} x={c + 0.15} y={r + 0.15} width={0.7} height={0.7} rx={0.1} fill="hsl(152 72% 46% / 0.2)" />
                  ))}
                  {/* Player */}
                  <circle cx={mazePos[1] + 0.5} cy={mazePos[0] + 0.5} r={0.3} fill="hsl(152 72% 46%)" />
                  {/* Goal */}
                  <circle cx={maze.size - 0.5} cy={maze.size - 0.5} r={0.25} fill="hsl(45 93% 52%)" />
                </svg>
              </div>
            </div>

            {/* D-pad controls */}
            <div className="flex flex-col items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => handleMazeMove(-1, 0)} className="w-12 h-12">↑</Button>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={() => handleMazeMove(0, -1)} className="w-12 h-12">←</Button>
                <Button variant="outline" size="icon" onClick={() => handleMazeMove(1, 0)} className="w-12 h-12">↓</Button>
                <Button variant="outline" size="icon" onClick={() => handleMazeMove(0, 1)} className="w-12 h-12">→</Button>
              </div>
            </div>

            <Button variant="outline" onClick={() => handleMazeAttempt(false)} className="w-full text-xs">
              Give Up This Attempt
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
