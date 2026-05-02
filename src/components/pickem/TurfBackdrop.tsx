import { cn } from '@/lib/utils';

/**
 * Stadium turf backdrop with yard-line texture and stadium light shimmer.
 * Use as the wrapper for hero sections / scorebug headers.
 *
 * Pure presentation — no business logic, no data dependencies.
 */
export function TurfBackdrop({
  className,
  children,
  shimmer = true,
  yardLines = true,
}: {
  className?: string;
  children: React.ReactNode;
  shimmer?: boolean;
  yardLines?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl pk-turf',
        yardLines && 'pk-yardlines',
        shimmer && 'pk-stadium-shine',
        'border border-[hsl(152_40%_22%/0.45)]',
        className,
      )}
    >
      {/* top edge gold rule */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(45_95%_55%/0.55)] to-transparent" />
      {/* bottom shadow lip — like field boundary */}
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
}
