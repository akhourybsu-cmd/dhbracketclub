import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import type { HeroClass } from '@/lib/runedelve/classConfig';
import { chapterFor } from '@/lib/runedelve/levelGenerator';

interface LevelRun {
  id: string;
  level_id: string;
  level_number: number | null;
  score: number;
  enemies_defeated: number;
  longest_chain: number;
  dungeon_cleared: boolean;
  xp_earned: number;
  hero_class: string;
  completed_at: string;
}

function useLevelHistory(limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rune-delve-level-history', user?.id, limit],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<LevelRun[]> => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from('rune_delve_runs')
        .select('id, level_id, level_number, score, enemies_defeated, longest_chain, dungeon_cleared, xp_earned, hero_class, completed_at')
        .eq('user_id', user.id)
        .order('level_number', { ascending: false, nullsFirst: false })
        .limit(limit);
      return (data ?? []) as LevelRun[];
    },
  });
}

export default function RuneDelveHistoryPage() {
  const { data: runs, isLoading } = useLevelHistory(50);
  const cleared = (runs ?? []).filter(r => r.level_number != null);

  return (
    <div className="space-y-4 pb-8">
      <div className="space-y-1">
        <h1 className="page-header-title">Level History</h1>
        <p className="text-[11px] text-muted-foreground">Your best score on each level you've cleared.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}</div>
      ) : cleared.length === 0 ? (
        <div className="glass-card p-6 text-center text-xs text-muted-foreground">No levels cleared yet — start your campaign!</div>
      ) : (
        <div className="space-y-2">
          {cleared.map(r => (
            <Link
              key={r.id}
              to={`/rune-delve/play/${r.level_number}`}
              className="glass-card p-3 flex items-center gap-3 hover:bg-muted/20 transition-colors"
            >
              <ClassBadge cls={r.hero_class as HeroClass} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold">
                  Level {r.level_number}
                  <span className="text-[10px] text-muted-foreground font-normal ml-1.5">· Ch. {chapterFor(r.level_number ?? 1)}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {r.dungeon_cleared && <span className="font-bold text-success">CLEAR · </span>}
                  {r.enemies_defeated} kills · chain {r.longest_chain}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{r.score.toLocaleString()}</p>
                <p className="text-[9px] text-muted-foreground">+{r.xp_earned} XP</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
