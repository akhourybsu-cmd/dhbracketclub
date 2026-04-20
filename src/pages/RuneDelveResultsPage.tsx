import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy, Swords, Heart, Clock, Sparkles, ChevronRight, Star } from 'lucide-react';
import { useLevel, useMyLevelRun, useLevelBestScores, useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import { Confetti } from '@/components/Confetti';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import { getClass, levelFromXp } from '@/lib/runedelve/classConfig';
import { starsFor } from '@/lib/runedelve/levelGenerator';
import { mechanicsForLevel, getMechanic, type MechanicId } from '@/lib/runedelve/mechanics';
import { getBossRule, type BossRuleId } from '@/lib/runedelve/bossRules';
import { secondaryLabel, type SecondaryObjective } from '@/lib/runedelve/layeredGoals';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export default function RuneDelveResultsPage() {
  const navigate = useNavigate();
  const { levelNumber: levelParam } = useParams<{ levelNumber: string }>();
  const levelNumber = Math.max(1, parseInt(levelParam ?? '1', 10) || 1);

  const { data: level } = useLevel(levelNumber);
  const { data: run } = useMyLevelRun(level?.id);
  const { data: hero } = useRuneDelveHero();
  const { data: progress } = useMyProgress();
  const { data: topRuns } = useLevelBestScores(level?.id);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (run?.dungeon_cleared) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(t);
    }
  }, [run?.dungeon_cleared]);

  if (!run || !level) {
    return (
      <div className="space-y-4">
        <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Back</Link>
        <div className="glass-card p-6 text-center text-xs text-muted-foreground">No run yet for this level. Enter the dungeon!</div>
      </div>
    );
  }

  const stars = starsFor(run.score, levelNumber, run.dungeon_cleared);
  const stats = [
    { label: 'Damage', value: run.total_damage, icon: Swords },
    { label: 'Defeated', value: run.enemies_defeated, icon: Trophy },
    { label: 'HP Left', value: run.hp_remaining, icon: Heart },
    { label: 'Turns Used', value: run.turns_used, icon: Clock },
    { label: 'Longest Chain', value: run.longest_chain, icon: Sparkles },
    { label: 'XP Earned', value: run.xp_earned, icon: Sparkles },
  ];

  const outcome = run.dungeon_cleared
    ? { label: `Level ${levelNumber} Cleared`, emoji: '🏆', accent: 'gold' as const }
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

  const nextLevel = levelNumber + 1;
  const nextUnlocked = (progress?.highest_unlocked_level ?? 1) >= nextLevel;

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
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{outcome.label}</p>
        <p className="font-mono text-4xl font-extrabold tabular-nums mb-2" style={{ color: 'hsl(var(--gold))' }}>
          {run.score.toLocaleString()}
        </p>
        {run.dungeon_cleared && (
          <div className="flex items-center justify-center gap-1 mt-2">
            {[1,2,3].map(s => (
              <Star
                key={s}
                className={cn('w-6 h-6', s <= stars ? 'fill-current' : 'opacity-30')}
                style={{ color: 'hsl(var(--gold))' }}
              />
            ))}
          </div>
        )}
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

      {/* Top scores for this level */}
      {topRuns && topRuns.length > 0 && (
        <div className="glass-card p-3">
          <h3 className="font-bold text-[12px] mb-2 flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-gold" /> Top scores · Level {levelNumber}</h3>
          <div className="space-y-1.5">
            {topRuns.slice(0, 5).map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 text-[11px]">
                <span className="w-4 font-mono font-bold text-muted-foreground">#{r.rank}</span>
                <span className="flex-1 truncate font-semibold">{r.hero?.hero_name ?? 'Hero'}</span>
                <span className="font-mono font-bold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{r.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate(`/rune-delve/play/${levelNumber}`)}
          className="h-11 rounded-xl bg-muted/40 flex items-center justify-center text-xs font-bold btn-press"
        >
          Retry
        </button>
        {run.dungeon_cleared && nextUnlocked ? (
          <button
            onClick={() => navigate(`/rune-delve/play/${nextLevel}`)}
            className="h-11 rounded-xl font-extrabold text-xs btn-press flex items-center justify-center gap-1.5"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
              color: 'white',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            Next Level <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <Link to="/rune-delve/levels" className="h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center text-xs font-bold btn-press gap-1.5">
            Level Map
          </Link>
        )}
      </div>
    </div>
  );
}
