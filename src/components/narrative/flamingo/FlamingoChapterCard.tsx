// DH Club — Narrative RPG · Flamingo cinematic chapter transition card
//
// Replaces the generic "Chapter Advanced" system strip for chapter_transition
// messages inside Flamingo Protocol campaigns. Reads like an episode title
// card: small "Previously on…" eyebrow, big gradient chapter title, optional
// chapter summary as italic body copy, pink/cyan neon top + bottom rules.
//
// The transition message body holds the chapter title; the
// `metadata.summary` (optional) gives a one-liner recap.

import { Bookmark, Film } from 'lucide-react';
import { FLAMINGO } from '@/lib/narrative/flamingoTheme';
import type { Message } from '@/lib/narrative/types';

interface Props {
  message: Message;
}

export function FlamingoChapterCard({ message }: Props) {
  const meta = message.metadata as any;
  const summary: string | null = meta?.summary ?? meta?.recap ?? null;
  const chapterNumber: number | null = typeof meta?.chapter_number === 'number'
    ? meta.chapter_number
    : null;

  return (
    <div
      className="rounded-2xl relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, hsl(${FLAMINGO.midnight}), hsl(${FLAMINGO.ink}) 55%, hsl(${FLAMINGO.violet} / 0.18))`,
        border: `1px solid hsl(${FLAMINGO.pink} / 0.5)`,
        boxShadow: `0 0 22px -4px hsl(${FLAMINGO.pink} / 0.55), 0 0 22px -10px hsl(${FLAMINGO.cyan} / 0.45)`,
      }}
    >
      {/* Top + bottom neon rules so the card reads as a stage card */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.cyan}), transparent)` }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, hsl(${FLAMINGO.cyan}), hsl(${FLAMINGO.pink}), transparent)` }}
      />

      <div className="px-4 py-4 text-center">
        <p
          className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.28em]"
          style={{ color: `hsl(${FLAMINGO.cyan})` }}
        >
          <Film className="w-2.5 h-2.5" /> Previously on… The Flamingo Protocol
        </p>
        {chapterNumber !== null && (
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.32em] mt-1.5"
            style={{ color: `hsl(${FLAMINGO.gold})` }}
          >
            Chapter {chapterNumber}
          </p>
        )}
        <h3
          className="text-[18px] font-extrabold tracking-tight mt-1 leading-tight"
          style={{
            backgroundImage: `linear-gradient(90deg, hsl(${FLAMINGO.paper}), hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.cyan}))`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}
        >
          {message.body}
        </h3>
        {summary && (
          <p
            className="text-[12px] italic leading-snug mt-2 max-w-[42ch] mx-auto"
            style={{ color: `hsl(${FLAMINGO.paper} / 0.78)` }}
          >
            {summary}
          </p>
        )}
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <span
            aria-hidden
            className="w-1 h-1 rounded-full"
            style={{ background: `hsl(${FLAMINGO.pink})`, boxShadow: `0 0 4px hsl(${FLAMINGO.pink})` }}
          />
          <Bookmark className="w-3 h-3" style={{ color: `hsl(${FLAMINGO.pink})` }} />
          <span
            aria-hidden
            className="w-1 h-1 rounded-full"
            style={{ background: `hsl(${FLAMINGO.cyan})`, boxShadow: `0 0 4px hsl(${FLAMINGO.cyan})` }}
          />
        </div>
      </div>
    </div>
  );
}
