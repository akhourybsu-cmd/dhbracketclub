// DH Club Home — "Up Next" events strip
//
// Compact horizontal row of upcoming events. Replaces the previous full
// event-list section. Each pill shows date glyph + truncated title and is
// individually tappable. Renders only when the events asset is installed
// AND there is at least one upcoming event in the next 14 days.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';

interface EventLite {
  id: string;
  title: string;
  starts_at: string;
}

interface Props {
  events: EventLite[];
  /** Club accent color (HSL parts) for the date-tile gradient. */
  accent: string;
}

export function EventsStrip({ events, accent }: Props) {
  if (events.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="-mx-4 sm:mx-0 mb-5"
    >
      <div className="flex items-center justify-between mb-2 px-4 sm:px-0">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3 h-3" style={{ color: `hsl(${accent})` }} />
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">
            Up Next
          </p>
        </div>
        <Link to="/events" className="text-[9.5px] font-bold inline-flex items-center gap-0.5 text-muted-foreground/60 hover:text-foreground">
          All <ChevronRight className="w-2.5 h-2.5" />
        </Link>
      </div>
      <div
        className="flex gap-2 overflow-x-auto px-4 sm:px-0 pb-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {events.slice(0, 6).map(ev => {
          const dt = new Date(ev.starts_at);
          const monthLabel = format(dt, 'MMM').toUpperCase();
          const dayLabel = format(dt, 'd');
          const whenLabel = isToday(dt) ? 'Today' : isTomorrow(dt) ? 'Tomorrow' : isThisWeek(dt) ? format(dt, 'EEE') : format(dt, 'MMM d');
          const timeLabel = format(dt, 'h:mma').toLowerCase();

          return (
            <Link
              key={ev.id}
              to={`/events/${ev.id}`}
              className="flex-shrink-0 w-[170px] active:scale-[0.98] transition-transform"
            >
              <div
                className="rounded-xl p-2.5 flex items-center gap-2.5 h-[68px]"
                style={{
                  background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.9))',
                  border: `1px solid hsl(${accent} / 0.22)`,
                }}
              >
                <div
                  className="w-11 h-11 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${accent} / 0.16), hsl(${accent} / 0.04))`,
                    border: `1px solid hsl(${accent} / 0.28)`,
                  }}
                >
                  <span className="text-[8px] font-extrabold uppercase leading-none" style={{ color: `hsl(${accent})` }}>{monthLabel}</span>
                  <span className="text-[15px] font-extrabold leading-none mt-0.5" style={{ color: `hsl(${accent})` }}>{dayLabel}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-extrabold leading-tight truncate">{ev.title}</p>
                  <p className="text-[9.5px] font-medium text-muted-foreground/70 truncate mt-0.5">
                    {whenLabel} · {timeLabel}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
