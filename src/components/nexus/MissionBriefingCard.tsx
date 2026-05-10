// Nexus Defense — Mission Briefing Card
//
// Used on the Loadout page (and reusable elsewhere) to give every mission
// a real briefing screen feel: layout preview, callsign, briefing copy,
// objective, enemy theme, and difficulty stars.

import { motion } from 'framer-motion';
import { Target, Skull, Crosshair, Award, Sparkles } from 'lucide-react';
import { MapLayoutPreview } from './MapLayoutPreview';
import { getLayout } from '@/lib/nexus/mapLayouts';
import type { MissionBriefing } from '@/lib/nexus/missionBriefings';

interface Props {
  briefing: MissionBriefing;
  /** Show callsign + mission number badge above title. */
  missionNumber?: number;
  /** Override the title (e.g. show the canonical mission name instead). */
  title?: string;
  /** Hide the rewards strip (e.g. when shown alongside a results-screen reward panel). */
  hideRewards?: boolean;
}

export function MissionBriefingCard({ briefing, missionNumber, title, hideRewards }: Props) {
  const layout = getLayout(briefing.layoutId);
  const accent = layout?.preview.accent ?? 'hsl(var(--nx-cyan))';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden nx-clip nx-bracket"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 100% 0%, ' +
          accent.replace(')', ' / 0.18)') +
          ', transparent 60%),' +
          'linear-gradient(160deg, hsl(218 50% 9%), hsl(220 55% 5%))',
        border: `1px solid ${accent.replace(')', ' / 0.45)')}`,
        boxShadow:
          `0 0 18px -8px ${accent.replace(')', ' / 0.5)')}, inset 0 1px 0 ` +
          accent.replace(')', ' / 0.14)'),
      }}
    >
      {/* Decorative grid mask on the right side */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.10]"
        style={{
          backgroundImage:
            `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 60% 70% at 100% 50%, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 70% at 100% 50%, black, transparent 80%)',
        }}
      />

      <div className="relative p-3.5 flex gap-3">
        {/* Layout preview */}
        {layout && (
          <div className="flex-shrink-0">
            <MapLayoutPreview layout={layout} size="md" />
            <div
              className="nx-title text-[8px] mt-1.5 text-center truncate"
              style={{ color: accent.replace(')', ' / 0.85)'), letterSpacing: '0.2em', maxWidth: '96px' }}
              title={layout.name}
            >
              {layout.name.toUpperCase()}
            </div>
          </div>
        )}

        {/* Briefing body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="nx-pulse-dot inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
            />
            <p className="nx-title text-[9px]" style={{ color: accent, letterSpacing: '0.22em' }}>
              {missionNumber !== undefined ? `MISSION ${String(missionNumber).padStart(2, '0')} · ` : ''}
              {briefing.codename ?? 'BRIEFING'}
            </p>
          </div>
          <h2 className="text-[15px] font-black tracking-tight leading-tight mb-1.5">
            {title ?? briefing.tagline}
          </h2>
          <p className="text-[11px] text-foreground/80 leading-relaxed">{briefing.briefing}</p>

          {/* Objective + enemy theme tactical readouts */}
          <div className="mt-2.5 space-y-1.5">
            <ReadoutLine icon={<Target className="w-3 h-3" />} label="OBJECTIVE" body={briefing.objective} accent={accent} />
            <ReadoutLine icon={<Skull className="w-3 h-3" />} label="THREAT" body={briefing.enemyTheme} accent={accent} />
            <DifficultyDots tier={briefing.difficulty} accent={accent} />
          </div>
        </div>
      </div>

      {/* Rewards strip — display-layer only; persistence is the engine's job */}
      {!hideRewards && briefing.rewards && (briefing.rewards.cores > 0 || briefing.rewards.note || briefing.rewards.sigilDrop) && (
        <div
          className="relative px-3.5 py-2 flex items-center gap-2 border-t"
          style={{
            background: 'hsl(218 50% 5% / 0.5)',
            borderColor: accent.replace(')', ' / 0.25)'),
          }}
        >
          <Award className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--nx-amber))' }} />
          <p className="nx-title text-[8px]" style={{ color: 'hsl(var(--nx-amber) / 0.85)', letterSpacing: '0.22em' }}>
            REWARDS
          </p>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            {briefing.rewards.cores > 0 && (
              <span
                className="nx-title text-[9px] tabular-nums px-1.5 py-0.5"
                style={{
                  color: 'hsl(var(--nx-amber))',
                  background: 'hsl(var(--nx-amber) / 0.14)',
                  border: '1px solid hsl(var(--nx-amber) / 0.3)',
                  letterSpacing: '0.18em',
                }}
              >
                ⚡ {briefing.rewards.cores}
              </span>
            )}
            {briefing.rewards.sigilDrop && (
              <span
                className="nx-title text-[9px] flex items-center gap-1 px-1.5 py-0.5"
                style={{
                  color: 'hsl(265 85% 78%)',
                  background: 'hsl(265 80% 60% / 0.14)',
                  border: '1px solid hsl(265 80% 60% / 0.35)',
                  letterSpacing: '0.18em',
                }}
              >
                <Sparkles className="w-2.5 h-2.5" /> SIGIL
              </span>
            )}
            {briefing.rewards.note && (
              <span className="text-[10px] text-foreground/70 truncate max-w-[180px]" title={briefing.rewards.note}>
                {briefing.rewards.note}
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ReadoutLine({
  icon,
  label,
  body,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex-shrink-0" style={{ color: accent }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="nx-title text-[8px]" style={{ color: accent.replace(')', ' / 0.8)'), letterSpacing: '0.22em' }}>
          {label}
        </p>
        <p className="text-[10.5px] text-foreground/85 leading-tight mt-0.5">{body}</p>
      </div>
    </div>
  );
}

function DifficultyDots({ tier, accent }: { tier: number; accent: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Crosshair className="w-3 h-3 flex-shrink-0" style={{ color: accent }} />
      <p className="nx-title text-[8px]" style={{ color: accent.replace(')', ' / 0.8)'), letterSpacing: '0.22em' }}>
        DIFFICULTY
      </p>
      <div className="flex items-center gap-0.5 ml-auto" aria-label={`Difficulty ${tier} of 5`}>
        {[1, 2, 3, 4, 5].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-sm"
            style={{
              background: i <= tier ? accent : 'hsl(0 0% 100% / 0.12)',
              boxShadow: i <= tier ? `0 0 4px ${accent.replace(')', ' / 0.6)')}` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
