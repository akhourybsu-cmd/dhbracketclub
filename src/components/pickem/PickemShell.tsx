import { cn } from '@/lib/utils';

/**
 * Stadium page shell — forces a dark, near-black, game-day surface for the
 * entire Pick'em player experience regardless of the user's chosen theme.
 *
 * Pure presentation — no business logic, no data dependencies.
 *
 * Bleeds to the screen edges (using negative horizontal margins that cancel
 * AppLayout's container padding) so the field/vignette feels immersive.
 */
export function PickemShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'pk-stadium -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-4 rounded-none',
        // Stretch to full viewport height so vignette fills the screen
        'min-h-[calc(100dvh-4.5rem)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
