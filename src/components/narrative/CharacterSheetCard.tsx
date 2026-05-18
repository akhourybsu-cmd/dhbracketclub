// DH Club — Narrative RPG · Character sheet card
//
// Compact mobile-friendly read view of a character. Used on the
// Characters tab + inside the GM Console.

import { Shield, Sparkles, Eye, Flame, Target } from 'lucide-react';
import { CHRONICLE_STATS, getStatMeta } from '@/lib/narrative/chronicleRuleset';
import type { Character } from '@/lib/narrative/types';

interface Props {
  character: Character;
  /** When true, includes private notes (only render this for owner + GM). */
  showPrivate?: boolean;
}

const ICON_BY_STAT = { grit: Shield, charm: Sparkles, cunning: Eye, chaos: Flame, focus: Target } as const;

export function CharacterSheetCard({ character, showPrivate }: Props) {
  return (
    <div className="rounded-2xl bg-card border border-border/40 p-3.5">
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-[16px] font-extrabold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.04))', color: 'hsl(var(--primary))' }}
        >
          {character.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-extrabold tracking-tight truncate">{character.name}</h3>
          {(character.pronouns || character.archetype) && (
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/65 mt-0.5 truncate">
              {[character.pronouns, character.archetype].filter(Boolean).join(' · ')}
            </p>
          )}
          {character.signature_move && (
            <p className="text-[11px] text-foreground/85 mt-1.5">
              <span className="text-muted-foreground/65 font-bold uppercase text-[9px] tracking-wider mr-1.5">Signature</span>
              {character.signature_move}
            </p>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {CHRONICLE_STATS.map(s => {
          const meta = getStatMeta(s.id)!;
          const Icon = ICON_BY_STAT[s.id];
          const v = character[`stat_${s.id}` as keyof Character] as number;
          return (
            <div
              key={s.id}
              className="rounded-lg p-1.5 text-center"
              style={{ background: `hsl(${meta.accent} / 0.12)`, border: `1px solid hsl(${meta.accent} / 0.32)` }}
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

      {/* Identity */}
      {(character.goal || character.flaw || character.personality) && (
        <div className="mt-3 space-y-1.5">
          {character.personality && (
            <p className="text-[11.5px] text-foreground/85">
              <span className="text-muted-foreground/65 font-bold uppercase text-[9px] tracking-wider mr-1.5">Personality</span>
              {character.personality}
            </p>
          )}
          {character.goal && (
            <p className="text-[11.5px] text-foreground/85">
              <span className="text-muted-foreground/65 font-bold uppercase text-[9px] tracking-wider mr-1.5">Goal</span>
              {character.goal}
            </p>
          )}
          {character.flaw && (
            <p className="text-[11.5px] text-foreground/85">
              <span className="text-muted-foreground/65 font-bold uppercase text-[9px] tracking-wider mr-1.5">Flaw</span>
              {character.flaw}
            </p>
          )}
        </div>
      )}

      {character.backstory && (
        <p className="mt-3 text-[11.5px] text-foreground/80 leading-snug whitespace-pre-wrap">{character.backstory}</p>
      )}

      {showPrivate && character.notes_private && (
        <div className="mt-3 rounded-lg bg-muted/25 border border-dashed border-border/50 p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">Private notes</p>
          <p className="text-[11.5px] text-foreground/85 leading-snug mt-0.5 whitespace-pre-wrap">{character.notes_private}</p>
        </div>
      )}
    </div>
  );
}
