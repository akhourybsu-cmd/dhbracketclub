import { ModifierDef, modifierTone } from '@/lib/nexus/modifiers';
import { cn } from '@/lib/utils';

interface Props {
  mod: ModifierDef;
  size?: 'xs' | 'sm';
  /** Hide the short description copy (compact pill mode). */
  compact?: boolean;
  className?: string;
}

/**
 * Mission Modifier pill. Use `compact` for tight rails (battle HUD); leave
 * full for loadout/intel cards where the short text reads as tactical intel.
 */
export function ModifierPill({ mod, size = 'sm', compact = false, className }: Props) {
  const tone = modifierTone(mod.tone);
  const padY = size === 'xs' ? 'py-[2px]' : 'py-1';
  const padX = size === 'xs' ? 'px-1.5' : 'px-2';
  const labelSz = size === 'xs' ? 'text-[8px]' : 'text-[9px]';
  const shortSz = size === 'xs' ? 'text-[8px]' : 'text-[9px]';
  return (
    <div
      className={cn('inline-flex items-center gap-1.5 nx-clip-sm leading-none', padX, padY, className)}
      style={{
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.fg,
      }}
      title={mod.description}
    >
      <span aria-hidden className="font-black" style={{ fontSize: size === 'xs' ? 9 : 11, lineHeight: 1 }}>{mod.glyph}</span>
      <span className={cn('nx-title font-black tracking-wider', labelSz)} style={{ letterSpacing: '0.14em' }}>
        {mod.label.toUpperCase()}
      </span>
      {!compact && mod.short && (
        <>
          <span aria-hidden style={{ opacity: 0.5 }}>·</span>
          <span className={cn('font-medium', shortSz)} style={{ color: 'hsl(0 0% 100% / 0.78)', letterSpacing: '0.04em' }}>
            {mod.short}
          </span>
        </>
      )}
    </div>
  );
}
