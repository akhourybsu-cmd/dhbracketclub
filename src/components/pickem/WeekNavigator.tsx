import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NflWeek } from '@/hooks/usePickem';

type Props = {
  weeks: NflWeek[];
  currentWeek: number;
  basePath: string; // e.g. '/pickem/week'
};

export function WeekNavigator({ weeks, currentWeek, basePath }: Props) {
  const prev = weeks.find((w) => w.week_number === currentWeek - 1);
  const next = weeks.find((w) => w.week_number === currentWeek + 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {prev ? (
          <Link to={`${basePath}/${prev.week_number}`} className="flex items-center gap-1 text-[12px] font-bold text-muted-foreground hover:text-foreground btn-press">
            <ChevronLeft className="w-4 h-4" /> {prev.label}
          </Link>
        ) : <span />}
        {next ? (
          <Link to={`${basePath}/${next.week_number}`} className="flex items-center gap-1 text-[12px] font-bold text-muted-foreground hover:text-foreground btn-press">
            {next.label} <ChevronRight className="w-4 h-4" />
          </Link>
        ) : <span />}
      </div>
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none">
        {weeks.map((w) => (
          <Link
            key={w.id}
            to={`${basePath}/${w.week_number}`}
            className={cn(
              'flex-shrink-0 min-w-[44px] h-9 px-3 rounded-lg flex items-center justify-center text-[11px] font-bold transition-colors',
              w.week_number === currentWeek
                ? 'bg-gold/20 text-gold border border-gold/30'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
            )}
          >
            {w.week_number}
          </Link>
        ))}
      </div>
    </div>
  );
}
