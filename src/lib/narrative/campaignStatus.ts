// DH Club — Narrative RPG · Computed campaign status
//
// The DB stores a coarse `status` (draft/pending/active/etc.) but the
// pill the user actually wants to see is finer-grained:
//   • Live Now              — campaign.live_started_at is set
//   • Waiting on GM         — last message is from a player + the
//                             player asked for a roll or replied to a
//                             scene the GM hasn't followed up on
//   • Waiting on Players    — last GM narration is newer than the most
//                             recent player message
//   • Active                — fallback for healthy active campaigns
//
// All inputs are PUBLIC data so this helper is safe to use from the
// home widget and any list view. It returns a derived label without
// touching DB state.

import type { Campaign, Message } from './types';

export type ComputedStatus =
  | 'live'
  | 'waiting_on_gm'
  | 'waiting_on_players'
  | 'active'
  | 'pending_approval'
  | 'needs_changes'
  | 'rejected'
  | 'paused'
  | 'completed'
  | 'archived'
  | 'draft';

export interface ComputeStatusInput {
  campaign: Campaign;
  /** Recent message rows (any order). Caller passes only what's visible
   *  to the viewer — never include gm_only messages in player context. */
  recentMessages?: Message[];
  /** Optional: viewer's user id, used only to bias the "waiting on me"
   *  hint (not exposed in this version — reserved for Phase 3). */
  viewerId?: string;
}

const GM_MESSAGE_TYPES = new Set(['gm_narration', 'npc_dialogue', 'scene_card', 'chapter_transition']);
const PLAYER_MESSAGE_TYPES = new Set(['player', 'character_action', 'dice_roll']);

/** How long without a GM message before we say "waiting on GM". */
const WAITING_ON_GM_THRESHOLD_HOURS = 12;

export function computeCampaignStatus({ campaign, recentMessages = [] }: ComputeStatusInput): ComputedStatus {
  // Terminal / non-active statuses pass through.
  if (campaign.status !== 'active' && campaign.status !== 'paused') {
    return campaign.status as ComputedStatus;
  }
  // Paused outranks live activity.
  if (campaign.status === 'paused') return 'paused';

  // Live takes priority.
  if (campaign.live_session_id && campaign.live_started_at) return 'live';

  // Walk recent messages newest-first to find the latest player + GM activity.
  const sorted = recentMessages.slice().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  let lastPlayer: Message | null = null;
  let lastGm: Message | null = null;
  for (const m of sorted) {
    if (!lastPlayer && PLAYER_MESSAGE_TYPES.has(m.message_type)) lastPlayer = m;
    if (!lastGm && GM_MESSAGE_TYPES.has(m.message_type)) lastGm = m;
    if (lastPlayer && lastGm) break;
  }

  // No messages yet — call it active.
  if (!lastPlayer && !lastGm) return 'active';

  // GM hasn't spoken yet but player has: waiting on GM.
  if (lastPlayer && !lastGm) return 'waiting_on_gm';
  // GM has spoken, no player reply: waiting on players.
  if (!lastPlayer && lastGm) return 'waiting_on_players';

  // Both exist — compare timestamps.
  const playerAt = new Date(lastPlayer!.created_at).getTime();
  const gmAt = new Date(lastGm!.created_at).getTime();
  if (playerAt > gmAt) {
    // Last activity was a player. If it's been over the threshold, the GM
    // is the bottleneck.
    const hoursSince = (Date.now() - playerAt) / (1000 * 60 * 60);
    if (hoursSince >= WAITING_ON_GM_THRESHOLD_HOURS) return 'waiting_on_gm';
    return 'active';
  } else {
    return 'waiting_on_players';
  }
}

/** Map a computed status to its human label. Used by the status pill. */
export const STATUS_LABEL: Record<ComputedStatus, string> = {
  live:               'Live Now',
  waiting_on_gm:      'Waiting on GM',
  waiting_on_players: 'Waiting on Players',
  active:             'Active',
  pending_approval:   'Pending Approval',
  needs_changes:      'Needs Changes',
  rejected:           'Rejected',
  paused:             'Paused',
  completed:          'Completed',
  archived:           'Archived',
  draft:              'Draft',
};
