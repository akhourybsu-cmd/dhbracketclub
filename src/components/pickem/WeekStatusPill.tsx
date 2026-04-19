import { cn } from '@/lib/utils';
import type { NflWeek } from '@/hooks/usePickem';

const MAP: Record<NflWeek['status'], { label: string; cls: string; live?: boolean }> = {
  upcoming:        { label: 'Upcoming',     cls: 'bg-muted text-muted-foreground' },
  open:            { label: 'Picks Open',   cls: 'bg-success/15 text-success border border-success/20' },
  partially_locked:{ label: 'In Progress',  cls: 'bg-gold/15 text-gold border border-gold/20', live: true },
  closed:          { label: 'Awaiting Final',cls: 'bg-muted text-muted-foreground' },
  scored:          { label: 'Scored',       cls: 'bg-primary/15 text-primary border border-primary/20' },
};

export function WeekStatusPill({ status }: { status: NflWeek['status'] }) {
  const m = MAP[status] ?? MAP.upcoming;
  return (
    <span className={cn('status-pill inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 font-bold rounded-full', m.cls)}>
      {m.live && <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />}
      {m.label}
    </span>
  );
}
