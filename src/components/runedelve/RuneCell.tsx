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
  /** When true, this cell is sealed — uninteractable until broken. */
  sealed?: boolean;
  /** Corrupted overlay — chain-able but costs HP. */
  corrupted?: boolean;
  /** Source of corruption (spreads each turn). Implies corrupted. */
  corruptionSource?: boolean;
  size?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerEnter?: (e: React.PointerEvent) => void;
  dataR: number;
  dataC: number;
}

export function RuneCell({ type, selected, invalid, sealed, corrupted, corruptionSource, size = 56, onPointerDown, onPointerEnter, dataR, dataC }: Props) {
  const meta = RUNE_META[type];
  return (
    <div
      data-rune-cell={sealed ? undefined : true}
      data-r={dataR}
      data-c={dataC}
      onPointerDown={sealed ? undefined : onPointerDown}
      onPointerEnter={sealed ? undefined : onPointerEnter}
      className={cn(
        'relative flex items-center justify-center rounded-xl select-none transition-transform',
        !selected && !sealed && 'rd-tile',
        selected && 'scale-110 z-10 border',
        invalid && 'opacity-50',
        sealed && 'rd-tile-sealed',
      )}
      style={{
        width: size,
        height: size,
        ...(selected
          ? {
              background: `radial-gradient(circle at 50% 40%, ${meta.color}, ${meta.color} 60%, transparent 100%)`,
              borderColor: meta.color,
              boxShadow: `0 0 22px ${meta.glow}, inset 0 0 10px rgba(255,255,255,0.18)`,
            }
          : {}),
        touchAction: 'none',
        cursor: sealed ? 'not-allowed' : undefined,
      }}
      aria-label={sealed ? `Sealed ${meta.label} rune` : `${meta.label} rune`}
    >
      {sealed ? (
        // Sealed state: show the lock prominently, dim the underlying glyph.
        <>
          <span
            className="absolute inset-0 flex items-center justify-center text-2xl opacity-25"
            style={{ color: meta.color }}
            aria-hidden
          >
            {meta.glyph}
          </span>
          <span className="relative text-xl leading-none" aria-hidden>🔒</span>
        </>
      ) : (
        <span
          className="text-2xl font-extrabold leading-none"
          style={{
            color: selected ? '#fff' : meta.color,
            textShadow: selected ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
          }}
        >
          {meta.glyph}
        </span>
      )}
    </div>
  );
}
