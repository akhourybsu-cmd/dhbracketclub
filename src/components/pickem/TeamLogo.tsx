import { useState } from 'react';
import { NflTeam } from '@/hooks/usePickem';
import { cn } from '@/lib/utils';

/**
 * Compact, accessible team mark.
 * Falls back to a colored monogram of the team abbreviation when no logo is
 * available or the remote logo fails to load.
 */
export function TeamLogo({
  team,
  size = 32,
  className,
}: {
  team?: NflTeam;
  size?: number;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!team) {
    return (
      <div
        className={cn('rounded-full bg-muted flex items-center justify-center', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const bg = team.primary_color || '#1f2937';
  const fontSize = Math.max(10, Math.round(size * 0.36));

  if (team.logo_url && !imgFailed) {
    return (
      <img
        src={team.logo_url}
        alt={`${team.city} ${team.name}`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setImgFailed(true)}
        className={cn('object-contain', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-extrabold tracking-tight text-white shadow-sm', className)}
      style={{ width: size, height: size, backgroundColor: bg, fontSize }}
      aria-label={`${team.city} ${team.name}`}
    >
      {team.abbr}
    </div>
  );
}
