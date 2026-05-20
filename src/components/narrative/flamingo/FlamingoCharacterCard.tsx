// DH Club — Narrative RPG · Flamingo Protocol casting/dossier card
//
// Flamingo variant of CharacterSheetCard. Reads like a casting credential
// / criminal dossier: neon portrait tile up front, gradient name treatment,
// archetype as a brassy badge, signature-move row, then the same five-stat
// grid using the calm-shell Chronicle stat accents (so the stat colors
// stay consistent with character creation + dice rolls).
//
// All character data is rendered the same as the calm card — we don't
// expose anything new. showPrivate gates the private-notes block.

import { Shield, Sparkles, Eye, Flame, Target, BadgeCheck, Lock } from 'lucide-react';
import { CHRONICLE_STATS, getStatMeta } from '@/lib/narrative/chronicleRuleset';
import { FLAMINGO } from '@/lib/narrative/flamingoTheme';
import type { Character } from '@/lib/narrative/types';

interface Props {
  character: Character;
  showPrivate?: boolean;
}

const ICON_BY_STAT = { grit: Shield, charm: Sparkles, cunning: Eye, chaos: Flame, focus: Target } as const;

export function FlamingoCharacterCard({ character, showPrivate }: Props) {
  const initial = character.name.charAt(0).toUpperCase();
  return (
    <div
      className="rounded-2xl p-3.5 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}) 70%)`,
        border: `1px solid hsl(${FLAMINGO.pink} / 0.4)`,
        boxShadow: `0 0 16px -6px hsl(${FLAMINGO.pink} / 0.45)`,
      }}
    >
      {/* Casting-card stripe down the left edge */}
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: `linear-gradient(180deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.cyan}))` }}
      />

      <div className="pl-2 flex items-start gap-3">
        {/* Neon portrait tile */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-[16px] font-extrabold flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.3), hsl(${FLAMINGO.violet} / 0.2))`,
            color: `hsl(${FLAMINGO.paper})`,
            border: `1px solid hsl(${FLAMINGO.pink} / 0.55)`,
            boxShadow: `0 0 12px -3px hsl(${FLAMINGO.pink} / 0.55)`,
          }}
        >
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3
              className="text-[15px] font-extrabold tracking-tight leading-tight line-clamp-2 break-words"
              style={{
                backgroundImage: `linear-gradient(90deg, hsl(${FLAMINGO.paper}), hsl(${FLAMINGO.pink}))`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}
            >
              {character.name}
            </h3>
            <BadgeCheck className="w-3 h-3" style={{ color: `hsl(${FLAMINGO.cyan})` }} />
          </div>

          {(character.pronouns || character.archetype) && (
            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
              {character.archetype && (
                <span
                  className="inline-block rounded-full px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-[0.2em]"
                  style={{
                    background: `hsl(${FLAMINGO.gold} / 0.18)`,
                    color: `hsl(${FLAMINGO.gold})`,
                    border: `1px solid hsl(${FLAMINGO.gold} / 0.5)`,
                  }}
                >
                  {character.archetype}
                </span>
              )}
              {character.pronouns && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: `hsl(${FLAMINGO.paper} / 0.55)` }}
                >
                  {character.pronouns}
                </span>
              )}
            </div>
          )}

          {character.signature_move && (
            <p className="text-[11px] mt-1.5" style={{ color: `hsl(${FLAMINGO.paper} / 0.88)` }}>
              <span
                className="font-extrabold uppercase text-[9px] tracking-wider mr-1.5"
                style={{ color: `hsl(${FLAMINGO.cyan})` }}
              >
                Signature
              </span>
              {character.signature_move}
            </p>
          )}
        </div>
      </div>

      {/* Stats grid — keep the Chronicle stat accents so dice + creation match */}
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {CHRONICLE_STATS.map(s => {
          const meta = getStatMeta(s.id)!;
          const Icon = ICON_BY_STAT[s.id];
          const v = character[`stat_${s.id}` as keyof Character] as number;
          return (
            <div
              key={s.id}
              className="rounded-lg p-1.5 text-center"
              style={{
                background: `hsl(${meta.accent} / 0.14)`,
                border: `1px solid hsl(${meta.accent} / 0.4)`,
                boxShadow: `inset 0 0 8px hsl(${meta.accent} / 0.15)`,
              }}
            >
              <Icon className="w-3 h-3 mx-auto" style={{ color: `hsl(${meta.accent})` }} />
              <p className="text-[8px] font-extrabold uppercase tracking-wider mt-0.5" style={{ color: `hsl(${meta.accent})` }}>
                {s.label.slice(0, 4)}
              </p>
              <p className="text-[15px] font-black tabular-nums leading-none" style={{ color: `hsl(${meta.accent})` }}>
                {v >= 0 ? `+${v}` : v}
              </p>
            </div>
          );
        })}
      </div>

      {/* Identity rows */}
      {(character.goal || character.flaw || character.personality) && (
        <div className="mt-3 space-y-1.5">
          {character.personality && (
            <DossierRow label="Personality" value={character.personality} accent={FLAMINGO.cyan} />
          )}
          {character.goal && (
            <DossierRow label="Goal" value={character.goal} accent={FLAMINGO.pink} />
          )}
          {character.flaw && (
            <DossierRow label="Flaw" value={character.flaw} accent={FLAMINGO.danger} />
          )}
        </div>
      )}

      {character.backstory && (
        <p
          className="mt-3 text-[11.5px] leading-snug whitespace-pre-wrap"
          style={{ color: `hsl(${FLAMINGO.paper} / 0.82)` }}
        >
          {character.backstory}
        </p>
      )}

      {showPrivate && character.notes_private && (
        <div
          className="mt-3 rounded-lg p-2.5"
          style={{
            background: `hsl(${FLAMINGO.gmAmber} / 0.06)`,
            border: `1px dashed hsl(${FLAMINGO.gmAmber} / 0.5)`,
          }}
        >
          <p
            className="text-[9px] font-bold uppercase tracking-wider inline-flex items-center gap-1"
            style={{ color: `hsl(${FLAMINGO.gmAmber})` }}
          >
            <Lock className="w-2.5 h-2.5" /> Private notes
          </p>
          <p
            className="text-[11.5px] leading-snug mt-0.5 whitespace-pre-wrap"
            style={{ color: `hsl(${FLAMINGO.paper} / 0.88)` }}
          >
            {character.notes_private}
          </p>
        </div>
      )}
    </div>
  );
}

function DossierRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <p className="text-[11.5px]" style={{ color: `hsl(${FLAMINGO.paper} / 0.85)` }}>
      <span
        className="font-extrabold uppercase text-[9px] tracking-wider mr-1.5"
        style={{ color: `hsl(${accent})` }}
      >
        {label}
      </span>
      {value}
    </p>
  );
}
