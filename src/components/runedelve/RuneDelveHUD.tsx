import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import { useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { useRuneWallet } from '@/hooks/useRuneShards';
import { ClassBadge } from './ClassBadge';
import { ShardBalance } from './ShardBalance';
import { ExitRunDialog } from './ExitRunDialog';
import { chapterFor } from '@/lib/runedelve/levelGenerator';
import { cn } from '@/lib/utils';

/**
 * Sticky in-game HUD for Rune Delve.
 * Replaces the standard app page header — back button (left), hero+chapter (center),
 * shard balance (right). On the active /play/:n route, the back arrow triggers an
 * exit-confirmation sheet instead of immediate navigation.
 */
export function RuneDelveHUD() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: hero } = useRuneDelveHero();
  const { data: progress } = useMyProgress();
  const { data: wallet } = useRuneWallet();
  const [exitOpen, setExitOpen] = useState(false);

  const isHome = location.pathname === '/rune-delve';
  const isPlaying = location.pathname.startsWith('/rune-delve/play/');
  const chapter = progress ? chapterFor(progress.highest_unlocked_level) : 1;

  const handleBack = () => {
    if (isHome) {
      navigate('/compete');
    } else if (isPlaying) {
      setExitOpen(true);
    } else {
      navigate('/rune-delve');
    }
  };

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 w-full border-b backdrop-blur-xl',
        )}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: 'linear-gradient(180deg, hsl(var(--rd-stone) / 0.92), hsl(var(--rd-stone) / 0.78))',
          borderColor: 'hsl(var(--rd-arcane) / 0.18)',
          boxShadow: '0 1px 0 hsl(var(--rd-arcane) / 0.08), 0 6px 18px -10px hsl(var(--rd-arcane) / 0.4)',
        }}
      >
        <div className="flex items-center gap-2 h-12 px-2 max-w-[640px] mx-auto">
          <button
            onClick={handleBack}
            aria-label={isHome ? 'Exit Rune Delve' : 'Back'}
            className="w-11 h-11 rounded-xl flex items-center justify-center btn-press text-foreground/90 hover:text-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Link to="/rune-delve" className="flex-1 min-w-0 flex items-center gap-2 btn-press">
            {hero ? (
              <ClassBadge cls={hero.class} size="sm" />
            ) : (
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'hsl(var(--rd-arcane) / 0.18)' }}
              >
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'hsl(var(--rd-arcane))' }} />
              </span>
            )}
            <div className="flex-1 min-w-0 leading-tight">
              <p className="font-rd-display text-[13px] font-extrabold truncate tracking-wide">
                {hero?.hero_name ?? 'Rune Delve'}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/70 truncate">
                Chapter {chapter}{isPlaying && progress ? ` · L${location.pathname.split('/').pop()}` : ''}
              </p>
            </div>
          </Link>

          <Link to="/rune-delve/shop" aria-label="Shop">
            <ShardBalance shards={wallet?.shards ?? 0} size="sm" />
          </Link>
        </div>
      </header>

      <ExitRunDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        onConfirm={() => {
          setExitOpen(false);
          navigate('/compete');
        }}
      />
    </>
  );
}
