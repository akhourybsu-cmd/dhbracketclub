// Rune Delve — Continue Delve banner
//
// Hero affordance on the Home page. Designed to read as a torchlit
// chamber-mouth, not a tactical resume card. Replaces the previous
// Nexus-flavored bracket framing with: warm stone gradient, drifting
// torchlight, arcane circle motif behind the preview, ✦ runic separator,
// and Cinzel serif for the chamber name.

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Swords, ChevronRight, Map } from 'lucide-react';
import { RuneLayoutPreview } from './RuneLayoutPreview';
import type { RuneLayout } from '@/lib/runedelve/runeLayouts';

interface Props {
  layout: RuneLayout;
  levelNumber: number;
  chapterNumber: number;
  chapterName: string;
  chapterSubtitle: string;
  cleared: number;
  total: number;
  heroName: string | null | undefined;
}

export function ContinueDelveBanner({
  layout, levelNumber, chapterNumber, chapterName, chapterSubtitle,
  cleared, total, heroName,
}: Props) {
  const accent = `hsl(${layout.preview.accent})`;
  const pct = total > 0 ? Math.min(100, Math.round((cleared / total) * 100)) : 0;
  const heroFirst = heroName?.split(' ')[0] ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        // Warm torchlit stone — clearly different from Nexus's tactical card.
        background:
          'radial-gradient(ellipse 110% 75% at 50% 0%, hsl(28 55% 16% / 0.95), transparent 70%),' +
          'radial-gradient(ellipse 90% 65% at 100% 100%, hsl(15 60% 10% / 0.95), transparent 70%),' +
          'linear-gradient(160deg, hsl(22 35% 10%), hsl(20 40% 5%))',
        border: '1px solid hsl(35 70% 35% / 0.5)',
        boxShadow:
          '0 0 28px -8px hsl(28 90% 45% / 0.45), ' +
          'inset 0 1px 0 hsl(38 70% 60% / 0.14), ' +
          'inset 0 0 0 1px hsl(28 60% 30% / 0.18)',
      }}
    >
      {/* Cross-hatch rune-rubbing texture */}
      <svg
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.18, mixBlendMode: 'overlay' }}
      >
        <defs>
          <pattern id="rd-banner-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(38)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="hsl(35 55% 50%)" strokeWidth="0.55" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#rd-banner-hatch)" />
      </svg>

      {/* Drifting torchlight gradients */}
      <div
        aria-hidden
        className="absolute -top-10 -left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, hsl(28 100% 55% / 0.22), transparent 65%)',
          filter: 'blur(18px)',
          animation: 'rd-torch-flicker 4.2s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden
        className="absolute -bottom-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, hsl(20 95% 45% / 0.18), transparent 65%)',
          filter: 'blur(20px)',
          animation: 'rd-torch-flicker 5.6s ease-in-out infinite 1s',
        }}
      />

      {/* Arcane circle motif behind the preview */}
      <svg
        aria-hidden
        className="absolute pointer-events-none"
        width="200"
        height="200"
        viewBox="0 0 200 200"
        style={{
          left: '-30px',
          top: '14px',
          opacity: 0.18,
        }}
      >
        <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(40 80% 60%)" strokeWidth="0.8" strokeDasharray="2 4" />
        <circle cx="100" cy="100" r="70" fill="none" stroke="hsl(40 80% 60%)" strokeWidth="0.5" strokeDasharray="1 2" />
        <circle cx="100" cy="100" r="50" fill="none" stroke="hsl(40 80% 60%)" strokeWidth="0.5" />
        {/* Cardinal rune ticks */}
        {[0, 90, 180, 270].map(deg => (
          <line
            key={deg}
            x1="100" y1="14" x2="100" y2="22"
            stroke="hsl(40 90% 70%)"
            strokeWidth="1.2"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
      </svg>

      <style>{`
        @keyframes rd-torch-flicker {
          0%, 100% { opacity: 1; transform: scale(1); }
          40% { opacity: 0.7; transform: scale(1.05); }
          60% { opacity: 1; transform: scale(0.97); }
        }
        @keyframes rd-rune-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.18); }
        }
      `}</style>

      {/* Rune embers in opposing corners */}
      <span
        aria-hidden
        className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full"
        style={{ background: 'hsl(40 100% 70%)', boxShadow: '0 0 8px hsl(28 100% 55%)', animation: 'rd-rune-pulse 2.4s ease-in-out infinite' }}
      />
      <span
        aria-hidden
        className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full"
        style={{ background: 'hsl(40 100% 70%)', boxShadow: '0 0 8px hsl(28 100% 55%)', animation: 'rd-rune-pulse 2.4s ease-in-out infinite 0.9s' }}
      />

      <div className="relative p-4">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            aria-hidden
            className="font-rd-display text-[12px] leading-none"
            style={{ color: 'hsl(40 100% 70%)', textShadow: '0 0 8px hsl(28 100% 50% / 0.7)' }}
          >
            ✦
          </span>
          <span
            className="font-rd-display px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-[0.24em]"
            style={{
              background: 'hsl(28 50% 18% / 0.7)',
              color: 'hsl(40 95% 72%)',
              border: '1px solid hsl(38 65% 40% / 0.5)',
            }}
          >
            CHAPTER {chapterNumber}
          </span>
          <span className="font-rd-display text-[10px] font-extrabold uppercase" style={{ color: 'hsl(38 75% 65% / 0.9)', letterSpacing: '0.22em' }}>
            {layout.category.toUpperCase()} · L{levelNumber}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <RuneLayoutPreview layout={layout} size="md" pulse />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="rd-title text-xl tracking-wide leading-tight" style={{ color: 'hsl(40 90% 88%)' }}>
              {layout.name}
            </h2>
            <p className="text-[11.5px] leading-snug italic mt-0.5" style={{ color: 'hsl(38 50% 75%)' }}>{layout.tagline}</p>
            <p className="text-[10.5px] text-foreground/65 leading-snug mt-1">
              <span className="font-rd-display font-extrabold" style={{ color: 'hsl(40 100% 70%)' }}>{chapterName}</span>
              {' · '}<span className="italic">{chapterSubtitle}</span>
            </p>
          </div>
        </div>

        {/* Progress bar — torchlit, not tactical */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="font-rd-display font-bold" style={{ color: 'hsl(38 60% 70%)', letterSpacing: '0.18em' }}>
              {heroFirst ? `${heroFirst.toUpperCase()}'S DESCENT` : 'CHAPTER PROGRESS'}
            </span>
            <span className="font-mono font-bold tabular-nums" style={{ color: 'hsl(40 90% 75%)' }}>{cleared}/{total}</span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden relative"
            style={{
              background: 'hsl(20 50% 8%)',
              border: '1px solid hsl(28 60% 25% / 0.5)',
              boxShadow: 'inset 0 1px 2px hsl(20 50% 4% / 0.8)',
            }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, hsl(20 95% 50%), hsl(40 100% 65%))',
                boxShadow: '0 0 12px hsl(28 100% 55% / 0.7)',
              }}
            />
          </div>
        </div>

        {/* CTA row */}
        <div className="mt-3.5 grid grid-cols-[1fr_auto] gap-2">
          <Link
            to={`/rune-delve/play/${levelNumber}`}
            className="rd-btn-juice rd-shimmer relative w-full h-12 rounded-xl font-rd-display font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition tracking-wide overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, hsl(28 95% 50%), hsl(15 90% 40%))',
              color: 'hsl(30 100% 96%)',
              boxShadow:
                '0 6px 18px -4px hsl(20 95% 35% / 0.55), ' +
                'inset 0 1px 0 hsl(45 100% 80% / 0.35), ' +
                'inset 0 -1px 0 hsl(15 85% 25% / 0.6)',
              textShadow: '0 1px 0 hsl(15 70% 25% / 0.6)',
            }}
          >
            <Swords className="w-4 h-4" /> Descend · Level {levelNumber} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/rune-delve/levels"
            className="h-12 px-3 rounded-xl flex items-center gap-1 text-[11px] font-bold active:scale-[0.98] transition"
            style={{
              background: 'hsl(28 40% 14% / 0.8)',
              border: '1px solid hsl(35 60% 35% / 0.5)',
              color: 'hsl(40 70% 80%)',
            }}
            aria-label="Open level map"
          >
            <Map className="w-3.5 h-3.5" /> Map
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
