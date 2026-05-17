// DH Club Home — Shared section header
//
// Every home module previously rolled its own eyebrow: different sizes,
// different tracking, some had icons + accent color, others were plain
// muted-foreground. The result was a busy scroll where every section
// shouted differently.
//
// This single component standardizes the pattern so the shell reads as
// one calm system. The contract:
//   • `label` — uppercase eyebrow text
//   • `icon`  — optional 10-12px lucide icon, rendered in muted by default
//   • `accent` — pass a club/feature accent (HSL parts) ONLY when the
//                section is genuinely actionable. Passive sections
//                (Highlights, Pulse, Events) omit it so the eyebrow stays
//                in the neutral shell color.
//   • `to` + `linkLabel` — render a small trailing "All" / "More" link.
//   • `count` — render a small tabular count chip on the right.
//
// Used to be ~12 different inline patterns; now one component.

import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  icon?: LucideIcon;
  /** HSL components of an accent color (e.g. '45 95% 55%'). Triggers accent eyebrow + icon tint. */
  accent?: string;
  to?: string;
  linkLabel?: string;
  count?: number | string;
  className?: string;
}

export function SectionHeader({
  label, icon: Icon, accent, to, linkLabel = 'All', count, className,
}: Props) {
  const hasAccent = !!accent;

  return (
    <div className={cn('flex items-center justify-between mb-2 px-1', className)}>
      <p
        className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] inline-flex items-center gap-1.5"
        style={{ color: hasAccent ? `hsl(${accent})` : 'hsl(var(--muted-foreground) / 0.7)' }}
      >
        {Icon && (
          <Icon
            className="w-3 h-3"
            style={{ color: hasAccent ? `hsl(${accent})` : 'hsl(var(--muted-foreground) / 0.75)' }}
            aria-hidden="true"
          />
        )}
        {label}
      </p>
      <div className="flex items-center gap-2">
        {count !== undefined && (
          <span className="text-[9.5px] font-bold text-muted-foreground/55 tabular-nums">
            {count}
          </span>
        )}
        {to && (
          <Link
            to={to}
            className="text-[9.5px] font-bold inline-flex items-center gap-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            {linkLabel} <ChevronRight className="w-2.5 h-2.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
