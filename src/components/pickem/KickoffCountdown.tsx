import { useEffect, useState } from 'react';

/**
 * Compact live-updating countdown to a target date.
 * Renders inline as: "12d 04h 32m" — or "Kickoff!" if elapsed.
 */
export function KickoffCountdown({
  target,
  className,
  compact = false,
}: {
  target: string | Date;
  className?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const targetMs = typeof target === 'string' ? new Date(target).getTime() : target.getTime();
  const diff = targetMs - now;

  if (diff <= 0) {
    return <span className={className}>Kickoff!</span>;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);

  if (compact) {
    if (days > 0) return <span className={className}>{days}d {hours}h</span>;
    if (hours > 0) return <span className={className}>{hours}h {mins}m</span>;
    return <span className={className}>{mins}m</span>;
  }

  return (
    <span className={className}>
      {days > 0 && <>{days}d </>}
      {String(hours).padStart(2, '0')}h {String(mins).padStart(2, '0')}m
    </span>
  );
}
