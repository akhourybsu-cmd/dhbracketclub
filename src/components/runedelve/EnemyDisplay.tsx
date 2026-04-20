import { motion } from 'framer-motion';
import type { Enemy } from '@/lib/runedelve/dungeonGenerator';

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
        return (
          <motion.div
            key={e.id}
            animate={flashId === e.id ? { x: [-3, 3, -2, 2, 0] } : {}}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-1 min-w-[72px]"
            style={{ opacity: dead ? 0.3 : 1 }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
              style={{
                background: dead
                  ? 'hsl(var(--muted) / 0.4)'
                  : 'linear-gradient(160deg, hsl(var(--card)), hsl(var(--surface-overlay)))',
                border: '1px solid hsl(var(--border) / 0.6)',
                filter: dead ? 'grayscale(1)' : 'none',
              }}
            >
              {dead ? '💀' : e.emoji}
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
