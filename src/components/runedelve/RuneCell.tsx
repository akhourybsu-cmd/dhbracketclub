import { cn } from '@/lib/utils';
import type { RuneType } from '@/lib/runedelve/dungeonGenerator';

const RUNE_META: Record<RuneType, { glyph: string; color: string; glow: string; label: string }> = {
  red:   { glyph: '⚔', color: 'hsl(0 75% 58%)',   glow: 'hsl(0 75% 58% / 0.4)',   label: 'Attack' },
  blue:  { glyph: '✦', color: 'hsl(215 75% 60%)', glow: 'hsl(215 75% 60% / 0.4)', label: 'Mana' },
  green: { glyph: '❀', color: 'hsl(140 60% 50%)', glow: 'hsl(140 60% 50% / 0.4)', label: 'Heal' },
  gold:  { glyph: '◈', color: 'hsl(45 90% 56%)',  glow: 'hsl(45 90% 56% / 0.45)', label: 'Guard' },
};

export const RUNE_VISUAL = RUNE_META;

interface Props {
  type: RuneType;
  selected?: boolean;
  invalid?: boolean;
  size?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerEnter?: (e: React.PointerEvent) => void;
  dataR: number;
  dataC: number;
}

export function RuneCell({ type, selected, invalid, size = 56, onPointerDown, onPointerEnter, dataR, dataC }: Props) {
  const meta = RUNE_META[type];
  return (
    <div
      data-rune-cell
      data-r={dataR}
      data-c={dataC}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      className={cn(
        'relative flex items-center justify-center rounded-xl select-none transition-transform',
        'border',
        selected && 'scale-110 z-10',
        invalid && 'opacity-50',
      )}
      style={{
        width: size,
        height: size,
        background: selected
          ? `radial-gradient(circle at 50% 40%, ${meta.color}, ${meta.color} 60%, transparent 100%)`
          : `linear-gradient(160deg, hsl(var(--card)), hsl(var(--surface-overlay)))`,
        borderColor: selected ? meta.color : 'hsl(var(--border) / 0.6)',
        boxShadow: selected
          ? `0 0 18px ${meta.glow}, inset 0 0 8px rgba(255,255,255,0.15)`
          : 'inset 0 1px 0 hsl(var(--foreground) / 0.04)',
        touchAction: 'none',
      }}
    >
      <span
        className="text-2xl font-extrabold leading-none"
        style={{
          color: selected ? '#fff' : meta.color,
          textShadow: selected ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        {meta.glyph}
      </span>
    </div>
  );
}
