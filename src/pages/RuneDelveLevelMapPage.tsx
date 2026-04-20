import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Check, ChevronRight, Star } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useMyProgress, useLevelWindow } from '@/hooks/useRuneDelveCampaign';
import { chapterFor, difficultyTierFor, objectiveLabel, type ObjectiveType } from '@/lib/runedelve/levelGenerator';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

export default function RuneDelveLevelMapPage() {
  const navigate = useNavigate();
  const { data: progress } = useMyProgress();
  const highestUnlocked = progress?.highest_unlocked_level ?? 1;
  const initialChapter = useMemo(() => chapterFor(highestUnlocked), [highestUnlocked]);
  const [chapter, setChapter] = useState(initialChapter);

  const start = (chapter - 1) * 50 + 1;
  const { data: levels, isLoading } = useLevelWindow(start, 50);

  return (
    <div className="space-y-4 pb-8">
      <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Back</Link>

      <div className="space-y-1">
        <h1 className="page-header-title">Level Map</h1>
        <p className="text-[11px] text-muted-foreground">Same levels for every player. Replay any level you've cleared to chase a higher score.</p>
      </div>

      {/* Chapter switcher */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 scrollbar-none">
        {[1, 2, 3].map(ch => {
          const reachable = chapter === ch || chapterFor(highestUnlocked) >= ch;
          const isCurrent = chapter === ch;
          return (
            <button
              key={ch}
              onClick={() => reachable && setChapter(ch)}
              disabled={!reachable}
              className={cn(
                'shrink-0 px-3.5 h-9 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 btn-press border',
                isCurrent
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : reachable
                    ? 'bg-muted/30 text-foreground border-border/40'
                    : 'bg-muted/10 text-muted-foreground border-border/20 opacity-50',
              )}
            >
              {!reachable && <Lock className="w-3 h-3" />}
              Chapter {ch}
              <span className="text-[9px] text-muted-foreground font-bold">L{(ch - 1) * 50 + 1}–{ch * 50}</span>
            </button>
          );
        })}
      </div>

      {isLoading || !levels ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {levels.map(lvl => {
            const isUnlocked = lvl.level_number <= highestUnlocked;
            const isCleared  = lvl.level_number <= (progress?.highest_completed_level ?? 0);
            const isCurrent  = lvl.level_number === highestUnlocked;
            const tier = difficultyTierFor(lvl.level_number);
            const objType = lvl.objective_type as ObjectiveType;
            return (
              <button
                key={lvl.level_number}
                disabled={!isUnlocked}
                onClick={() => navigate(`/rune-delve/play/${lvl.level_number}`)}
                className={cn(
                  'relative aspect-square rounded-xl p-2 flex flex-col items-center justify-center gap-0.5 btn-press border',
                  isCurrent && 'border-primary',
                  !isUnlocked && 'opacity-40 cursor-not-allowed',
                  isCleared && 'bg-success/10 border-success/40',
                  !isCleared && isUnlocked && 'bg-muted/20 border-border/40',
                  !isUnlocked && 'bg-muted/10 border-border/30',
                )}
                style={isCurrent ? { boxShadow: 'var(--shadow-glow)' } : undefined}
                aria-label={`Level ${lvl.level_number}${!isUnlocked ? ' (locked)' : ''}`}
              >
                {!isUnlocked && (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground absolute top-1.5 right-1.5" />
                )}
                {isCleared && (
                  <Check className="w-3.5 h-3.5 absolute top-1.5 right-1.5" style={{ color: 'hsl(var(--success))' }} />
                )}
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Lv</span>
                <span className="text-xl font-extrabold tabular-nums leading-none">{lvl.level_number}</span>
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
