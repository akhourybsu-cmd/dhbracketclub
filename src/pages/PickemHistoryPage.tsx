import { Link } from 'react-router-dom';
import { ChevronLeft, History, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveSeason, useSeasonWeeks } from '@/hooks/usePickem';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type WeekStat = {
  week_id: string;
  week_number: number;
  label: string;
  status: string;
  correct: number;
  total: number;
  rank: number | null;
};

export default function PickemHistoryPage() {
  const { user } = useAuth();
  const { season } = useActiveSeason();
  const { weeks } = useSeasonWeeks(season?.id);
  const [stats, setStats] = useState<WeekStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user || !season || weeks.length === 0) { setStats([]); setLoading(false); return; }
      setLoading(true);
      const { data: standings } = await (supabase as any)
        .from('nfl_weekly_standings')
        .select('week_id, correct_picks, total_picks, rank')
        .eq('user_id', user.id)
        .eq('season_id', season.id);
      const map = new Map<string, any>((standings || []).map((s: any) => [s.week_id, s]));
      const out = weeks.map((w) => {
        const s = map.get(w.id);
        return {
          week_id: w.id,
          week_number: w.week_number,
          label: w.label,
          status: w.status,
          correct: s?.correct_picks ?? 0,
          total: s?.total_picks ?? 0,
          rank: s?.rank ?? null,
        };
      });
      setStats(out);
      setLoading(false);
    })();
  }, [user, season, weeks]);

  return (
    <div className="space-y-3 pb-6">
      <Link to="/pickem" className="text-[12px] text-muted-foreground flex items-center gap-1 btn-press">
        <ChevronLeft className="w-4 h-4" /> Pick'em
      </Link>
      <div className="page-header">
        <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))' }}>
          <History className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="page-header-title">My Pick History</h1>
          <p className="page-header-subtitle">All your weeks, results & rank</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {loading ? (
          <div className="glass-card p-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : stats.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <History className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm font-bold">No history yet</p>
          </div>
        ) : stats.map((s) => {
          const scored = s.status === 'scored';
          const accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
          return (
            <Link key={s.week_id} to={`/pickem/week/${s.week_number}${scored ? '/results' : ''}`}>
              <div className="glass-card p-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                <div className="w-12 text-center">
                  <p className="text-[10px] text-muted-foreground/70 font-bold uppercase">Wk</p>
                  <p className="text-base font-extrabold leading-none">{s.week_number}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">{s.label}</p>
                  <p className={cn('text-[10px]', scored ? 'text-muted-foreground' : 'text-muted-foreground/60 italic')}>
                    {scored
                      ? <>{s.correct}/{s.total} · {accuracy}% · #{s.rank ?? '–'}</>
                      : <>Not scored yet</>}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
