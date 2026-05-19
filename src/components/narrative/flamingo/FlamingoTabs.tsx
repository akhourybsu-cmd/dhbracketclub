// DH Club — Narrative RPG · Flamingo cinematic tab strip
//
// Drop-in replacement for the calm-shell tab grid used on the campaign
// detail page. Same four tabs (Story / Cast / City / Chronicle) with
// flavor labels and small subtitles so first-time players still
// understand what each section is. Active tab gets a pink-cyan inner
// glow + brighter text; idle tabs sit muted on the ink panel.

import { MessageSquareText, Users, Globe2, ListChecks } from 'lucide-react';
import { FLAMINGO, FLAMINGO_TAB_META, type FlamingoTabKey } from '@/lib/narrative/flamingoTheme';

const ICONS = {
  story: MessageSquareText,
  characters: Users,
  world: Globe2,
  log: ListChecks,
} as const;

interface Props {
  value: FlamingoTabKey;
  onChange: (next: FlamingoTabKey) => void;
}

export function FlamingoTabs({ value, onChange }: Props) {
  return (
    <div
      className="px-3 py-2 border-b flex-shrink-0"
      style={{
        background: `linear-gradient(180deg, hsl(${FLAMINGO.ink} / 0.4), hsl(${FLAMINGO.midnight} / 0.4))`,
        borderColor: `hsl(${FLAMINGO.pink} / 0.18)`,
      }}
    >
      <div
        className="grid grid-cols-4 gap-1 rounded-xl p-1"
        style={{
          background: `hsl(${FLAMINGO.midnight} / 0.65)`,
          border: `1px solid hsl(${FLAMINGO.pink} / 0.15)`,
        }}
      >
        {(Object.keys(FLAMINGO_TAB_META) as FlamingoTabKey[]).map(key => {
          const meta = FLAMINGO_TAB_META[key];
          const Icon = ICONS[key];
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className="rounded-lg py-1.5 transition active:scale-[0.97]"
              style={{
                background: selected
                  ? `linear-gradient(180deg, hsl(${FLAMINGO.pink} / 0.22), hsl(${FLAMINGO.violet} / 0.12))`
                  : 'transparent',
                border: selected
                  ? `1px solid hsl(${FLAMINGO.pink} / 0.5)`
                  : '1px solid transparent',
                color: selected ? `hsl(${FLAMINGO.paper})` : `hsl(${FLAMINGO.paper} / 0.55)`,
                boxShadow: selected ? `0 0 10px -2px hsl(${FLAMINGO.pink} / 0.55)` : 'none',
              }}
            >
              <div className="flex items-center justify-center gap-1">
                <Icon className="w-3 h-3" />
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.16em]">{meta.label}</span>
              </div>
              <p
                className="text-[8.5px] font-bold uppercase tracking-[0.14em] mt-0.5 leading-none truncate"
                style={{ color: selected ? `hsl(${FLAMINGO.cyan} / 0.85)` : `hsl(${FLAMINGO.paper} / 0.4)` }}
              >
                {meta.subtitle}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
