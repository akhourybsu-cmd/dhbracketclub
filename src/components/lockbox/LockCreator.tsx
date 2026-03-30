import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateLock } from '@/hooks/useLockbox';
import { LOCKBOX_COLORS, LOCKBOX_DIGITS, PRESET_MAZES } from '@/lib/lockboxMazes';
import { MazePreview } from './MazePreview';
import { toast } from 'sonner';

interface Props {
  weekId: string | undefined;
  myLock: any;
}

export function LockCreator({ weekId, myLock }: Props) {
  const { user } = useAuth();
  const createLock = useCreateLock();
  const [step, setStep] = useState(0); // 0=number, 1=color, 2=maze
  const [numberCode, setNumberCode] = useState<number[]>([]);
  const [colorCode, setColorCode] = useState<string[]>([]);
  const [mazeId, setMazeId] = useState<number | null>(null);

  if (myLock) {
    const colors = myLock.color_code.split(',');
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Your Lock is Set</h3>
            <p className="text-[11px] text-muted-foreground">
              {myLock.is_cracked ? '💔 Someone cracked it!' : '🔒 Still holding strong'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground mb-1.5">NUMBER CODE</div>
            <div className="flex gap-2">
              {myLock.number_code.split(',').map((d: string, i: number) => (
                <div key={i} className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center font-mono font-bold text-lg">
                  {d}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground mb-1.5">COLOR CODE</div>
            <div className="flex gap-2">
              {colors.map((c: string, i: number) => {
                const color = LOCKBOX_COLORS.find(lc => lc.name === c);
                return (
                  <div key={i} className="w-10 h-10 rounded-lg border border-border/50" style={{ background: color?.value || 'gray' }} />
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground mb-1.5">MAZE</div>
            <MazePreview mazeId={myLock.maze_id} size={120} />
          </div>
        </div>
      </div>
    );
  }

  const handleSelectDigit = (d: number) => {
    if (numberCode.includes(d)) {
      setNumberCode(numberCode.filter(n => n !== d));
    } else if (numberCode.length < 3) {
      setNumberCode([...numberCode, d]);
    }
  };

  const handleSelectColor = (c: string) => {
    if (colorCode.includes(c)) {
      setColorCode(colorCode.filter(n => n !== c));
    } else if (colorCode.length < 3) {
      setColorCode([...colorCode, c]);
    }
  };

  const handleSubmit = async () => {
    if (!weekId || !user || numberCode.length !== 3 || colorCode.length !== 3 || !mazeId) return;
    try {
      await createLock.mutateAsync({
        week_id: weekId,
        user_id: user.id,
        number_code: numberCode.join(','),
        color_code: colorCode.join(','),
        maze_id: mazeId,
      });
      toast.success('Lock created! 🔒');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create lock');
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex gap-1">
        {['Numbers', 'Colors', 'Maze'].map((label, i) => (
          <button key={i} onClick={() => setStep(i)} className="flex-1">
            <div className={`h-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted/30'}`} />
            <div className={`text-[9px] mt-1 font-semibold ${i === step ? 'text-primary' : 'text-muted-foreground/50'}`}>{label}</div>
          </button>
        ))}
      </div>

      {step === 0 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-5">
          <h3 className="font-bold text-sm mb-1">Pick 3 Digits</h3>
          <p className="text-[11px] text-muted-foreground mb-4">Choose 3 unique digits (0-5). Order matters!</p>
          <div className="flex gap-2 mb-4">
            {numberCode.map((d, i) => (
              <div key={i} className="w-12 h-12 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center font-mono font-bold text-xl text-primary">
                {d}
              </div>
            ))}
            {Array.from({ length: 3 - numberCode.length }).map((_, i) => (
              <div key={`e-${i}`} className="w-12 h-12 rounded-lg border border-dashed border-muted-foreground/20 flex items-center justify-center">
                <span className="text-muted-foreground/30 text-xl">?</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-2 mb-4">
            {LOCKBOX_DIGITS.map(d => (
              <button key={d} onClick={() => handleSelectDigit(d)}
                className={`h-11 rounded-lg font-mono font-bold text-lg transition-all ${
                  numberCode.includes(d) ? 'bg-primary text-primary-foreground scale-95' : 'bg-muted/40 hover:bg-muted/60'
                }`}>
                {d}
              </button>
            ))}
          </div>
          <Button onClick={() => setStep(1)} disabled={numberCode.length !== 3} className="w-full">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}

      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-5">
          <h3 className="font-bold text-sm mb-1">Pick 3 Colors</h3>
          <p className="text-[11px] text-muted-foreground mb-4">Choose 3 unique colors. Order matters!</p>
          <div className="flex gap-2 mb-4">
            {colorCode.map((c, i) => {
              const color = LOCKBOX_COLORS.find(lc => lc.name === c);
              return (
                <div key={i} className="w-12 h-12 rounded-lg border-2 border-primary/30" style={{ background: color?.value }}>
                  <Check className="w-4 h-4 text-white m-auto mt-3.5" />
                </div>
              );
            })}
            {Array.from({ length: 3 - colorCode.length }).map((_, i) => (
              <div key={`e-${i}`} className="w-12 h-12 rounded-lg border border-dashed border-muted-foreground/20" />
            ))}
          </div>
          <div className="flex gap-2 mb-4">
            {LOCKBOX_COLORS.map(c => (
              <button key={c.name} onClick={() => handleSelectColor(c.name)}
                className={`flex-1 h-14 rounded-lg transition-all border-2 ${
                  colorCode.includes(c.name) ? 'border-primary scale-95 opacity-60' : 'border-transparent hover:scale-105'
                }`}
                style={{ background: c.value }}>
                <span className="text-[9px] font-bold text-white/90 drop-shadow">{c.name}</span>
              </button>
            ))}
          </div>
          <Button onClick={() => setStep(2)} disabled={colorCode.length !== 3} className="w-full">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-5">
          <h3 className="font-bold text-sm mb-1">Choose a Maze</h3>
          <p className="text-[11px] text-muted-foreground mb-4">Pick one maze as your final defense layer</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {PRESET_MAZES.map(maze => (
              <button key={maze.id} onClick={() => setMazeId(maze.id)}
                className={`p-3 rounded-xl border-2 transition-all ${
                  mazeId === maze.id ? 'border-primary bg-primary/5' : 'border-border/30 hover:border-border/60'
                }`}>
                <MazePreview mazeId={maze.id} size={100} />
                <div className="text-[10px] font-bold mt-2">{maze.name}</div>
                <div className="text-[9px] text-muted-foreground">{maze.size}×{maze.size}</div>
              </button>
            ))}
          </div>
          <Button onClick={handleSubmit} disabled={!mazeId || createLock.isPending} className="w-full">
            {createLock.isPending ? 'Creating…' : '🔒 Set My Lock'}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
