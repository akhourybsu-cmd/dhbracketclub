import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Swords, Heart, Clock, Sparkles } from 'lucide-react';
import { useTodayDungeon, useMyTodayRun, useDailyLeaderboard } from '@/hooks/useRuneDelve';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import { useAuth } from '@/contexts/AuthContext';
import { Confetti } from '@/components/Confetti';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import { getClass, levelFromXp } from '@/lib/runedelve/classConfig';
import { useEffect, useState } from 'react';

export default function RuneDelveResultsPage() {
  const { user } = useAuth();
  const { data: dungeon } = useTodayDungeon();
  const { data: run } = useMyTodayRun(dungeon?.id);
  const { data: hero } = useRuneDelveHero();
  const { data: leaderboard } = useDailyLeaderboard(dungeon?.id);
  const [showConfetti, setShowConfetti] = useState(false);
  const myRank = leaderboard?.find(l => l.user_id === user?.id)?.rank;

  useEffect(() => {
    if (run?.dungeon_cleared || (myRank && myRank <= 3)) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(t);
    }
  }, [run?.dungeon_cleared, myRank]);

  if (!run) {
    return (
      <div className="space-y-4">
        <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Back</Link>
        <div className="glass-card p-6 text-center text-xs text-muted-foreground">No run yet today. Enter the dungeon!</div>
      </div>
    );
  }

  const stats = [
    { label: 'Damage', value: run.total_damage, icon: Swords },
    { label: 'Defeated', value: run.enemies_defeated, icon: Trophy },
    { label: 'HP Left', value: run.hp_remaining, icon: Heart },
    { label: 'Turns Used', value: run.turns_used, icon: Clock },
    { label: 'Longest Chain', value: run.longest_chain, icon: Sparkles },
    { label: 'XP Earned', value: run.xp_earned, icon: Sparkles },
  ];

  const outcome = run.dungeon_cleared
    ? { label: 'Dungeon Cleared', emoji: '🏆', accent: 'gold' as const }
    : run.hp_remaining <= 0
      ? { label: 'Defeated', emoji: '💀', accent: 'destructive' as const }
      : { label: 'Out of Turns', emoji: '⏳', accent: 'muted' as const };

  const headerBg = outcome.accent === 'gold'
    ? 'linear-gradient(160deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.04))'
    : outcome.accent === 'destructive'
      ? 'linear-gradient(160deg, hsl(var(--destructive) / 0.14), hsl(var(--destructive) / 0.04))'
      : 'linear-gradient(160deg, hsl(var(--primary) / 0.10), hsl(var(--accent) / 0.04))';
  const headerBorder = outcome.accent === 'gold'
    ? 'hsl(var(--gold) / 0.3)'
    : outcome.accent === 'destructive'
      ? 'hsl(var(--destructive) / 0.35)'
      : undefined;

  return (
    <div className="space-y-4 pb-8">
      <Confetti active={showConfetti} />
      <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Home</Link>

      <div className="glass-card p-6 text-center" style={{ background: headerBg, borderColor: headerBorder }}>
        {hero && (
          <div className="flex items-center justify-center gap-2 mb-2">
            <ClassBadge cls={hero.class} size="sm" />
            <p className="text-[12px] font-extrabold truncate max-w-[200px]">{hero.hero_name}</p>
            <span className="text-[10px] font-bold text-muted-foreground">Lv {levelFromXp(hero.xp).level} {getClass(hero.class).name}</span>
          </div>
        )}
        <p className="text-3xl mb-1">{outcome.emoji}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          {outcome.label}
        </p>
        <p className="font-mono text-4xl font-extrabold tabular-nums mb-2" style={{ color: 'hsl(var(--gold))' }}>
          {run.score.toLocaleString()}
        </p>
        {myRank && <p className="text-xs font-bold text-muted-foreground">Today's rank: #{myRank}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass-card p-3 flex items-center gap-2.5">
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="font-mono text-sm font-extrabold tabular-nums">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/rune-delve/leaderboard" className="h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center text-xs font-bold btn-press gap-1.5">
          <Trophy className="w-4 h-4" /> Leaderboard
        </Link>
        <Link to="/rune-delve" className="h-11 rounded-xl bg-muted/40 flex items-center justify-center text-xs font-bold btn-press">Done</Link>
      </div>
    </div>
  );
}
