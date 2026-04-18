import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LORE_REACTIONS, LoreReaction, useToggleLoreReaction } from '@/hooks/useLoreEntries';
import { cn } from '@/lib/utils';

type Reaction = { reaction: string; user_id: string };

export function LoreReactionBar({ loreId, reactions }: { loreId: string; reactions: Reaction[] }) {
  const { user } = useAuth();
  const { mutate: toggle, isPending } = useToggleLoreReaction();

  const counts = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    LORE_REACTIONS.forEach((r) => map.set(r.value, { count: 0, mine: false }));
    reactions.forEach((r) => {
      const cur = map.get(r.reaction) || { count: 0, mine: false };
      cur.count += 1;
      if (r.user_id === user?.id) cur.mine = true;
      map.set(r.reaction, cur);
    });
    return map;
  }, [reactions, user?.id]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {LORE_REACTIONS.map((r) => {
        const c = counts.get(r.value)!;
        return (
          <button
            key={r.value}
            disabled={isPending}
            onClick={() => toggle({ loreId, reaction: r.value as LoreReaction, hasReacted: c.mine })}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 h-9 rounded-xl text-[11px] font-bold transition-all btn-press min-h-[44px] min-w-[44px] justify-center',
              c.mine
                ? 'border border-[hsl(var(--lore))]/40 text-[hsl(var(--lore))] bg-[hsl(var(--lore))]/12'
                : 'border border-border/40 text-muted-foreground hover:text-foreground bg-[hsl(var(--surface-elevated))]',
            )}
            aria-label={`React ${r.label}`}
            aria-pressed={c.mine}
          >
            <span className="text-[14px]" aria-hidden>{r.emoji}</span>
            <span>{r.label}</span>
            {c.count > 0 && (
              <span className="tabular-nums font-mono opacity-75">{c.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
