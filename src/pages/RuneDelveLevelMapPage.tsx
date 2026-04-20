import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Check, ChevronRight, Crown, Sparkles } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useMyProgress, useLevelWindow } from '@/hooks/useRuneDelveCampaign';
import {
  chapterFor,
  chapterMeta,
  difficultyTierFor,
  isMilestoneLevel,
  isChapterOpener,
  type ObjectiveType,
} from '@/lib/runedelve/levelGenerator';
import { mechanicsForLevel, introMechanicForLevel, getMechanic } from '@/lib/runedelve/mechanics';
import { cn } from '@/lib/utils';

export default function RuneDelveLevelMapPage() {
  const navigate = useNavigate();
  const { data: progress } = useMyProgress();
  const highestUnlocked = progress?.highest_unlocked_level ?? 1;
  const highestCompleted = progress?.highest_completed_level ?? 0;
  const initialChapter = useMemo(() => chapterFor(highestUnlocked), [highestUnlocked]);
  const [chapter, setChapter] = useState(initialChapter);

  const start = (chapter - 1) * 50 + 1;
  const { data: levels, isLoading } = useLevelWindow(start, 50);
  const meta = chapterMeta(chapter);
  const completedInChapter = Math.max(0, Math.min(50, highestCompleted - start + 1));
  const chapterPct = Math.round((completedInChapter / 50) * 100);

  return (
    <div className="space-y-4 pb-8">
      <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Back</Link>

      {/* Chapter header — flavor + progress */}
      <div className="glass-card p-4" style={{
        background: 'linear-gradient(160deg, hsl(var(--primary) / 0.10), hsl(var(--accent) / 0.04))',
        borderColor: 'hsl(var(--primary) / 0.2)',
      }}>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-primary/15 text-primary tracking-wider">CHAPTER {chapter}</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">L{start}–{start + 49}</span>
        </div>
        <h1 className="text-lg font-extrabold tracking-tight leading-tight">{meta.name}</h1>
        <p className="text-[11px] text-muted-foreground mb-2.5">{meta.subtitle}</p>
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="font-bold text-muted-foreground uppercase tracking-wider">Progress</span>
          <span className="font-mono font-bold tabular-nums">{completedInChapter}/50</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${chapterPct}%` }} />
        </div>
      </div>

      {/* Chapter switcher — always allows preview; per-level lock pips still gate play. */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 scrollbar-none">
        {[1, 2, 3].map(ch => {
          const reached = chapterFor(highestUnlocked) >= ch;
          const isCurrent = chapter === ch;
          return (
            <button
              key={ch}
              onClick={() => setChapter(ch)}
              className={cn(
                'shrink-0 px-3.5 h-9 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 btn-press border',
                isCurrent
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'bg-muted/30 text-foreground border-border/40',
              )}
            >
              {!reached && <Lock className="w-3 h-3 opacity-60" />}
              Ch {ch}
              <span className="text-[9px] text-muted-foreground font-bold">L{(ch - 1) * 50 + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary" /> Next</span>
        <span className="flex items-center gap-1"><Check className="w-2.5 h-2.5" style={{ color: 'hsl(var(--success))' }} /> Cleared</span>
        <span className="flex items-center gap-1"><Crown className="w-2.5 h-2.5" style={{ color: 'hsl(var(--gold))' }} /> Milestone</span>
        <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Locked</span>
      </div>

      {isLoading || !levels ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl skeleton-shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {levels.map(lvl => {
            const isUnlocked = lvl.level_number <= highestUnlocked;
            const isCleared  = lvl.level_number <= highestCompleted;
            const isCurrent  = lvl.level_number === highestUnlocked && !isCleared;
            const tier = difficultyTierFor(lvl.level_number);
            const milestone = isMilestoneLevel(lvl.level_number);
            const opener = isChapterOpener(lvl.level_number);
            const objType = lvl.objective_type as ObjectiveType;
            const lvlMechanics = mechanicsForLevel(lvl.level_number);
            const newestMechanic = lvlMechanics.length ? getMechanic(lvlMechanics[lvlMechanics.length - 1]) : null;
            const introId = introMechanicForLevel(lvl.level_number);
            const mods = (lvl.modifiers ?? {}) as { secondary_objective?: unknown; boss_rule?: unknown };
            const hasSecondary = !!mods.secondary_objective;
            const hasBossRule = !!mods.boss_rule;
            return (
              <button
                key={lvl.level_number}
                disabled={!isUnlocked}
                onClick={() => navigate(`/rune-delve/play/${lvl.level_number}`)}
                className={cn(
                  'relative aspect-square rounded-xl p-2 flex flex-col items-center justify-center gap-0.5 btn-press border overflow-hidden',
                  isCurrent && 'border-primary',
                  !isUnlocked && 'opacity-40 cursor-not-allowed',
                  isCleared && 'bg-success/10 border-success/40',
                  !isCleared && isUnlocked && !milestone && 'bg-muted/20 border-border/40',
                  milestone && isUnlocked && !isCleared && 'border-gold/50',
                  !isUnlocked && 'bg-muted/10 border-border/30',
                )}
                style={{
                  ...(isCurrent ? { boxShadow: 'var(--shadow-glow)' } : undefined),
                  ...(milestone && isUnlocked && !isCleared
                    ? {
                        background: 'linear-gradient(135deg, hsl(var(--gold) / 0.12), hsl(var(--premium-warm) / 0.06))',
                        boxShadow: 'var(--shadow-gold)',
                      }
                    : undefined),
                }}
                aria-label={`Level ${lvl.level_number}${!isUnlocked ? ' (locked)' : ''}${milestone ? ' (milestone)' : ''}`}
              >
                {/* Status icons (top-right) */}
                {!isUnlocked && (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground absolute top-1.5 right-1.5" />
                )}
                {isCleared && (
                  <Check className="w-3.5 h-3.5 absolute top-1.5 right-1.5" style={{ color: 'hsl(var(--success))' }} />
                )}
                {milestone && !isCleared && isUnlocked && (
                  <Crown className="w-3.5 h-3.5 absolute top-1.5 right-1.5" style={{ color: 'hsl(var(--gold))' }} />
                )}

                {/* Chapter opener gleam (only when no mechanic icon would collide) */}
                {opener && isUnlocked && !newestMechanic && (
                  <Sparkles className="w-3 h-3 absolute top-1.5 left-1.5" style={{ color: 'hsl(var(--accent))' }} />
                )}

                {/* Mechanic icon (top-left) — and NEW pip if this level introduces it */}
                {newestMechanic && isUnlocked && (
                  <span
                    className="absolute top-1 left-1 inline-flex items-center justify-center w-4 h-4 rounded-md bg-background/70 border border-primary/30 text-[10px] leading-none"
                    title={newestMechanic.name}
                    aria-label={`Mechanic: ${newestMechanic.name}`}
                  >
                    {newestMechanic.icon}
                  </span>
                )}
                {introId && isUnlocked && (
                  <span className="absolute -top-1 -left-1 px-1 py-px rounded-sm text-[7px] font-extrabold uppercase tracking-wider bg-primary text-primary-foreground shadow">
                    New
                  </span>
                )}

                {/* "Next up" subtle pulse on current level */}
                {isCurrent && (
                  <span
                    className="absolute inset-0 rounded-xl pointer-events-none animate-pulse"
                    style={{ boxShadow: 'inset 0 0 0 1.5px hsl(var(--primary) / 0.5)' }}
                  />
                )}

                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Lv</span>
                <span className={cn(
                  'text-xl font-extrabold tabular-nums leading-none',
                  isCurrent && 'text-primary',
                  milestone && !isCleared && isUnlocked && 'text-gold',
                )}>{lvl.level_number}</span>
                <div className="flex gap-0.5 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ background: i < tier ? 'hsl(var(--gold))' : 'hsl(var(--muted) / 0.5)' }}
                    />
                  ))}
                </div>
                {objType !== 'defeat_all' && isUnlocked && (
                  <span className="text-[7px] font-bold uppercase tracking-wider text-primary mt-0.5 truncate w-full text-center">
                    {objType === 'survive' ? 'Survive' : objType === 'reach_score' ? 'Score' : 'Elite'}
                  </span>
                )}
                {/* Corner glyphs — bonus goal & boss rule hints. */}
                {(hasSecondary || hasBossRule) && isUnlocked && (
                  <span className="absolute bottom-1 right-1 text-[10px] leading-none" aria-hidden>
                    {hasBossRule ? '👑' : '🎯'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {progress && progress.highest_unlocked_level > 0 && (
        <button
          onClick={() => navigate(`/rune-delve/play/${progress.highest_unlocked_level}`)}
          className="w-full h-12 rounded-xl font-extrabold text-sm btn-press flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
            color: 'white',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          Jump to Level {progress.highest_unlocked_level} <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
