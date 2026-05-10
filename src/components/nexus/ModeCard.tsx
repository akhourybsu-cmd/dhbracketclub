// Nexus Defense — Mode Card
//
// Reusable banner for the three primary game modes (Solo Campaign, Endless,
// Co-op). Each card has its own theme color, a status pill, status copy,
// and a deploy CTA. Replaces the older square nav tiles on the hub.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ModeCardProps {
  to: string;
  title: string;
  /** Short tactical descriptor under the title. */
  subtitle: string;
  /** Top-line status (e.g. "PHASE 2 · 3 ALLIES" / "BEST WAVE 18"). Optional. */
  status?: string;
  /** Whether the status is "live" (pulses) — e.g. an active op. */
  liveStatus?: boolean;
  /** Icon node — pass a lucide icon at size 5. */
  icon: ReactNode;
  /** Button copy. Defaults to "DEPLOY". */
  cta?: string;
  /** Theme accent (HSL string, e.g. 'hsl(280 80% 65%)'). */
  accent: string;
  /** Body tags shown as small chips. */
  tags?: string[];
  /** Tone variant: solid (filled CTA) or ghost (outline). */
  tone?: 'solid' | 'ghost';
}

export function ModeCard({
  to,
  title,
  subtitle,
  status,
  liveStatus,
  icon,
  cta = 'DEPLOY',
  accent,
  tags,
  tone = 'solid',
}: ModeCardProps) {
  const isSolid = tone === 'solid';
  const accentSoft = accent.replace(')', ' / 0.18)');
  const accentBorder = accent.replace(')', ' / 0.4)');
  const accentGlow = accent.replace(')', ' / 0.45)');

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Link
        to={to}
        className="relative block nx-clip-sm overflow-hidden active:scale-[0.99] transition"
        style={{
          background: isSolid
            ? `radial-gradient(ellipse 60% 80% at 100% 0%, ${accentSoft}, transparent 60%), linear-gradient(180deg, hsl(218 38% 11%), hsl(218 42% 7%))`
            : 'linear-gradient(180deg, hsl(218 35% 9%), hsl(218 38% 6%))',
          border: `1px solid ${accentBorder}`,
          boxShadow: isSolid ? `0 0 14px -6px ${accentGlow}` : undefined,
        }}
      >
        {/* corner brackets */}
        <span
          aria-hidden
          className="absolute top-1.5 left-1.5 w-3 h-3"
          style={{ borderTop: `1.5px solid ${accent}`, borderLeft: `1.5px solid ${accent}` }}
        />
        <span
          aria-hidden
          className="absolute bottom-1.5 right-1.5 w-3 h-3"
          style={{ borderBottom: `1.5px solid ${accent}`, borderRight: `1.5px solid ${accent}` }}
        />

        <div className="relative p-3 flex items-center gap-3">
          <div
            className="w-12 h-12 nx-clip-sm flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${accentSoft}, ${accent.replace(')', ' / 0.04)')})`,
              border: `1.5px solid ${accent}`,
              color: accent,
              boxShadow: `0 0 10px ${accent.replace(')', ' / 0.35)')}`,
            }}
          >
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            {status && (
              <div className="flex items-center gap-1.5 mb-0.5">
                {liveStatus && (
                  <span
                    className="nx-pulse-dot inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
                  />
                )}
                <p
                  className="nx-title text-[9px] truncate"
                  style={{ color: accent, letterSpacing: '0.22em' }}
                >
                  {status}
                </p>
              </div>
            )}
            <h3 className="text-[14px] font-black tracking-tight leading-tight truncate">{title}</h3>
            <p className="text-[10.5px] text-foreground/65 leading-snug mt-0.5 line-clamp-2">{subtitle}</p>
            {tags && tags.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="nx-title text-[8px] px-1.5 py-0.5"
                    style={{
                      color: accent,
                      background: accentSoft,
                      border: `1px solid ${accentBorder}`,
                      letterSpacing: '0.18em',
                    }}
                  >
                    {tag.toUpperCase()}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div
            className="flex-shrink-0 flex items-center gap-1 nx-title text-[10px] px-2 py-1.5"
            style={{
              color: isSolid ? 'hsl(218 50% 8%)' : accent,
              background: isSolid
                ? `linear-gradient(180deg, ${accent}, ${accent.replace(')', ' / 0.85)')})`
                : accentSoft,
              border: isSolid ? 'none' : `1px solid ${accentBorder}`,
              letterSpacing: '0.18em',
              boxShadow: isSolid ? `0 0 12px ${accentGlow}` : undefined,
            }}
          >
            {cta} <ChevronRight className="w-3 h-3" strokeWidth={3} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
