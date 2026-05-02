import { useState } from 'react';
import { useLocation, useNavigate, Link, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import draftEmblem from '@/assets/draft-emblem.png';
import { useCurrentSeason } from '@/hooks/useDraftSeasons';
import { DraftArenaExitDialog } from './DraftArenaExitDialog';

/**
 * Sticky in-game HUD for the Draft Arena standalone shell.
 * Replaces the DH Club page header while inside /drafts/*.
 * Mirrors the Pick'em / Nexus / RuneDelve HUD pattern (gold + charcoal skin).
 */
export function DraftArenaHUD() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { season } = useCurrentSeason();
  const [exitOpen, setExitOpen] = useState(false);

  const path = location.pathname;
  const isHub = path === '/drafts';

  // Contextual subtitle per route
  const subtitle = (() => {
    if (path === '/drafts') return 'War Room · All Drafts';
    if (path === '/drafts/create') return 'New Draft · Setup';
    if (path === '/drafts/seasons') return 'Seasons · Archive';
    if (path.startsWith('/drafts/seasons/')) return 'Season · Recap';
    if (path.startsWith('/drafts/')) return 'Live Draft Room';
    return 'Draft Arena';
  })();

  // Season chip — short tag (uses season_label like "S4" if available, else year)
  const seasonChip = season
    ? (season.season_label || (season.year ? `'${String(season.year).slice(-2)}` : null))
    : null;

  const handleBack = () => {
    if (isHub) {
      setExitOpen(true);
    } else {
      navigate('/drafts');
    }
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-xl"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background:
            'linear-gradient(180deg, hsl(160 45% 6% / 0.96), hsl(160 50% 4% / 0.82))',
          borderColor: 'hsl(45 80% 50% / 0.22)',
          boxShadow:
            '0 1px 0 hsl(45 95% 55% / 0.15), 0 6px 18px -10px hsl(45 95% 55% / 0.4)',
        }}
      >
        <div className="flex items-center gap-2 h-12 px-2 max-w-[640px] mx-auto">
          <button
            type="button"
            onClick={handleBack}
            aria-label={isHub ? 'Exit Draft Arena' : 'Back to Draft Arena'}
            className="w-11 h-11 rounded-xl flex items-center justify-center btn-press text-white/90 active:text-gold"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Link to="/drafts" className="flex-1 min-w-0 flex items-center gap-2.5 btn-press">
            <span
              className="relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, hsl(45 95% 55% / 0.35), hsl(152 72% 36% / 0.22))',
                border: '1px solid hsl(45 95% 55% / 0.45)',
                boxShadow: '0 0 12px hsl(45 95% 55% / 0.35)',
              }}
            >
              <img
                src={draftEmblem}
                alt=""
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
                style={{ filter: 'drop-shadow(0 0 4px hsl(45 95% 55% / 0.8))' }}
              />
            </span>
            <div className="flex-1 min-w-0 leading-tight">
              <p
                className="text-[12px] font-black uppercase tracking-[0.18em] truncate"
                style={{ color: 'hsl(45 95% 60%)' }}
              >
                Draft Arena
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60 truncate">
                {subtitle}
              </p>
            </div>
          </Link>

          {seasonChip && (
            <span
              className="h-9 px-2.5 rounded-lg flex items-center text-[11px] font-black tabular-nums uppercase"
              style={{
                background: 'hsl(45 95% 55% / 0.14)',
                border: '1px solid hsl(45 95% 55% / 0.36)',
                color: 'hsl(45 95% 70%)',
                textShadow: '0 0 8px hsl(45 95% 55% / 0.35)',
              }}
            >
              {seasonChip}
            </span>
          )}

          {!isHub && (
            <Link
              to="/compete"
              aria-label="Standings"
              className="w-9 h-9 rounded-lg flex items-center justify-center btn-press"
              style={{
                background: 'hsl(45 95% 55% / 0.12)',
                border: '1px solid hsl(45 95% 55% / 0.28)',
                color: 'hsl(45 95% 60%)',
              }}
            >
              <Trophy className="w-4 h-4" />
            </Link>
          )}
        </div>
      </header>

      <DraftArenaExitDialog
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
