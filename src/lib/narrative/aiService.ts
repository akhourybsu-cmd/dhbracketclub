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

import { supabase } from '@/integrations/supabase/client';
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

/** Top-level switch. The narrative-ai edge function is always deployed —
 *  but the LOVABLE_API_KEY env var on the function side determines whether
 *  it can actually call the model. The client-side switch lets us turn AI
 *  on/off without redeploying the function: set
 *      VITE_NARRATIVE_AI_ENABLED=1
 *  to enable, leave unset to keep the AI panel in the friendly
 *  "not configured" state. */
export function isAiConfigured(): boolean {
  return ((import.meta.env.VITE_NARRATIVE_AI_ENABLED as string | undefined) ?? '').length > 0;
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
 * Phase 2: invokes the `narrative-ai` edge function with full GM context.
 * The function loads its own canonical campaign + memory + GM-only data
 * server-side (using the caller's session for auth + service-role for
 * data) — what we pass in `context` is hint metadata only, never trusted
 * as authoritative state.
 *
 * Returns:
 *   - AiSuggestion on success (draft + structured stateUpdates).
 *   - AiUnavailable on any failure or when AI is gated off client-side.
 */
export async function invokeGmTool(
  tool: GmToolKey,
  context: AiGmContext,
): Promise<AiSuggestion | AiUnavailable> {
  if (!isAiConfigured()) return aiUnavailable();
  try {
    const { data, error } = await supabase.functions.invoke('narrative-ai', {
      body: {
        campaign_id: context.campaignId,
        tool,
        prompt: context.prompt ?? null,
      },
    });
    if (error) return aiUnavailable(`AI gateway error: ${error.message ?? 'unknown'}`);
    if (!data || typeof data !== 'object') return aiUnavailable('Empty AI response.');
    if ('error' in data) return aiUnavailable(String((data as any).error));
    return {
      draft: String((data as any).draft ?? ''),
      stateUpdates: Array.isArray((data as any).stateUpdates) ? (data as any).stateUpdates : [],
      rationale: (data as any).rationale ? String((data as any).rationale) : undefined,
    };
  } catch (e) {
    return aiUnavailable(`AI call failed: ${(e as Error).message}`);
  }
}

/* ─── Player AI invocation ────────────────────────────────────── */

/**
 * Phase 2: player AI assistant. The edge function loads only public
 * scope server-side (no GM notes, no hidden clues/factions/clocks, no
 * other players' private data) — even if the caller is technically the
 * GM, this code path re-fetches with a public lens.
 */
export async function invokePlayerTool(
  context: AiPlayerContext,
): Promise<{ draft: string } | AiUnavailable> {
  if (!isAiConfigured()) return aiUnavailable();
  try {
    const { data, error } = await supabase.functions.invoke('narrative-ai', {
      body: {
        campaign_id: context.campaignId,
        player: context.intent,
        draft: context.draft,
      },
    });
    if (error) return aiUnavailable(`AI gateway error: ${error.message ?? 'unknown'}`);
    if (!data || typeof data !== 'object') return aiUnavailable('Empty AI response.');
    if ('error' in data) return aiUnavailable(String((data as any).error));
    return { draft: String((data as any).draft ?? '') };
  } catch (e) {
    return aiUnavailable(`AI call failed: ${(e as Error).message}`);
  }
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
  ctx: RollResolutionContext & { campaignId?: string },
): Promise<{ draft: string } | AiUnavailable> {
  if (!isAiConfigured() || !ctx.campaignId) return aiUnavailable();
  // Roll resolution piggybacks on the resolve_roll GM tool.
  const result = await invokeGmTool('resolve_roll', {
    campaignId: ctx.campaignId,
    prompt: `Roll outcome: ${ctx.outcome}. Stat: ${ctx.stat}. Reason: ${ctx.reason ?? ''}. Character: ${ctx.characterName ?? ''}.`,
  });
  if ('available' in result && result.available === false) return result;
  return { draft: (result as AiSuggestion).draft };
}
