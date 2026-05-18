// DH Club — Narrative RPG · Campaign-scoped presence
//
// Subscribes the current user to a per-campaign presence channel so the
// rest of the table can see who's online during a live session. Same
// pattern as `MembersOnline` (club-wide) but keyed by campaign id so a
// player who's in two campaigns shows up only in the one they're
// actively viewing.
//
// Returns:
//   • onlineIds — set of user ids currently online for this campaign
//   • onlineCount — convenience size
//
// Tracks the user's own display_name + character name so the active
// player list can render labels without an additional join.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PresencePayload {
  user_id: string;
  display_name?: string;
  character_id?: string | null;
  character_name?: string | null;
  joined_at?: string;
}

export interface OnlineNarrativeUser {
  userId: string;
  displayName?: string;
  characterId?: string | null;
  characterName?: string | null;
  joinedAt?: string;
}

interface Options {
  /** Display name for the local user (used for the broadcast payload). */
  myDisplayName?: string;
  /** Optional character name + id so other viewers can render the row
   *  with the player's character. */
  myCharacterId?: string | null;
  myCharacterName?: string | null;
}

export function useNarrativePresence(campaignId: string | undefined, opts: Options = {}) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineNarrativeUser[]>([]);

  useEffect(() => {
    if (!campaignId || !user?.id) return;
    const channel = supabase.channel(`narrative-presence:${campaignId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // Each user_id key maps to an array of payloads (one per connected
        // device). Dedupe by user_id, keep the freshest payload.
        const flat: OnlineNarrativeUser[] = [];
        const seen = new Set<string>();
        for (const [key, payloads] of Object.entries(state)) {
          const first = (payloads as unknown as PresencePayload[])[0];
          if (!first || seen.has(key)) continue;
          seen.add(key);
          flat.push({
            userId: first.user_id ?? key,
            displayName: first.display_name,
            characterId: first.character_id ?? null,
            characterName: first.character_name ?? null,
            joinedAt: first.joined_at,
          });
        }
        setOnlineUsers(flat);
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        const payload: PresencePayload = {
          user_id: user.id,
          display_name: opts.myDisplayName,
          character_id: opts.myCharacterId ?? null,
          character_name: opts.myCharacterName ?? null,
          joined_at: new Date().toISOString(),
        };
        await channel.track(payload);
      });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, user?.id, opts.myDisplayName, opts.myCharacterId, opts.myCharacterName]);

  const onlineIds = useMemo(() => new Set(onlineUsers.map(u => u.userId)), [onlineUsers]);
  return { onlineUsers, onlineIds, onlineCount: onlineUsers.length };
}
