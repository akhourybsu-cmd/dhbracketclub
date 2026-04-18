import { cn } from '@/lib/utils';

export const LORE_TYPES = [
  { value: 'quote', label: 'Quote', emoji: '💬' },
  { value: 'inside_joke', label: 'Inside Joke', emoji: '😂' },
  { value: 'story', label: 'Moment', emoji: '🎬' },
  { value: 'nickname', label: 'Nickname', emoji: '🏷️' },
  { value: 'bit', label: 'Bit', emoji: '🎭' },
  { value: 'hall_of_fame', label: 'Hall of Fame', emoji: '🏆' },
  { value: 'hall_of_shame', label: 'Hall of Shame', emoji: '💀' },
] as const;

export const LORE_STATUSES = [
  { value: 'classic', label: 'Classic', tone: 'muted' },
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'legendary', label: 'Legendary', tone: 'gold' },
  { value: 'cursed', label: 'Cursed', tone: 'destructive' },
  { value: 'retired', label: 'Retired', tone: 'muted' },
] as const;

export function getLoreType(value: string) {
  return LORE_TYPES.find((t) => t.value === value) || LORE_TYPES[0];
}

export function getLoreStatus(value: string) {
  return LORE_STATUSES.find((s) => s.value === value) || LORE_STATUSES[0];
}

export function LoreTypeBadge({ type, className }: { type: string; className?: string }) {
  const t = getLoreType(type);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-[0.12em] font-mono',
        className,
      )}
      style={{
        background: 'hsl(var(--lore) / 0.12)',
        color: 'hsl(var(--lore))',
        border: '1px solid hsl(var(--lore) / 0.2)',
      }}
    >
      <span className="text-[10px]" aria-hidden>{t.emoji}</span>
      {t.label}
    </span>
  );
}

export function LoreStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = getLoreStatus(status);
  if (s.value === 'classic') return null;

  const styles: Record<string, React.CSSProperties> = {
    success: { background: 'hsl(var(--success) / 0.14)', color: 'hsl(var(--success))', border: '1px solid hsl(var(--success) / 0.25)' },
    gold: { background: 'hsl(var(--gold) / 0.14)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.3)', boxShadow: '0 0 12px hsl(var(--gold) / 0.18)' },
    destructive: { background: 'hsl(var(--destructive) / 0.14)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)', boxShadow: '0 0 12px hsl(var(--destructive) / 0.18)' },
    muted: { background: 'hsl(var(--muted) / 0.6)', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border) / 0.5)' },
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-[0.14em] font-mono',
        className,
      )}
      style={styles[s.tone]}
    >
      {s.label}
    </span>
  );
}
