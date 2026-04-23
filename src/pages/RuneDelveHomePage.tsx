import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, Flame, ChevronRight, Swords, BookOpen, Map, ShoppingBag, Shield, Calendar, Target } from 'lucide-react';
import { useRuneDelveHero, useEnsureHero } from '@/hooks/useRuneDelveHero';
import { useAllClassProgress } from '@/hooks/useRuneDelveClassProgress';
import { useMyProgress, useCampaignLeaderboard } from '@/hooks/useRuneDelveCampaign';
import { useRuneWallet } from '@/hooks/useRuneShards';
import { useLoadout } from '@/hooks/useLoadout';
import { CLASS_LIST, getClass, levelFromXp, titleForLevel, type HeroClass } from '@/lib/runedelve/classConfig';
import { chapterFor, chapterMeta } from '@/lib/runedelve/levelGenerator';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import { ShardBalance } from '@/components/runedelve/ShardBalance';
import { RELIC_BY_ID } from '@/lib/runedelve/relics';
import { HowToPlaySheet } from '@/components/runedelve/HowToPlaySheet';
import { CodexSheet } from '@/components/runedelve/CodexSheet';
import { useTodayDaily, useMyDailyRun, useMyDailyStreak } from '@/hooks/useDailyChallenge';
import { getDailyModifier } from '@/lib/runedelve/dailyModifiers';
import { useQuestSummary } from '@/hooks/useQuests';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const HELP_SEEN_KEY = 'rune_delve_seen_help_v2';

export default function RuneDelveHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: hero, isLoading: heroLoading } = useRuneDelveHero();
  const { data: classTracks } = useAllClassProgress();
  const { data: progress } = useMyProgress();
  const { data: leaderboard } = useCampaignLeaderboard();
  const { data: wallet } = useRuneWallet();
  const { data: loadout } = useLoadout(hero?.class);
  const ensureHero = useEnsureHero();
  const [picking, setPicking] = useState<HeroClass | null>(null);
  const [heroName, setHeroName] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const today = useTodayDaily();
  const { data: myDailyRun } = useMyDailyRun();
  const { data: dailyStreak } = useMyDailyStreak();
  const questSummary = useQuestSummary();

  // First-visit auto-open of help sheet.
  useEffect(() => {
    if (!hero) return;
    try {
      if (!localStorage.getItem(HELP_SEEN_KEY)) {
        setHelpOpen(true);
        localStorage.setItem(HELP_SEEN_KEY, '1');
      }
    } catch {}
  }, [hero]);

  // First-time hero creation: name + class
  if (!heroLoading && user && !hero) {
    const trimmed = heroName.trim();
    const canBegin = !!picking && trimmed.length >= 2 && !ensureHero.isPending;
    return (
      <div className="space-y-5 pb-8">
        <div className="text-center space-y-2">
          <h1 className="rd-title page-header-title flex items-center gap-2 justify-center text-2xl">
            <Sparkles className="w-5 h-5 text-primary" /> Forge your hero
          </h1>
          <p className="text-xs text-foreground/80 px-4">Name your champion and choose a class. Your hero persists across the entire campaign.</p>
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

  if (heroLoading || !hero || !progress) {
    return (
      <div className="space-y-3">
        <div className="h-32 rounded-2xl skeleton-shimmer" />
        <div className="h-24 rounded-2xl skeleton-shimmer" />
      </div>
    );
  }

  const cls = getClass(hero.class);
  const activeTrack = (classTracks ?? []).find(t => t.class === hero.class);
  const activeXp = activeTrack?.xp ?? hero.xp;
  const activeLevel = activeTrack?.level ?? hero.level;
  const activeTitle = activeTrack?.cosmetic_title ?? hero.cosmetic_title ?? titleForLevel(activeLevel, hero.class);
  const lvl = levelFromXp(activeXp);
  const xpPct = Math.round((lvl.intoLevel / lvl.needed) * 100);
  const currentLevel = progress.highest_unlocked_level;
  const chapter = chapterFor(currentLevel);
  const chapMeta = chapterMeta(chapter);
  const chapterStart = (chapter - 1) * 50 + 1;
  const chapterEnd = chapter * 50;
  const completedInChapter = Math.max(0, Math.min(50, progress.highest_completed_level - chapterStart + 1));
  const chapterPct = Math.round((completedInChapter / 50) * 100);
  const sortedBoard = leaderboard ?? [];
  const myRank = sortedBoard.find(l => l.user_id === user?.id)?.rank;
  const top3 = sortedBoard.slice(0, 3);
  // Friend comparison teaser — closest player ahead of you (if any).
  const ahead = sortedBoard.find(
    l => l.user_id !== user?.id && l.highest_completed_level > (progress.highest_completed_level ?? 0),
  );
  const aheadGap = ahead ? ahead.highest_completed_level - (progress.highest_completed_level ?? 0) : 0;

  return (
    <div className="space-y-4 pb-8">
      {/* Continue banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass-card p-5 relative overflow-hidden" style={{
          background: 'linear-gradient(160deg, hsl(var(--primary) / 0.12), hsl(var(--accent) / 0.06))',
          borderColor: 'hsl(var(--primary) / 0.2)',
        }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-rd-display px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-primary/20 text-primary tracking-[0.18em]">CHAPTER {chapter}</span>
            <span className="text-[10px] font-extrabold text-foreground/70 uppercase tracking-wider">L{chapterStart}–{chapterEnd}</span>
          </div>
          <h2 className="rd-title text-2xl tracking-wide leading-tight text-foreground">{chapMeta.name}</h2>
          <p className="text-[12px] text-foreground/75 mb-1 italic">{chapMeta.subtitle}</p>
          <p className="text-[11px] font-extrabold text-primary mb-3">Welcome back, <span className="font-rd-display">{hero.hero_name}</span></p>

          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-muted-foreground">Chapter {chapter} progress</span>
              <span className="font-mono font-bold tabular-nums">{completedInChapter}/50</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${chapterPct}%` }} />
            </div>
          </div>

          <button
            onClick={() => navigate(`/rune-delve/play/${currentLevel}`)}
            className="w-full h-12 rounded-xl font-extrabold text-sm btn-press flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
              color: 'white',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <Swords className="w-4 h-4" /> Continue · Level {currentLevel}
          </button>
          <Link
            to="/rune-delve/levels"
            className="mt-2 w-full h-10 rounded-lg bg-muted/40 flex items-center justify-center gap-1.5 text-[12px] font-bold btn-press"
          >
            <Map className="w-3.5 h-3.5" /> Level Map
          </Link>
        </div>
      </motion.div>

      {/* Daily Challenge — single attempt per UTC day, modifier-stacked twist on the campaign. */}
      {(() => {
        const playedToday = !!myDailyRun;
        const stars = myDailyRun?.stars ?? 0;
        const modIcons = today.modifiers.map(id => getDailyModifier(id)).filter(Boolean);
        return (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Link to="/rune-delve/daily" className="block">
              <div
                className="glass-card p-4 btn-press relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--accent) / 0.14), hsl(var(--gold) / 0.08))',
                  borderColor: 'hsl(var(--accent) / 0.35)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <span className="font-rd-display text-[11px] font-extrabold tracking-[0.18em] text-accent uppercase">Daily Challenge</span>
                  {playedToday && (
                    <span className="ml-auto text-[10px] font-extrabold text-foreground/70 tabular-nums">
                      {'⭐'.repeat(stars)}{stars === 0 && '—'}
                    </span>
                  )}
                </div>
                <p className="text-[12px] font-extrabold text-foreground mb-1">
                  {playedToday ? 'Run completed · Come back tomorrow' : 'A fresh trial awaits'}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {modIcons.map(m => (
                    <span
                      key={m!.id}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-foreground/5 border border-foreground/10"
                      title={m!.rule}
                    >
                      {m!.icon} {m!.name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-[10px] font-extrabold text-foreground/70">
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3 text-gold" />
                    {dailyStreak?.current_streak ?? 0}-day streak
                  </span>
                  <span>·</span>
                  <span>L{today.levelNumber}</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-accent" />
                </div>
              </div>
            </Link>
          </motion.div>
        );
      })()}

      {/* Quests — daily + weekly objectives with bonus shard rewards. */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Link to="/rune-delve/quests" className="block">
          <div
            className="glass-card p-4 btn-press relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.10), hsl(var(--accent) / 0.08))',
              borderColor: 'hsl(var(--primary) / 0.25)',
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Target className="w-4 h-4 text-primary" />
              <span className="font-rd-display text-[11px] font-extrabold tracking-[0.18em] text-primary uppercase">Quests</span>
              {questSummary.claimable > 0 && (
                <span className="ml-auto text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-gold/20 text-gold tabular-nums">
                  {questSummary.claimable} ready to claim
                </span>
              )}
            </div>
            <p className="text-[12px] font-extrabold text-foreground mb-0.5">
              {questSummary.claimable > 0
                ? `Tap to claim your bonus shards`
                : `${questSummary.total} active · 3 daily + 3 weekly`}
            </p>
            <div className="flex items-center gap-2 text-[10px] font-extrabold text-foreground/70">
              <span>Earn bonus 💎 shards by completing objectives</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary" />
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Hero snapshot */}
      <Link to="/rune-delve/hero" className="block">
        <div className="glass-card p-4 flex items-center gap-3 btn-press">
          <ClassBadge cls={hero.class} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-rd-display font-extrabold text-[15px] truncate tracking-wide">{hero.hero_name}</p>
            {activeTitle && (
              <p className="text-[10px] font-extrabold text-primary truncate">
                ✦ {activeTitle}
              </p>
            )}
            <p className="text-[10px] text-foreground/75 font-extrabold mt-0.5">{cls.name} · Lv {activeLevel}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-extrabold text-foreground/75">Lv {activeLevel}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${xpPct}%` }} />
              </div>
              <span className="text-[10px] font-mono text-foreground/70 tabular-nums">{lvl.intoLevel}/{lvl.needed}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-[10px] font-extrabold text-foreground/80">
                <Flame className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} /> {hero.current_streak}-day streak
              </span>
              <span className="text-[10px] text-foreground/70">· {progress.total_levels_cleared} cleared</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-foreground/60" />
        </div>
      </Link>

      {/* Campaign leaderboard preview */}
      <Link to="/rune-delve/leaderboard" className="block">
        <div className="glass-card p-4 btn-press">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-rd-display font-extrabold text-[14px] flex items-center gap-1.5 tracking-wide"><Trophy className="w-3.5 h-3.5 text-gold" /> Campaign Leaders</h3>
            {myRank && <span className="text-[10px] font-extrabold text-foreground/75">You: #{myRank}</span>}
          </div>
          {ahead && (
            <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-accent truncate">
                {aheadGap === 1 ? '1 level' : `${aheadGap} levels`} behind {ahead.hero?.hero_name ?? ahead.profile.display_name ?? 'a rival'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-accent shrink-0" />
            </div>
          )}
          {top3.length === 0 ? (
            <p className="text-[11px] text-center text-foreground/75 py-2">Be the first to delve.</p>
          ) : (
            <div className="space-y-1.5">
              {top3.map((r) => (
                <div key={r.id} className="flex items-center gap-2.5 text-[12px]">
                  <span className="w-5 font-mono font-extrabold text-foreground/75">#{r.rank}</span>
                  {r.hero?.class && <ClassBadge cls={r.hero.class as HeroClass} size="sm" />}
                  <span className="font-rd-display flex-1 truncate font-extrabold tracking-wide">{r.hero?.hero_name ?? r.profile.display_name}</span>
                  <span className="font-mono font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>L{r.highest_completed_level}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* How to play + Codex */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setHelpOpen(true)}
          className="glass-card p-3 flex items-center justify-center gap-2 text-[12px] font-bold btn-press text-primary"
        >
          <BookOpen className="w-3.5 h-3.5" /> How to Play
        </button>
        <button
          onClick={() => setCodexOpen(true)}
          className="glass-card p-3 flex items-center justify-center gap-2 text-[12px] font-bold btn-press text-accent"
        >
          📖 Codex
        </button>
      </div>

      {/* Loadout preview + Shop/Armory tiles */}
      {loadout && (() => {
        const equipped = [loadout.slot_1, loadout.slot_2, loadout.slot_3].filter(Boolean) as string[];
        return (
          <Link to="/rune-delve/armory" className="block">
            <div className="glass-card p-3 btn-press flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-extrabold">Active loadout · {getClass(hero.class).name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {equipped.length === 0 ? 'No relics equipped — tap to set up' : equipped.map(id => RELIC_BY_ID[id]?.name ?? '?').join(' · ')}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </Link>
        );
      })()}

      <div className="grid grid-cols-2 gap-2">
        <Link to="/rune-delve/shop" className="glass-card p-3 text-center text-[12px] font-bold btn-press inline-flex items-center justify-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5 text-primary" /> Shop
        </Link>
        <Link to="/rune-delve/armory" className="glass-card p-3 text-center text-[12px] font-bold btn-press inline-flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-primary" /> Armory
        </Link>
      </div>

      {/* Footer links */}
      <div className="grid grid-cols-3 gap-2">
        <Link to="/rune-delve/bestiary" className="glass-card p-3 text-center text-[12px] font-bold btn-press inline-flex items-center justify-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-primary" /> Bestiary
        </Link>
        <Link to="/rune-delve/history" className="glass-card p-3 text-center text-[12px] font-bold btn-press">History →</Link>
        <Link to="/rune-delve/hero" className="glass-card p-3 text-center text-[12px] font-bold btn-press">Hero →</Link>
      </div>

      <HowToPlaySheet open={helpOpen} onOpenChange={setHelpOpen} heroClass={hero.class} />
      <CodexSheet open={codexOpen} onOpenChange={setCodexOpen} />
    </div>
  );
}
