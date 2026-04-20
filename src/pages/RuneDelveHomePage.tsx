import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, Flame, ChevronRight, Swords } from 'lucide-react';
import { useRuneDelveHero, useEnsureHero } from '@/hooks/useRuneDelveHero';
import { useTodayDungeon, useMyTodayRun, useDailyLeaderboard } from '@/hooks/useRuneDelve';
import { CLASS_LIST, getClass, levelFromXp, titleForLevel, type HeroClass } from '@/lib/runedelve/classConfig';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function RuneDelveHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: hero, isLoading: heroLoading } = useRuneDelveHero();
  const { data: dungeon } = useTodayDungeon();
  const { data: myRun } = useMyTodayRun(dungeon?.id);
  const { data: leaderboard } = useDailyLeaderboard(dungeon?.id);
  const ensureHero = useEnsureHero();
  const [picking, setPicking] = useState<HeroClass | null>(null);
  const [heroName, setHeroName] = useState('');

  // First-time hero creation: name + class
  if (!heroLoading && user && !hero) {
    const trimmed = heroName.trim();
    const canBegin = !!picking && trimmed.length >= 2 && !ensureHero.isPending;
    return (
      <div className="space-y-5 pb-8">
        <Link to="/compete" className="back-link">← Back to Compete</Link>
        <div className="text-center space-y-2">
          <h1 className="page-header-title flex items-center gap-2 justify-center">
            <Sparkles className="w-5 h-5 text-primary" /> Forge your hero
          </h1>
          <p className="text-xs text-muted-foreground px-4">Name your champion and choose a class. Your hero persists across every daily delve.</p>
        </div>

        <div className="glass-card p-4 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hero name</label>
          <input
            value={heroName}
            onChange={e => setHeroName(e.target.value)}
            placeholder="e.g. Thalia Stormvein"
            maxLength={24}
            autoFocus
            className="form-input w-full px-3 text-base font-bold"
          />
          <p className="text-[10px] text-muted-foreground">{trimmed.length}/24 · You can rename later.</p>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Choose a class</p>
          <div className="grid grid-cols-1 gap-2.5">
            {CLASS_LIST.map(c => (
              <button
                key={c.id}
                onClick={() => setPicking(c.id)}
                className={cn(
                  'glass-card p-4 text-left flex items-center gap-3 btn-press',
                  picking === c.id && 'border-primary/50',
                )}
                style={picking === c.id ? { boxShadow: 'var(--shadow-glow)' } : undefined}
              >
                <ClassBadge cls={c.id} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-[14px]">{c.name} <span className="text-xs">{c.emoji}</span></p>
                  <p className="text-[11px] text-muted-foreground">{c.passive}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: `hsl(var(--${c.color}))` }}>
                    ⚡ {c.abilityName}: {c.abilityDesc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={!canBegin}
          onClick={async () => {
            if (!picking || trimmed.length < 2) return;
            await ensureHero.mutateAsync({ cls: picking, hero_name: trimmed });
          }}
          className="w-full h-12 rounded-xl font-extrabold text-sm btn-press disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
            color: 'white',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          {ensureHero.isPending ? 'Summoning…' : trimmed.length < 2 ? 'Name your hero' : !picking ? 'Pick a class' : `Begin ${trimmed}'s journey`}
        </button>
      </div>
    );
  }

  if (heroLoading || !hero || !dungeon) {
    return <div className="space-y-3"><div className="h-32 rounded-2xl skeleton-shimmer" /><div className="h-24 rounded-2xl skeleton-shimmer" /></div>;
  }

  const cls = getClass(hero.class);
  const lvl = levelFromXp(hero.xp);
  const xpPct = Math.round((lvl.intoLevel / lvl.needed) * 100);
  const myRank = leaderboard?.find(l => l.user_id === user?.id)?.rank;
  const top3 = (leaderboard ?? []).slice(0, 3);

  return (
    <div className="space-y-4 pb-8">
      <Link to="/compete" className="back-link">← Back to Compete</Link>

      {/* Today's challenge banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass-card p-5 relative overflow-hidden" style={{
          background: 'linear-gradient(160deg, hsl(var(--primary) / 0.12), hsl(var(--accent) / 0.06))',
          borderColor: 'hsl(var(--primary) / 0.2)',
        }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-primary/15 text-primary tracking-wider">DAILY</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight mb-0.5">Rune Delve</h2>
          <p className="text-[11px] font-bold text-primary/90 mb-2">Welcome back, {hero.hero_name}</p>
          <p className="text-xs text-muted-foreground mb-3">
            Defeat {dungeon.enemy_config?.length ?? 2} enemies in {dungeon.max_turns} turns. Chain runes to attack, charge mana, heal, and guard.
          </p>
          {myRun ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">Today's score</span>
                <span className="font-mono text-lg font-extrabold" style={{ color: 'hsl(var(--gold))' }}>{myRun.score.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/rune-delve/results" className="h-10 rounded-lg bg-muted/40 flex items-center justify-center text-[11px] font-bold gap-1">View Results <ChevronRight className="w-3 h-3" /></Link>
                <Link to="/rune-delve/leaderboard" className="h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold gap-1">Leaderboard <Trophy className="w-3 h-3" /></Link>
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-1">Come back tomorrow for a new dungeon.</p>
            </div>
          ) : (
            <button
              onClick={() => navigate('/rune-delve/play')}
              className="w-full h-12 rounded-xl font-extrabold text-sm btn-press flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
                color: 'white',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <Swords className="w-4 h-4" /> Enter Dungeon
            </button>
          )}
        </div>
      </motion.div>

      {/* Hero snapshot */}
      <Link to="/rune-delve/hero" className="block">
        <div className="glass-card p-4 flex items-center gap-3 btn-press">
          <ClassBadge cls={hero.class} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-[14px] truncate">{hero.hero_name}{titleForLevel(lvl.level) && <span className="text-[10px] font-bold text-primary ml-1">· {titleForLevel(lvl.level)}</span>}</p>
            <p className="text-[10px] text-muted-foreground font-bold mt-0.5">{cls.name} · Lv {lvl.level}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-muted-foreground">Lv {lvl.level}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${xpPct}%` }} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{lvl.intoLevel}/{lvl.needed}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                <Flame className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} /> {hero.current_streak}-day streak
              </span>
              <span className="text-[10px] text-muted-foreground">· Best {hero.best_streak}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </Link>

      {/* Leaderboard preview */}
      <Link to="/rune-delve/leaderboard" className="block">
        <div className="glass-card p-4 btn-press">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-[13px] flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-gold" /> Today's Leaderboard</h3>
            {myRank && <span className="text-[10px] text-muted-foreground">You: #{myRank}</span>}
          </div>
          {top3.length === 0 ? (
            <p className="text-[11px] text-center text-muted-foreground py-2">Be the first to delve.</p>
          ) : (
            <div className="space-y-1.5">
              {top3.map((r) => (
                <div key={r.id} className="flex items-center gap-2.5 text-[12px]">
                  <span className="w-5 font-mono font-bold text-muted-foreground">#{r.rank}</span>
                  {r.hero?.class && <ClassBadge cls={r.hero.class as HeroClass} size="sm" />}
                  <span className="flex-1 truncate font-semibold">{r.profile.display_name}</span>
                  {r.dungeon_cleared && <span className="text-[9px] font-bold text-success">CLEAR</span>}
                  <span className="font-mono font-bold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{r.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Footer links */}
      <div className="grid grid-cols-2 gap-2">
        <Link to="/rune-delve/history" className="glass-card p-3 text-center text-[12px] font-bold btn-press">History →</Link>
        <Link to="/rune-delve/hero" className="glass-card p-3 text-center text-[12px] font-bold btn-press">Hero →</Link>
      </div>
    </div>
  );
}
