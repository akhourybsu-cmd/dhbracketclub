import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, ChevronRight, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateLock } from '@/hooks/useLockbox';
import { LOCKBOX_COLORS, LOCKBOX_DIGITS, CellType } from '@/lib/lockboxMazes';
import { logActivity } from '@/lib/activityLogger';
import { MazePreview } from './MazePreview';
import { MazeBuilder } from './MazeBuilder';
import { toast } from 'sonner';

interface Props {
  weekId: string | undefined;
  myLock: any;
}

// ── Lock Status Card ──
function LockStatusCard({ myLock }: { myLock: any }) {
  const colors = myLock.color_code.split(',');
  const isCracked = myLock.is_cracked;
  const mazeGrid = myLock.maze_grid as CellType[][] | null;

  return (
    <div className={`glass-card p-5 border ${isCracked ? 'border-destructive/20' : 'border-primary/15'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isCracked ? 'bg-destructive/12' : 'bg-primary/12'}`}>
          {isCracked ? <ShieldAlert className="w-5 h-5 text-destructive" /> : <ShieldCheck className="w-5 h-5 text-primary" />}
        </div>
        <div>
          <h3 className="font-bold text-sm">{isCracked ? 'Lock Cracked 💔' : 'Lock Active 🔒'}</h3>
          <p className="text-[10px] text-muted-foreground">
            {isCracked ? 'Someone broke through your defenses' : 'Your lock is defending — earn 5 pts if uncracked!'}
          </p>
        </div>
        <div className={`ml-auto px-2.5 py-1 rounded-full text-[9px] font-bold ${
          isCracked ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'
        }`}>
          {isCracked ? 'CRACKED' : 'DEFENDING'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[9px] font-bold text-muted-foreground/60 mb-1.5 tracking-wider">NUMBERS</div>
          <div className="flex gap-1.5">
            {myLock.number_code.split(',').map((d: string, i: number) => (
              <div key={i} className="w-9 h-9 rounded-lg bg-muted/20 flex items-center justify-center font-mono font-bold text-sm">{d}</div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold text-muted-foreground/60 mb-1.5 tracking-wider">COLORS</div>
          <div className="flex gap-1.5">
            {colors.map((c: string, i: number) => {
              const color = LOCKBOX_COLORS.find(lc => lc.name === c);
              return <div key={i} className="w-9 h-9 rounded-lg border border-border/20" style={{ background: color?.value || 'gray' }} />;
            })}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold text-muted-foreground/60 mb-1.5 tracking-wider">MAZE</div>
          {mazeGrid ? (
            <MazePreview grid={mazeGrid} size={80} showMines={true} />
          ) : (
            <div className="w-20 h-20 bg-muted/10 rounded-lg" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lock Creator Steps ──
export function LockCreator({ weekId, myLock }: Props) {
  const { user } = useAuth();
  const createLock = useCreateLock();
  const [step, setStep] = useState(0);
  const [numberCode, setNumberCode] = useState<number[]>([]);
  const [colorCode, setColorCode] = useState<string[]>([]);

  if (myLock) return <LockStatusCard myLock={myLock} />;

  const handleSelectDigit = (d: number) => {
    if (numberCode.includes(d)) setNumberCode(numberCode.filter(n => n !== d));
    else if (numberCode.length < 3) setNumberCode([...numberCode, d]);
  };

  const handleSelectColor = (c: string) => {
    if (colorCode.includes(c)) setColorCode(colorCode.filter(n => n !== c));
    else if (colorCode.length < 3) setColorCode([...colorCode, c]);
  };

  const handleMazeSave = async (mazeGrid: CellType[][]) => {
    if (!weekId || !user || numberCode.length !== 3 || colorCode.length !== 3) return;
    try {
      await createLock.mutateAsync({
        week_id: weekId,
        user_id: user.id,
        number_code: numberCode.join(','),
        color_code: colorCode.join(','),
        maze_grid: mazeGrid,
      });
      toast.success('Lock created! 🔒');
      logActivity(user.id, {
        event_type: 'lockbox_created',
        target_type: 'lockbox_day',
        target_id: weekId,
      });
    } catch (e: any) {
      toast.error(e.message || 'Failed to create lock');
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex gap-1">
        {['Numbers', 'Colors', 'Maze'].map((label, i) => (
          <button key={i} onClick={() => {
            if (i === 1 && numberCode.length !== 3) return;
            if (i === 2 && colorCode.length !== 3) return;
            setStep(i);
          }} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted/20'}`} />
            <div className={`text-[10px] mt-1 font-bold ${i === step ? 'text-primary' : 'text-muted-foreground/40'}`}>{label}</div>
          </button>
        ))}
      </div>

      {step === 0 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-5">
          <h3 className="font-bold text-sm mb-1">Pick 3 Digits</h3>
          <p className="text-[10px] text-muted-foreground mb-4">Choose 3 unique digits (0–5). Order matters!</p>
          <div className="flex gap-2.5 mb-4 justify-center">
            {numberCode.map((d, i) => (
              <motion.div key={i} initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                className="w-14 h-14 rounded-xl bg-primary/15 border-2 border-primary/40 flex items-center justify-center font-mono font-black text-2xl text-primary">
                {d}
              </motion.div>
            ))}
            {Array.from({ length: 3 - numberCode.length }).map((_, i) => (
              <div key={`e-${i}`} className="w-14 h-14 rounded-xl border-2 border-dashed border-muted-foreground/15 flex items-center justify-center">
                <span className="text-muted-foreground/20 text-2xl font-mono">?</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-2 mb-4">
            {LOCKBOX_DIGITS.map(d => (
              <button key={d} onClick={() => handleSelectDigit(d)}
                className={`h-12 rounded-xl font-mono font-bold text-lg transition-all active:scale-90 ${
                  numberCode.includes(d) ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted/30 hover:bg-muted/50'
                }`}>
                {d}
              </button>
            ))}
          </div>
          <Button onClick={() => setStep(1)} disabled={numberCode.length !== 3} className="w-full h-11">
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </motion.div>
      )}

      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-5">
          <h3 className="font-bold text-sm mb-1">Pick 3 Colors</h3>
          <p className="text-[10px] text-muted-foreground mb-4">Choose 3 unique colors. Order matters!</p>
          <div className="flex gap-2.5 mb-4 justify-center">
            {colorCode.map((c, i) => {
              const color = LOCKBOX_COLORS.find(lc => lc.name === c);
              return (
                <motion.div key={i} initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                  className="w-14 h-14 rounded-xl border-2 border-primary/40 shadow-lg" style={{ background: color?.value }} />
              );
            })}
            {Array.from({ length: 3 - colorCode.length }).map((_, i) => (
              <div key={`e-${i}`} className="w-14 h-14 rounded-xl border-2 border-dashed border-muted-foreground/15" />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {LOCKBOX_COLORS.map(c => (
              <button key={c.name} onClick={() => handleSelectColor(c.name)}
                className={`h-14 rounded-xl transition-all active:scale-90 border-2 ${
                  colorCode.includes(c.name) ? 'border-primary ring-2 ring-primary/30 scale-95' : 'border-transparent hover:scale-105'
                }`}
                style={{ background: c.value }}>
                <span className="text-[9px] font-bold text-white/90 drop-shadow-md">{c.name}</span>
              </button>
            ))}
          </div>
          <Button onClick={() => setStep(2)} disabled={colorCode.length !== 3} className="w-full h-11">
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </motion.div>
      )}

      {step === 2 && (
        <MazeBuilder onSave={handleMazeSave} isPending={createLock.isPending} />
      )}
    </div>
  );
}
