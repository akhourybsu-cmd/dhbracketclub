// DH Club — Narrative RPG · Shared TypeScript types
//
// Mirror of the DB schema in the migration. Kept hand-written for Phase 1
// so the UI can be strongly typed before Supabase regenerates its types.
// Replace the `(supabase as any).from('...')` usages in the hooks with
// real generated types once available.

import type { ChronicleStat } from './chronicleRuleset';

export type CampaignStatus =
  | 'draft'
  | 'pending_approval'
  | 'needs_changes'
  | 'rejected'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

export type CampaignVisibility = 'invite_only' | 'club_visible' | 'club_public';
export type CampaignPlayMode = 'async' | 'live' | 'both';

export type MemberRole = 'game_master' | 'player' | 'spectator';
export type MemberStatus = 'invited' | 'active' | 'removed' | 'pending';

export type MessageVisibility = 'public' | 'gm_only' | 'private';
export type MessageType =
  | 'player'
  | 'character_action'
  | 'gm_narration'
  | 'npc_dialogue'
  | 'ooc'
  | 'dice_roll'
  | 'scene_card'
  | 'clue_discovered'
  | 'inventory_update'
  | 'faction_update'
  | 'clock_update'
  | 'system'
  | 'campaign_summary'
  | 'chapter_transition'
  | 'gm_private'
  | 'ai_suggestion';

export interface Campaign {
  id: string;
  club_id: string;
  title: string;
  slug: string | null;
  pitch: string | null;
  description: string | null;
  template_key: string;
  status: CampaignStatus;
  visibility: CampaignVisibility;
  play_mode: CampaignPlayMode;
  tone_profile: string | null;
  content_notes: string | null;
  opening_premise: string | null;
  player_limit: number | null;
  spectators_allowed: boolean;
  schedule_note: string | null;
  created_by: string;
  proposed_gm_id: string | null;
  gm_id: string | null;
  approved_by: string | null;
  approval_notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  current_chapter_id: string | null;
  current_scene_id: string | null;
  live_session_id: string | null;
  live_started_at: string | null;
  memory_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignMember {
  id: string;
  campaign_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  invited_by: string | null;
}

export interface Character {
  id: string;
  campaign_id: string;
  owner_id: string;
  name: string;
  pronouns: string | null;
  avatar_url: string | null;
  archetype: string | null;
  backstory: string | null;
  personality: string | null;
  goal: string | null;
  flaw: string | null;
  signature_move: string | null;
  stat_grit: number;
  stat_charm: number;
  stat_cunning: number;
  stat_chaos: number;
  stat_focus: number;
  inventory: unknown[];
  conditions: unknown[];
  notes_public: string | null;
  notes_private: string | null;
  is_retired: boolean;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  id: string;
  campaign_id: string;
  chapter_id: string | null;
  title: string;
  location: string | null;
  stakes: string | null;
  objective: string | null;
  public_notes: string | null;
  gm_notes: string | null;
  status: 'active' | 'paused' | 'completed';
  position: number;
  started_at: string;
  ended_at: string | null;
  created_by: string | null;
}

export interface Message {
  id: string;
  campaign_id: string;
  scene_id: string | null;
  sender_id: string | null;
  character_id: string | null;
  npc_id: string | null;
  message_type: MessageType;
  body: string | null;
  visibility: MessageVisibility;
  metadata: Record<string, unknown>;
  created_at: string;
  edited_at: string | null;
}

export interface DiceRoll {
  id: string;
  campaign_id: string;
  scene_id: string | null;
  message_id: string | null;
  roller_id: string | null;
  character_id: string | null;
  stat: ChronicleStat | 'none';
  modifier: number;
  difficulty: number;
  advantage: 'none' | 'advantage' | 'disadvantage';
  d20: number;
  total: number;
  outcome: 'failure' | 'mixed' | 'success' | 'crit';
  reason: string | null;
  resolution: string | null;
  visibility: 'public' | 'gm_only';
  created_at: string;
}

export interface NPC {
  id: string;
  campaign_id: string;
  name: string;
  role: string | null;
  description: string | null;
  location: string | null;
  visibility: 'public' | 'gm_only';
  relationship: string | null;
  secrets: string | null;
  motives: string | null;
  voice_notes: string | null;
  metadata: Record<string, unknown>;
}

export interface Faction {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  relationship_score: number;
  suspicion_score: number;
  attitude: string | null;
  visibility: 'public' | 'gm_only';
  public_notes: string | null;
  gm_notes: string | null;
  metadata: Record<string, unknown>;
}

export interface Clock {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  current_value: number;
  max_value: number;
  clock_type: 'danger' | 'opportunity' | 'mystery' | 'faction' | 'custom';
  visibility: 'public' | 'gm_only';
  related_faction_id: string | null;
  related_npc_id: string | null;
  related_location_id: string | null;
  history: unknown[];
  updated_at: string;
}

export interface Clue {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  discovered_by: string | null;
  visibility: 'public' | 'gm_only';
  importance: 'low' | 'normal' | 'high';
  status: 'discovered' | 'partial' | 'solved' | 'false_lead';
  related_npc_id: string | null;
  related_faction_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Item {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  owner_character_id: string | null;
  visibility: 'public' | 'gm_only';
  use_notes: string | null;
  related_scene_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Location {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  region: string | null;
  visibility: 'public' | 'gm_only';
  metadata: Record<string, unknown>;
}

export interface AiSuggestionRow {
  id: string;
  campaign_id: string;
  scene_id: string | null;
  created_by: string | null;
  suggestion_type: string;
  prompt_context: string | null;
  suggested_content: string | null;
  suggested_state_updates: unknown[];
  status: 'pending' | 'approved' | 'rejected' | 'edited';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
