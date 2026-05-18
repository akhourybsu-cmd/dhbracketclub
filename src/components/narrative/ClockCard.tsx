// DH Club — Narrative RPG · Clock progress card
//
// Clocks are progress meters for threats, opportunities, mysteries, and
// faction escalation. Rendered both inline in Story Chat (when advanced)
// and inside the GM Console / World tab.

import { Eye, EyeOff, AlertTriangle, Sparkles, HelpCircle, Users, Circle } from 'lucide-react';
import type { Clock } from '@/lib/narrative/types';

const TYPE_META: Record<Clock['clock_type'], { label: string; icon: typeof AlertTriangle; accent: string }> = {
  danger:      { label: 'Danger',      icon: AlertTriangle, accent: '0 75% 55%' },
  opportunity: { label: 'Opportunity', icon: Sparkles,      accent: '152 65% 45%' },
  mystery:     { label: 'Mystery',     icon: HelpCircle,    accent: '270 70% 60%' },
  faction:     { label: 'Faction',     icon: Users,         accent: '38 95% 50%' },
  custom:      { label: 'Clock',       icon: Circle,        accent: '195 80% 55%' },
};

interface Props {
  clock: Clock;
  /** When true, show GM-only icon and the visibility chip. */
  showVisibility?: boolean;
  onAdvance?: (delta: number) => void;
  /** Compact mode renders the card in a smaller footprint for list use. */
  compact?: boolean;
}

export function ClockCard({ clock, showVisibility, onAdvance, compact }: Props) {
  const meta = TYPE_META[clock.clock_type] ?? TYPE_META.custom;
  const Icon = meta.icon;
  const pct = clock.max_value > 0 ? (clock.current_value / clock.max_value) * 100 : 0;
  const isHidden = clock.visibility === 'gm_only';

  return (
    <div
      className="rounded-2xl bg-card border p-3"
      style={{
        borderColor: `hsl(${meta.accent} / 0.35)`,
      }}
    >
      <div className="flex items-start gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, hsl(${meta.accent} / 0.22), hsl(${meta.accent} / 0.06))`,
            color: `hsl(${meta.accent})`,
          }}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12.5px] font-extrabold tracking-tight truncate">{clock.name}</p>
            <span className="text-[10px] font-extrabold tabular-nums" style={{ color: `hsl(${meta.accent})` }}>
              {clock.current_value} / {clock.max_value}
            </span>
          </div>
          {!compact && clock.description && (
            <p className="text-[10.5px] text-muted-foreground/70 leading-snug mt-0.5">{clock.description}</p>
          )}
          {/* Progress bar */}
          <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full transition-all"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, hsl(${meta.accent}), hsl(${meta.accent} / 0.7))` }}
            />
          </div>
          {showVisibility && (
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mt-1 inline-flex items-center gap-1">
              {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
              {isHidden ? 'GM only' : 'Public'} · {meta.label}
            </p>
          )}
        </div>
      </div>
      {/* GM advance/retreat buttons */}
      {onAdvance && (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAdvance(-1)}
            disabled={clock.current_value <= 0}
            className="flex-1 h-7 rounded-md text-[11px] font-bold bg-muted/30 hover:bg-muted/50 active:scale-95 transition disabled:opacity-50"
          >
            −1
          </button>
          <button
            type="button"
            onClick={() => onAdvance(1)}
            disabled={clock.current_value >= clock.max_value}
            className="flex-1 h-7 rounded-md text-[11px] font-extrabold active:scale-95 transition disabled:opacity-50"
            style={{
              background: `hsl(${meta.accent} / 0.18)`,
              color: `hsl(${meta.accent})`,
              border: `1px solid hsl(${meta.accent} / 0.4)`,
            }}
          >
            +1 tick
          </button>
        </div>
      )}
    </div>
  );
}
