import { motion } from 'framer-motion';
import type { Enemy } from '@/lib/runedelve/dungeonGenerator';
import { Zap } from 'lucide-react';

interface Props {
  enemies: Enemy[];
  flashId?: string | null;
}

export function EnemyDisplay({ enemies, flashId }: Props) {
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      {enemies.map(e => {
        const dead = e.hp <= 0;
        const pct = Math.max(0, Math.round((e.hp / e.maxHp) * 100));
        const hasIntent = !dead && e.intent != null && e.intentMax != null;
        const aboutToFire = hasIntent && (e.intent ?? 99) <= 1;
        return (
          <motion.div
            key={e.id}
            // `false` here suppresses spurious animation re-evaluation on every parent render.
            animate={flashId === e.id ? { x: [-3, 3, -2, 2, 0] } : false}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-1 min-w-[72px]"
            style={{ opacity: dead ? 0.3 : 1 }}
          >
            <div className="relative">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl rd-enemy-frame ${e.name?.startsWith('Elite') ? 'is-elite' : ''}`}
                style={{
                  filter: dead ? 'grayscale(1)' : 'none',
                  opacity: dead ? 0.5 : 1,
                }}
              >
                {dead ? '💀' : e.emoji}
              </div>
              {hasIntent && (
                <motion.div
                  animate={aboutToFire ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.8, repeat: aboutToFire ? Infinity : 0 }}
                  className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center gap-0.5 text-[10px] font-extrabold tabular-nums shadow-md ${
                    aboutToFire
                      ? 'bg-destructive text-destructive-foreground ring-2 ring-destructive/40'
                      : 'bg-warning text-warning-foreground'
                  }`}
                  aria-label={`Attacks in ${e.intent} ${e.intent === 1 ? 'turn' : 'turns'}`}
                >
                  <Zap className="w-2.5 h-2.5" />
                  {e.intent}
                </motion.div>
              )}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-center max-w-[80px] truncate">
              {e.name}
            </div>
            <div className="w-14 h-1.5 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  background: pct > 50 ? 'hsl(var(--success))' : pct > 25 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
                }}
              />
            </div>
            <div className="text-[9px] font-mono tabular-nums text-muted-foreground">
              {Math.max(0, e.hp)} / {e.maxHp}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
