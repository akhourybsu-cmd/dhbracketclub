import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getMechanic, type MechanicId } from '@/lib/runedelve/mechanics';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mechanicId: MechanicId;
  /** Called when the player taps the primary CTA (Begin). */
  onBegin: () => void;
  levelNumber: number;
}

/**
 * One-time intro modal for a brand-new mechanic. Designed for a 411px-wide
 * phone first: oversized icon, single-line title, one short rule, a clear
 * primary CTA. Avoids tutorial walls — players read this once and move on.
 *
 * IMPORTANT: This is intro-only. The play page only mounts it when
 * `introMechanicForLevel(n)` returns non-null — i.e. on band-opener levels
 * (26, 51, 76, 101, 126). Combine/layered levels never re-trigger it.
 */
export function MechanicIntroSheet({ open, onOpenChange, mechanicId, onBegin, levelNumber }: Props) {
  const m = getMechanic(mechanicId);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 border-t-2" style={{ borderTopColor: 'hsl(var(--primary) / 0.5)' }}>
        <SheetHeader className="px-6 pt-6 pb-2 text-left">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-primary/15 text-primary">
              New mechanic · Lv {levelNumber}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{m.family}</span>
          </div>
          <SheetTitle className="text-2xl font-extrabold tracking-tight flex items-center gap-3 leading-none">
            <span className="text-4xl leading-none" aria-hidden>{m.icon}</span>
            <span>{m.name}</span>
          </SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-7 pt-3 space-y-5">
          <p className="text-[14px] leading-relaxed text-foreground/90">
            {m.oneLiner}
          </p>
          <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider font-extrabold text-primary mb-1">Tip</p>
            <p className="text-[12px] text-foreground/80 leading-snug">
              From now on this mechanic can appear on later levels — sometimes mixed with what you've already learned.
            </p>
          </div>
          <button
            onClick={onBegin}
            className="w-full h-12 rounded-xl font-extrabold text-sm btn-press"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
              color: 'white',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            Begin Level {levelNumber}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
