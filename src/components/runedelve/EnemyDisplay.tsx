import { motion } from 'framer-motion';
import type { Enemy } from '@/lib/runedelve/dungeonGenerator';
import { Zap } from 'lucide-react';

interface Props {
  enemies: Enemy[];
  flashId?: string | null;
}

export function EnemyDisplay({ enemies, flashId }: Props) {
  return (
    <div className="flex items-start justify-center gap-2.5 flex-wrap">
      {enemies.map(e => {
        const dead = e.hp <= 0;
        const pct = Math.max(0, Math.round((e.hp / e.maxHp) * 100));
        const hasIntent = !dead && e.intent != null && e.intentMax != null;
        const aboutToFire = hasIntent && (e.intent ?? 99) <= 1;
        return (
          <motion.div
            key={e.id}
            animate={flashId === e.id ? { x: [-3, 3, -2, 2, 0] } : false}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-0.5 min-w-[64px]"
            style={{ opacity: dead ? 0.35 : 1 }}
          >
            <div className="relative">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl rd-enemy-frame ${e.name?.startsWith('Elite') ? 'is-elite' : ''}`}
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
                  className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center gap-0.5 text-[10px] font-extrabold tabular-nums shadow-md ${
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
              {/* Ability telegraph — small ✦ badge when an ability is about to fire. */}
              {!dead && e.ability && e.abilityCooldown != null && e.abilityCooldown <= 1 && (
                <div
                  className="absolute -bottom-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-extrabold flex items-center justify-center shadow-md ring-1 ring-primary/40"
                  aria-label={e.telegraphLabel ?? 'Ability ready'}
                  title={e.telegraphLabel ?? 'Ability ready'}
                >✦</div>
              )}
              {/* Armor pip — visible damage-reduction indicator from shield_self. */}
              {!dead && (e.armor ?? 0) > 0 && (
                <div
                  className="absolute -bottom-1 -left-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center shadow-md"
                  style={{ background: 'hsl(var(--gold))', color: 'hsl(var(--background))' }}
                  aria-label={`Armor ${e.armor}`}
                >🛡{e.armor}</div>
              )}
            </div>
            {/* Two-line clamp keeps "Boss Ancient Drake" / "Cult Warden" readable on 411px screens. */}
            <div
              className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/75 text-center max-w-[78px] leading-tight overflow-hidden"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}
            >
              {e.name}
            </div>
            <div className="w-12 h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  background: pct > 50 ? 'hsl(var(--success))' : pct > 25 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
                }}
              />
            </div>
            <div className="text-[9px] font-mono font-bold tabular-nums text-foreground/65 leading-none">
              {Math.max(0, e.hp)}/{e.maxHp}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
