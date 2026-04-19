import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, History, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

  const totals = useMemo(() => {
    const scored = stats.filter((s) => s.status === 'scored');
    const correct = scored.reduce((a, s) => a + s.correct, 0);
    const total = scored.reduce((a, s) => a + s.total, 0);
    return {
      weeks: scored.length,
      correct,
      total,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  }, [stats]);

  return (
    <div className="space-y-4 pb-6">
      <Link to="/pickem" className="text-[12px] text-muted-foreground flex items-center gap-1 btn-press">
        <ChevronLeft className="w-4 h-4" /> Pick'em
      </Link>

      {/* Hero header with overall record */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden p-5"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary) / 0.10), transparent 60%), hsl(var(--card))',
          border: '1px solid hsl(var(--border) / 0.4)',
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.22), hsl(var(--primary) / 0.05))', boxShadow: 'var(--shadow-glow-sm)' }}>
            <History className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-primary/90">My Record</p>
            <h1 className="text-[22px] font-extrabold tracking-tight leading-tight">Pick History</h1>
          </div>
        </div>
        {totals.weeks > 0 ? (
          <div className="grid grid-cols-3 gap-2 mt-2">
            <Stat label="Correct" value={`${totals.correct}/${totals.total}`} />
            <Stat label="Accuracy" value={`${totals.accuracy}%`} accent />
            <Stat label="Weeks" value={`${totals.weeks}`} />
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">No scored weeks yet.</p>
        )}
      </motion.div>

      <div className="space-y-1.5">
        {loading ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-2xl skeleton-shimmer" />)
        ) : stats.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <History className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm font-bold">No history yet</p>
            <p className="text-xs text-muted-foreground mt-1">Your weekly results will appear here.</p>
          </div>
        ) : stats.map((s, i) => {
          const scored = s.status === 'scored';
          const accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
          return (
            <motion.div key={s.week_id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.25) }}>
              <Link to={`/pickem/week/${s.week_number}${scored ? '/results' : ''}`}>
                <div className="glass-card p-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0',
                    scored ? 'bg-gold/10 border border-gold/20' : 'bg-muted/30 border border-border/30'
                  )}>
                    <p className="text-[8px] text-muted-foreground/70 font-extrabold uppercase tracking-wider">Wk</p>
                    <p className={cn('text-base font-extrabold leading-none tabular-nums', scored && 'text-gold')}>{s.week_number}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-extrabold truncate">{s.label}</p>
                    <p className={cn('text-[10px] tabular-nums mt-0.5', scored ? 'text-muted-foreground' : 'text-muted-foreground/60 italic')}>
                      {scored
                        ? <>{s.correct}/{s.total} · {accuracy}% · #{s.rank ?? '–'}</>
                        : <>Not scored yet</>}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-background/40 border border-border/30 p-2.5 text-center">
      <p className={cn('text-[15px] font-extrabold tabular-nums leading-none', accent && 'text-primary')}>{value}</p>
      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/70 mt-1">{label}</p>
    </div>
  );
}
