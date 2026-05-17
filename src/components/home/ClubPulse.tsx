// DH Club Home — Club Pulse
//
// Replaces the older full Recent Activity card with a tighter, signal-only
// summary. We only show high-signal events (drafts completed, brackets
// submitted, events created, posts published) — chatter like "voted on a
// poll" is filtered out. At most 3 lines, each with avatar + verb + target.
// Tapping the card jumps to the full feed.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bookmark, Trophy, CalendarDays, MessageCircle, BarChart3, Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { SectionHeader } from './SectionHeader';

const HIGH_SIGNAL = new Set([
  'draft_completed', 'draft_created',
  'bracket_submitted',
  'event_created', 'event_rsvp',
  'post_created',
  'ranking_created',
  'poll_created',
]);

const VERBS: Record<string, string> = {
  draft_completed: 'completed a draft',
  draft_created: 'created a draft',
  bracket_submitted: 'submitted a bracket',
  event_created: 'added an event',
  event_rsvp: 'is going to an event',
  post_created: 'started a discussion',
  ranking_created: 'opened a ranking',
  poll_created: 'opened a poll',
};

const ICONS: Record<string, { icon: any; tone: string }> = {
  draft_completed:   { icon: Bookmark,     tone: 'var(--gold)' },
  draft_created:     { icon: Bookmark,     tone: 'var(--gold)' },
  bracket_submitted: { icon: Trophy,       tone: 'var(--primary)' },
  event_created:     { icon: CalendarDays, tone: 'var(--primary)' },
  event_rsvp:        { icon: CalendarDays, tone: 'var(--primary)' },
  post_created:      { icon: MessageCircle, tone: '195 80% 65%' },
  ranking_created:   { icon: BarChart3,    tone: '195 80% 60%' },
  poll_created:      { icon: MessageCircle, tone: '38 95% 60%' },
};

interface ActivityRow {
  id: string;
  event_type: string;
  created_at: string;
  target_type?: string | null;
  target_id?: string | null;
  profiles?: { display_name?: string } | null;
}

interface Props {
  activity: ActivityRow[];
}

export function ClubPulse({ activity }: Props) {
  const filtered = activity.filter(a => HIGH_SIGNAL.has(a.event_type)).slice(0, 3);
  if (filtered.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-5"
    >
      <Link to="/feed" className="block group active:scale-[0.99] transition-transform">
        <div className="rounded-2xl overflow-hidden bg-card border border-border/40">
          <div className="px-3.5 py-2.5 border-b border-border/15">
            <SectionHeader
              label="Club Pulse"
              icon={Activity}
              className="mb-0"
            />
          </div>
          <ul>
            {filtered.map((a, idx) => {
              const verb = VERBS[a.event_type] ?? a.event_type.replace(/_/g, ' ');
              const meta = ICONS[a.event_type];
              const Icon = meta?.icon ?? Activity;
              const tone = meta?.tone ?? 'var(--muted-foreground)';
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-2.5 px-3.5 py-2"
                  style={idx > 0 ? { borderTop: '1px solid hsl(var(--border) / 0.12)' } : undefined}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `hsl(${tone} / 0.14)`,
                      color: `hsl(${tone})`,
                    }}
                  >
                    <Icon className="w-3 h-3" />
                  </span>
                  <p className="text-[11.5px] leading-tight truncate flex-1 min-w-0">
                    <span className="font-bold">{a.profiles?.display_name ?? 'Someone'}</span>{' '}
                    <span className="text-muted-foreground/85">{verb}</span>
                  </p>
                  <span className="text-[9.5px] text-muted-foreground/55 font-medium tabular-nums flex-shrink-0">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: false })}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="px-3.5 py-1.5 border-t border-border/15 flex items-center justify-end">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-muted-foreground/55 inline-flex items-center gap-1">
              See all <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
