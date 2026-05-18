// DH Club — Narrative RPG · AI service abstractions (stub-only for Phase 1)
//
// The Narrative RPG plugin treats AI as a strict assistant: it can DRAFT,
// SUGGEST, and SUMMARIZE, but it can NEVER mutate campaign state directly.
// Every AI-driven change has to flow through the Game Master review queue
// (the `narrative_ai_suggestions` table) so a human approves before
// anything becomes canon.
//
// This file defines the typed surface area. Until a real AI provider is
// wired up, each function returns a clearly-marked placeholder so the UI
// degrades gracefully and you can see exactly where the wiring goes when
// you plug in an edge function or another provider.
//
// To wire a real provider:
//   1. Implement these functions to call a Supabase Edge Function (or any
//      provider) that returns the same shapes.
//   2. The UI doesn't change — it already consumes the typed results.
//   3. RLS already restricts AI suggestions to GM/admin; preserve that.
//
// AI safety rules baked into this module:
//   • GM tools have full context access (memory + GM notes + hidden state).
//   • Player tools receive only PUBLIC scope (filtered context).
//   • Suggested state updates are returned as a structured array — the GM
//     reviews & approves each one before the engine applies anything.
//   • Player rewriting tools must never see GM-only context.

import type { ChronicleStat, RollOutcome } from './chronicleRuleset';

/** Returned when AI is not yet wired up. The UI checks this so it can
 *  show a friendly "AI not configured" state instead of pretending. */
export interface AiUnavailable {
  available: false;
  reason: string;
}
export function aiUnavailable(reason = 'AI provider not configured for this build.'): AiUnavailable {
  return { available: false, reason };
}

/** Top-level switch — flips to true once a real provider is wired in.
 *  Read by the UI to enable/disable AI buttons. Reads VITE_AI_PROVIDER
 *  if you want to flip it via env, otherwise stays false. */
export function isAiConfigured(): boolean {
  return ((import.meta.env.VITE_AI_PROVIDER as string | undefined) ?? '').length > 0;
}

/* ─── Shared types ───────────────────────────────────────────── */

export type StateUpdateAction =
  | { kind: 'add_item';            payload: { name: string; description?: string; owner_character_id?: string | null } }
  | { kind: 'add_clue';            payload: { name: string; description?: string; visibility?: 'public' | 'gm_only'; importance?: 'low' | 'normal' | 'high' } }
  | { kind: 'update_faction';      payload: { faction_id: string; relationship_delta?: number; suspicion_delta?: number; attitude?: string } }
  | { kind: 'advance_clock';       payload: { clock_id: string; delta?: number; note?: string } }
  | { kind: 'create_npc';          payload: { name: string; role?: string; description?: string; visibility?: 'public' | 'gm_only' } }
  | { kind: 'add_location';        payload: { name: string; description?: string; visibility?: 'public' | 'gm_only' } }
  | { kind: 'add_condition';       payload: { character_id: string; condition: string } }
  | { kind: 'update_memory';       payload: { field: string; value: string } }
  | { kind: 'add_log_entry';       payload: { title?: string; body: string; visibility?: 'public' | 'gm_only' } };

export interface AiSuggestion {
  /** Free-form draft text the GM can publish, rewrite, or discard. */
  draft: string;
  /** Optional structured updates the GM can approve into real state changes. */
  stateUpdates: StateUpdateAction[];
  /** A short rationale shown beside the suggestion so the GM understands the AI's reasoning. */
  rationale?: string;
}

/** Context passed into every GM AI call. The service should NOT add
 *  hidden context beyond what's in this object so it stays auditable. */
export interface AiGmContext {
  campaignId: string;
  /** Full campaign memory blob (GM scope — includes gm_only_notes). */
  memory?: Record<string, unknown> | null;
  /** Current scene snapshot. */
  scene?: { title?: string; location?: string; stakes?: string; objective?: string; public_notes?: string; gm_notes?: string } | null;
  /** Recent messages (most-recent first). */
  recentMessages?: Array<{ message_type: string; body: string | null; sender_name?: string }>;
  /** Tone profile + canon notes. */
  toneProfile?: string;
  /** Optional extra hint the GM typed into the prompt box. */
  prompt?: string;
}

export interface AiPlayerContext {
  campaignId: string;
  /** Public-scope context only — never includes gm_only data. */
  characterName?: string;
  characterArchetype?: string;
  visibleScene?: { title?: string; location?: string; public_notes?: string } | null;
  recentPublicMessages?: Array<{ message_type: string; body: string | null; sender_name?: string }>;
  /** The user's draft message they're trying to improve. */
  draft: string;
  /** What flavor of help they're asking for. */
  intent: 'in_character' | 'cinematic' | 'funnier' | 'clarify_scene' | 'recap_public';
}

/* ─── GM AI tools ────────────────────────────────────────────── */

export type GmToolKey =
  | 'scene_flavor'
  | 'npc_dialogue'
  | 'consequences'
  | 'three_twists'
  | 'escalate'
  | 'resolve_roll'
  | 'generate_clue'
  | 'npc_reaction'
  | 'next_scene_options'
  | 'rewrite_in_tone'
  | 'suggest_state_updates'
  | 'summarize_scene'
  | 'summarize_recent'
  | 'generate_location'
  | 'faction_complication';

export interface GmToolMeta {
  key: GmToolKey;
  label: string;
  description: string;
  /** Whether this tool typically produces stateUpdates (used by the UI to show a state-update preview row). */
  producesStateUpdates: boolean;
}

export const GM_TOOLS: GmToolMeta[] = [
  { key: 'scene_flavor',          label: 'Scene flavor',          description: 'Draft a sensory paragraph of the current location in campaign tone.', producesStateUpdates: false },
  { key: 'npc_dialogue',          label: 'NPC dialogue',          description: 'Draft a line of dialogue from an NPC, given current scene context.', producesStateUpdates: false },
  { key: 'consequences',          label: 'Suggest consequences',  description: 'Three plausible consequences the GM can choose from.',                producesStateUpdates: true  },
  { key: 'three_twists',          label: 'Three twists',          description: 'Three escalations or reveals consistent with current canon.',         producesStateUpdates: true  },
  { key: 'escalate',              label: 'Escalate the situation', description: 'Push the current scene into higher stakes.',                          producesStateUpdates: true  },
  { key: 'resolve_roll',          label: 'Resolve roll cinematically', description: 'Draft a narration that resolves the current roll outcome.',     producesStateUpdates: false },
  { key: 'generate_clue',         label: 'Generate a clue',       description: 'Draft a clue tied to current state. Player-discoverable by default.', producesStateUpdates: true  },
  { key: 'npc_reaction',          label: 'NPC reaction',          description: 'Draft how an NPC reacts to the most recent player action.',           producesStateUpdates: false },
  { key: 'next_scene_options',    label: 'Next scene options',    description: 'Three possible next scenes given current memory + clocks.',          producesStateUpdates: false },
  { key: 'rewrite_in_tone',       label: 'Rewrite in tone',       description: 'Rewrite a passage to better match the campaign tone profile.',       producesStateUpdates: false },
  { key: 'suggest_state_updates', label: 'Suggest state updates', description: 'Read recent messages and propose specific state changes for review.', producesStateUpdates: true  },
  { key: 'summarize_scene',       label: 'Summarize scene',       description: 'Draft a scene summary to save to campaign memory.',                   producesStateUpdates: false },
  { key: 'summarize_recent',      label: 'Summarize last N',      description: 'Draft a catch-up summary of recent messages for async players.',     producesStateUpdates: false },
  { key: 'generate_location',     label: 'Generate location',     description: 'Draft a new location consistent with the setting.',                  producesStateUpdates: true  },
  { key: 'faction_complication',  label: 'Faction complication',  description: 'Draft a complication tied to a specific faction.',                   producesStateUpdates: true  },
];

/* ─── GM AI invocation ────────────────────────────────────────── */

/**
 * Stub: returns a clearly-marked placeholder so the UI degrades
 * gracefully when no AI provider is configured. Real implementation
 * should call a Supabase Edge Function passing the typed context above.
 */
export async function invokeGmTool(
  tool: GmToolKey,
  context: AiGmContext,
): Promise<AiSuggestion | AiUnavailable> {
  if (!isAiConfigured()) {
    return aiUnavailable();
  }
  // Future: replace this branch with a real provider call.
  // Example shape:
  //   const { data, error } = await supabase.functions.invoke('narrative-ai-gm', {
  //     body: { tool, context },
  //   });
  //   if (error) throw error;
  //   return data as AiSuggestion;
  return aiUnavailable('Reach AI provider here once the edge function is wired up.');
}

/* ─── Player AI invocation ────────────────────────────────────── */

/**
 * Stub: same pattern as GM tool but with strictly public-scope context.
 * The implementation MUST refuse any request that touches hidden state.
 */
export async function invokePlayerTool(
  context: AiPlayerContext,
): Promise<{ draft: string } | AiUnavailable> {
  if (!isAiConfigured()) {
    return aiUnavailable();
  }
  return aiUnavailable('Reach AI provider here once the edge function is wired up.');
}

/* ─── Suggested resolution narration for a roll ───────────────── */

export interface RollResolutionContext {
  characterName?: string;
  stat: ChronicleStat | 'none';
  outcome: RollOutcome;
  reason?: string;
  recentMessages?: AiGmContext['recentMessages'];
  toneProfile?: string;
}

export async function suggestRollResolution(
  _ctx: RollResolutionContext,
): Promise<{ draft: string } | AiUnavailable> {
  if (!isAiConfigured()) {
    return aiUnavailable();
  }
  return aiUnavailable();
}
