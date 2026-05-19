// DH Club — Narrative RPG · Flamingo pinned scene card
//
// Cinematic version of the pinned scene strip that sits above the Story
// Chat stream when a Flamingo Protocol campaign has an active scene.
// Reads like a screenplay slug: tiny dossier label up top, scene title
// big and bright, optional objective + location in a thin sub-row.

import { Clapperboard } from 'lucide-react';
import { FLAMINGO } from '@/lib/narrative/flamingoTheme';
import type { Scene } from '@/lib/narrative/types';

interface Props {
  scene: Scene;
}

export function FlamingoSceneCard({ scene }: Props) {
  return (
    <div
      className="rounded-xl p-2.5 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.smoke} / 0.6))`,
        border: `1px solid hsl(${FLAMINGO.pink} / 0.4)`,
        boxShadow: `0 0 16px -6px hsl(${FLAMINGO.pink} / 0.45), inset 0 1px 0 hsl(${FLAMINGO.pink} / 0.2)`,
      }}
    >
      {/* faint left-edge cyan rule = clapperboard stripe */}
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: `linear-gradient(180deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.cyan}))` }}
      />
      <div className="pl-1.5">
        <div className="flex items-center gap-1.5">
          <Clapperboard className="w-3 h-3" style={{ color: `hsl(${FLAMINGO.cyan})` }} />
          <p
            className="text-[9px] font-extrabold uppercase tracking-[0.24em]"
            style={{ color: `hsl(${FLAMINGO.cyan})` }}
          >
            Scene · Now Filming
          </p>
        </div>
        <h3
          className="font-display text-[15px] font-extrabold tracking-tight mt-0.5"
          style={{ color: `hsl(${FLAMINGO.paper})` }}
        >
          {scene.title}
        </h3>
        {(scene.objective || scene.location) && (
          <div className="mt-1 flex items-center gap-2 text-[10.5px] flex-wrap">
            {scene.objective && (
              <span style={{ color: `hsl(${FLAMINGO.paper} / 0.85)` }}>
                <span
                  className="font-extrabold uppercase tracking-wider mr-1.5 text-[9px]"
                  style={{ color: `hsl(${FLAMINGO.gold})` }}
                >
                  Objective
                </span>
                {scene.objective}
              </span>
            )}
            {scene.location && (
              <span style={{ color: `hsl(${FLAMINGO.paper} / 0.7)` }}>
                <span
                  className="font-extrabold uppercase tracking-wider mr-1.5 text-[9px]"
                  style={{ color: `hsl(${FLAMINGO.gold})` }}
                >
                  Where
                </span>
                {scene.location}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
