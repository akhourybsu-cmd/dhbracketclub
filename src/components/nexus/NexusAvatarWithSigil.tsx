import { useDisplayedSigils } from '@/hooks/useNexusRewards';
import { sigilTone, sigilRingShadow, sigilAnimation } from '@/lib/nexus/sigilStyle';
import { SigilGlyph } from './SigilGlyph';

interface Props {
  userId: string;
  src?: string | null;
  fallback: string;
  size?: number;
  /** Pre-fetched displayed-sigil map (avoids N+1). */
  displayed?: Record<string, { code: string; rarity: any; icon: string; name: string }>;
}

/**
 * Avatar with optional rarity-tinted ring + tiny sigil glyph chip.
 * Displays the player's currently-equipped sigil. Rare/Epic/Legendary
 * also get the animated shimmer treatment.
 */
export function NexusAvatarWithSigil({ userId, src, fallback, size = 36, displayed }: Props) {
  // If no map was passed, do a single-user fetch.
  const { data: fallbackMap } = useDisplayedSigils(displayed ? [] : [userId]);
  const map = displayed ?? fallbackMap ?? {};
  const sigil = map[userId];
  const tone = sigil ? sigilTone(sigil.rarity) : null;
  const ringShadow = sigil ? sigilRingShadow(sigil.rarity) : undefined;
  const anim = sigil ? sigilAnimation(sigil.rarity) : undefined;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      title={sigil ? `${sigil.name}` : undefined}
    >
      <div
        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        style={{
          background: 'hsl(var(--nx-cyan) / 0.1)',
          boxShadow: ringShadow,
          animation: anim,
          border: ringShadow ? undefined : '1px solid hsl(var(--nx-cyan) / 0.3)',
        }}
      >
        {src ? (
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-black" style={{ color: 'hsl(var(--nx-cyan))' }}>
            {fallback}
          </span>
        )}
      </div>
      {sigil && tone && (
        <div
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{
            background: tone.bg,
            border: `1.5px solid ${tone.border}`,
            color: tone.fg,
            boxShadow: `0 0 4px ${tone.glow}`,
          }}
        >
          <SigilGlyph icon={sigil.icon} className="w-2.5 h-2.5" />
        </div>
      )}
    </div>
  );
}
