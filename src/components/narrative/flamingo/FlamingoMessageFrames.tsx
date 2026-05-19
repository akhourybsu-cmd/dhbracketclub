// DH Club — Narrative RPG · Flamingo Protocol message frames
//
// Drop-in renderer for SceneMessage when the active campaign is the
// Flamingo Protocol. Mirrors the same message-type dispatch as the
// calm-shell SceneMessage but renders each variant with the neon
// Miami-Vice / dossier visual language:
//
//   • GM narration → wide pink-edged "SCENE NARRATION" card
//   • NPC dialogue → screenplay/dossier card with NPC badge
//   • scene_card    → cinematic chapter slug
//   • dice_roll     → handled by FlamingoDiceRoll
//   • clue/inv/etc  → compact dossier strips
//   • gm_private    → amber-locked private note (GM only)
//   • ai_suggestion → cyan "WRITER'S ROOM DRAFT" chip (GM only)
//   • player/action → neon chat bubbles, own/other-aligned

import { format } from 'date-fns';
import {
  Megaphone, KeyRound, Backpack, Users as UsersIcon,
  Clock as ClockIcon, AlertOctagon, Bookmark, Sparkles, Lock, Clapperboard, Film,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FLAMINGO } from '@/lib/narrative/flamingoTheme';
import { FlamingoDiceRoll } from './FlamingoDiceRoll';
import { FlamingoChapterCard } from './FlamingoChapterCard';
import type { Message, Character } from '@/lib/narrative/types';

interface Props {
  message: Message;
  characters: Map<string, Character>;
  senderNames?: Map<string, string>;
  npcNames?: Map<string, string>;
  isOwn: boolean;
  isGm: boolean;
}

export function FlamingoSceneMessage({ message, characters, senderNames, npcNames, isOwn, isGm }: Props) {
  const t = message.message_type;

  if (t === 'dice_roll') {
    const rollerName = message.character_id
      ? characters.get(message.character_id)?.name
      : (message.sender_id ? senderNames?.get(message.sender_id) : undefined);
    return (
      <FlamingoDiceRoll
        message={message}
        rollerName={rollerName}
        isGm={isGm}
        campaignId={message.campaign_id}
      />
    );
  }

  if (t === 'scene_card') {
    const meta = message.metadata as any;
    return (
      <div
        className="rounded-2xl p-3.5 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
          border: `1px solid hsl(${FLAMINGO.cyan} / 0.45)`,
          boxShadow: `0 0 18px -6px hsl(${FLAMINGO.cyan} / 0.45)`,
        }}
      >
        <div
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: `linear-gradient(180deg, hsl(${FLAMINGO.cyan}), hsl(${FLAMINGO.pink}))` }}
        />
        <div className="pl-2">
          <div className="flex items-center gap-1.5">
            <Clapperboard className="w-3 h-3" style={{ color: `hsl(${FLAMINGO.cyan})` }} />
            <p className="text-[9px] font-extrabold uppercase tracking-[0.24em]" style={{ color: `hsl(${FLAMINGO.cyan})` }}>
              New Scene · Roll Sound
            </p>
          </div>
          <h3 className="text-[15px] font-extrabold tracking-tight mt-0.5" style={{ color: `hsl(${FLAMINGO.paper})` }}>
            {message.body}
          </h3>
          {(meta?.location || meta?.objective || meta?.stakes) && (
            <div className="mt-2 space-y-1 text-[11px]">
              {meta?.location && (
                <p style={{ color: `hsl(${FLAMINGO.paper} / 0.8)` }}>
                  <span className="mr-1.5 text-[9px] font-extrabold uppercase tracking-wider" style={{ color: `hsl(${FLAMINGO.gold})` }}>Location</span>
                  {meta.location}
                </p>
              )}
              {meta?.objective && (
                <p style={{ color: `hsl(${FLAMINGO.paper} / 0.8)` }}>
                  <span className="mr-1.5 text-[9px] font-extrabold uppercase tracking-wider" style={{ color: `hsl(${FLAMINGO.gold})` }}>Objective</span>
                  {meta.objective}
                </p>
              )}
              {meta?.stakes && (
                <p style={{ color: `hsl(${FLAMINGO.paper} / 0.8)` }}>
                  <span className="mr-1.5 text-[9px] font-extrabold uppercase tracking-wider" style={{ color: `hsl(${FLAMINGO.danger})` }}>Stakes</span>
                  {meta.stakes}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chapter transitions get a dedicated cinematic title card instead of
  // the compact system strip.
  if (t === 'chapter_transition') {
    return <FlamingoChapterCard message={message} />;
  }

  if (t === 'clue_discovered' || t === 'inventory_update' || t === 'faction_update' || t === 'clock_update' || t === 'system' || t === 'campaign_summary') {
    const sysMeta: Record<string, { label: string; icon: typeof Megaphone; accent: string }> = {
      clue_discovered:    { label: 'Clue Logged',        icon: KeyRound,     accent: FLAMINGO.clue },
      inventory_update:   { label: 'Leverage Updated',   icon: Backpack,     accent: FLAMINGO.gold },
      faction_update:     { label: 'Heat Shift',         icon: UsersIcon,    accent: FLAMINGO.violet },
      clock_update:       { label: 'Clock Advanced',     icon: ClockIcon,    accent: FLAMINGO.danger },
      chapter_transition: { label: 'New Chapter',        icon: Bookmark,     accent: FLAMINGO.cyan },
      system:             { label: 'System',             icon: AlertOctagon, accent: FLAMINGO.paper },
      campaign_summary:   { label: 'Episode Recap',      icon: Film,         accent: FLAMINGO.pink },
    };
    const meta = sysMeta[t];
    const Icon = meta.icon;
    return (
      <div
        className="rounded-xl px-3 py-2.5 flex items-start gap-2"
        style={{
          background: `hsl(${FLAMINGO.ink} / 0.7)`,
          border: `1px solid hsl(${meta.accent} / 0.42)`,
        }}
      >
        <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: `hsl(${meta.accent})` }} />
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: `hsl(${meta.accent})` }}>
            {meta.label}
          </p>
          <p className="text-[12.5px] leading-snug mt-0.5" style={{ color: `hsl(${FLAMINGO.paper} / 0.92)` }}>
            {message.body}
          </p>
        </div>
      </div>
    );
  }

  if (t === 'gm_narration') {
    return (
      <div
        className="rounded-2xl p-3.5 relative overflow-hidden"
        style={{
          background: `linear-gradient(180deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
          border: `1px solid hsl(${FLAMINGO.pink} / 0.45)`,
          boxShadow: `0 0 16px -6px hsl(${FLAMINGO.pink} / 0.5)`,
        }}
      >
        <div
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: `linear-gradient(180deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.violet}))` }}
        />
        <p
          className="text-[9.5px] font-extrabold uppercase tracking-[0.24em]"
          style={{ color: `hsl(${FLAMINGO.pink})` }}
        >
          <Megaphone className="w-2.5 h-2.5 inline-block mr-1" /> Scene Narration
        </p>
        <p
          className="text-[13.5px] leading-relaxed mt-1 whitespace-pre-wrap"
          style={{ color: `hsl(${FLAMINGO.paper})` }}
        >
          {message.body}
        </p>
      </div>
    );
  }

  if (t === 'npc_dialogue') {
    const npcName = (message.metadata as any)?.npc_name || (message.npc_id && npcNames?.get(message.npc_id)) || 'NPC';
    return (
      <div
        className="rounded-2xl p-3"
        style={{
          background: `hsl(${FLAMINGO.ink} / 0.85)`,
          border: `1px solid hsl(${FLAMINGO.gold} / 0.4)`,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-full px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-[0.18em]"
            style={{
              background: `hsl(${FLAMINGO.gold} / 0.18)`,
              color: `hsl(${FLAMINGO.gold})`,
              border: `1px solid hsl(${FLAMINGO.gold} / 0.5)`,
            }}
          >
            {npcName}
          </span>
        </div>
        <p
          className="text-[13.5px] italic leading-snug mt-1 whitespace-pre-wrap"
          style={{ color: `hsl(${FLAMINGO.paper} / 0.92)` }}
        >
          "{message.body}"
        </p>
      </div>
    );
  }

  if (t === 'gm_private') {
    if (!isGm) return null;
    return (
      <div
        className="rounded-xl p-2.5"
        style={{
          background: `hsl(${FLAMINGO.gmAmber} / 0.06)`,
          border: `1px dashed hsl(${FLAMINGO.gmAmber} / 0.55)`,
        }}
      >
        <p className="text-[9px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1" style={{ color: `hsl(${FLAMINGO.gmAmber})` }}>
          <Lock className="w-2.5 h-2.5" /> GM Note · private
        </p>
        <p className="text-[12px] leading-snug mt-0.5 whitespace-pre-wrap" style={{ color: `hsl(${FLAMINGO.paper} / 0.92)` }}>
          {message.body}
        </p>
      </div>
    );
  }

  if (t === 'ai_suggestion') {
    if (!isGm) return null;
    return (
      <div
        className="rounded-xl p-2.5"
        style={{
          background: `hsl(${FLAMINGO.cyan} / 0.08)`,
          border: `1px solid hsl(${FLAMINGO.cyan} / 0.45)`,
        }}
      >
        <p className="text-[9px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1" style={{ color: `hsl(${FLAMINGO.cyan})` }}>
          <Sparkles className="w-2.5 h-2.5" /> Writer's Room · awaiting approval
        </p>
        <p className="text-[12px] leading-snug mt-0.5 whitespace-pre-wrap" style={{ color: `hsl(${FLAMINGO.paper} / 0.92)` }}>
          {message.body}
        </p>
      </div>
    );
  }

  // Default: player / character_action / ooc bubbles.
  const character = message.character_id ? characters.get(message.character_id) : undefined;
  const senderName = character?.name
    ?? (message.sender_id ? senderNames?.get(message.sender_id) : undefined)
    ?? 'Someone';
  const initial = senderName.charAt(0).toUpperCase();
  const isOoc = t === 'ooc';
  const isAction = t === 'character_action';

  return (
    <div className={cn('flex items-end gap-2', isOwn ? 'justify-end' : 'justify-start')}>
      {!isOwn && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.3), hsl(${FLAMINGO.violet} / 0.2))`,
            color: `hsl(${FLAMINGO.paper})`,
            border: `1px solid hsl(${FLAMINGO.pink} / 0.5)`,
          }}
        >
          {initial}
        </div>
      )}
      <div className="max-w-[80%] min-w-[60px]">
        {!isOwn && (
          <p className="text-[11px] font-bold mb-0.5 pl-1" style={{ color: `hsl(${FLAMINGO.paper} / 0.85)` }}>
            {senderName}
            {isOoc && (
              <span
                className="ml-1.5 text-[9px] font-bold uppercase tracking-wider"
                style={{ color: `hsl(${FLAMINGO.paper} / 0.5)` }}
              >
                OOC
              </span>
            )}
          </p>
        )}
        <div
          className={cn(
            'rounded-2xl px-3 py-2',
            isOwn ? 'rounded-br-md' : 'rounded-bl-md',
            isAction && 'italic',
          )}
          style={
            isOwn
              ? {
                  background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.28), hsl(${FLAMINGO.violet} / 0.18))`,
                  border: `1px solid hsl(${FLAMINGO.pink} / 0.4)`,
                  color: `hsl(${FLAMINGO.paper})`,
                  boxShadow: `0 0 10px -4px hsl(${FLAMINGO.pink} / 0.4)`,
                }
              : isOoc
                ? {
                    background: `hsl(${FLAMINGO.smoke} / 0.5)`,
                    border: `1px dashed hsl(${FLAMINGO.paper} / 0.25)`,
                    color: `hsl(${FLAMINGO.paper} / 0.85)`,
                  }
                : {
                    background: `hsl(${FLAMINGO.ink})`,
                    border: `1px solid hsl(${FLAMINGO.cyan} / 0.28)`,
                    color: `hsl(${FLAMINGO.paper})`,
                  }
          }
        >
          {isAction && (
            <p
              className="text-[9px] font-extrabold uppercase tracking-wider mb-1"
              style={{ color: `hsl(${FLAMINGO.cyan})` }}
            >
              Action
            </p>
          )}
          <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">
            {message.body}
          </p>
          <p
            className="text-[9px] text-right mt-1 tabular-nums"
            style={{ color: `hsl(${FLAMINGO.paper} / 0.45)` }}
          >
            {format(new Date(message.created_at), 'h:mm a')}
          </p>
        </div>
      </div>
    </div>
  );
}
