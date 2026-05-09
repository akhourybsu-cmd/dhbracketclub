import { Link } from 'react-router-dom';
import { ChevronRight, Loader2, type LucideIcon } from 'lucide-react';

export function AdminStatTile({
  icon: Icon, label, value, color = 'gold', loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-3 flex flex-col gap-1"
      style={{
        background: `linear-gradient(135deg, hsl(var(--${color}) / 0.10), hsl(var(--${color}) / 0.02))`,
        border: `1px solid hsl(var(--${color}) / 0.18)`,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" style={{ color: `hsl(var(--${color}))` }} />
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">{label}</span>
      </div>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60" />
      ) : (
        <span className="text-xl font-extrabold leading-none">{value}</span>
      )}
    </div>
  );
}

export function AdminSectionCard({
  to, icon: Icon, label, description, color = 'gold', badge,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  description: string;
  color?: string;
  badge?: string;
}) {
  return (
    <Link
      to={to}
      className="group glass-card p-4 flex items-center gap-3 min-h-[64px] btn-press hover:border-primary/30 transition-colors"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, hsl(var(--${color}) / 0.18), hsl(var(--${color}) / 0.04))`,
          border: `1px solid hsl(var(--${color}) / 0.22)`,
        }}
      >
        <Icon className="w-4.5 h-4.5" style={{ color: `hsl(var(--${color}))` }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-bold leading-tight truncate">{label}</p>
          {badge && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
              style={{ background: 'hsl(var(--muted) / 0.5)', color: 'hsl(var(--muted-foreground))' }}
            >
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
    </Link>
  );
}
