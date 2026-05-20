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
  // The narrative-ai edge function is deployed and LOVABLE_API_KEY is
  // provisioned at the project level, so AI is on by default. Set
  // VITE_NARRATIVE_AI_ENABLED=0 to force-disable on the client.
  const flag = (import.meta.env.VITE_NARRATIVE_AI_ENABLED as string | undefined);
  if (flag === '0' || flag === 'false') return false;
  return true;
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
  /** Optional extra parts produced by multi-part tools — e.g. chapter
   *  transitions return a recap + hook in addition to the title, and
   *  end_scene returns a scene summary in addition to the closing
   *  narration. The Writer's Room writes any populated fields into the
   *  posted message's metadata so the existing renderers (e.g.
   *  FlamingoChapterCard reading `metadata.summary`) can use them. */
  extras?: {
    summary?: string;
    recap?: string;
    hook?: string;
  };
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
  // Legacy tool keys — preserved so any existing UI keeps working.
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
  | 'faction_complication'
  // Writer's Room v1 — the 10 core writing tools the GM brief asked for.
  | 'write_scene_opener'
  | 'continue_scene'
  | 'npc_response'
  | 'suggest_consequences'
  | 'reveal_clue'
  | 'end_scene'
  | 'chapter_transition'
  | 'transform_draft';

export interface GmToolMeta {
  key: GmToolKey;
  label: string;
  description: string;
  /** Whether this tool typically produces stateUpdates (used by the UI to show a state-update preview row). */
  producesStateUpdates: boolean;
  /** Default suggested message type for the resulting draft. The GM
   *  can override this on the draft card before posting. */
  defaultMessageType?: 'gm_narration' | 'npc_dialogue' | 'system' | 'chapter_transition' | 'campaign_summary' | 'gm_private';
  /** Optional category for grouping in the Writer's Room picker. */
  group?: 'scene' | 'dialogue' | 'consequences' | 'memory' | 'transform' | 'misc';
}

export const GM_TOOLS: GmToolMeta[] = [
  // ── Writer's Room v1 (new) ────────────────────────────────────
  { key: 'write_scene_opener',    label: 'Write scene opener',         description: 'Polished opening narration + suggested rolls for the next scene.',                          producesStateUpdates: true,  defaultMessageType: 'gm_narration', group: 'scene' },
  { key: 'continue_scene',        label: 'Continue current scene',     description: 'Extend the current scene from where it left off.',                                         producesStateUpdates: false, defaultMessageType: 'gm_narration', group: 'scene' },
  { key: 'npc_response',          label: 'Write NPC response',         description: 'NPC reacts to the most recent player message, given NPC intent + tone.',                   producesStateUpdates: false, defaultMessageType: 'npc_dialogue', group: 'dialogue' },
  { key: 'resolve_roll',          label: 'Resolve roll cinematically', description: 'Cinematic narration that resolves the current roll outcome.',                              producesStateUpdates: false, defaultMessageType: 'gm_narration', group: 'consequences' },
  { key: 'suggest_consequences',  label: 'Suggest consequences',       description: '3–5 consequence options the GM can pick from. Each comes with a suggested state update.',  producesStateUpdates: true,  defaultMessageType: 'gm_private',    group: 'consequences' },
  { key: 'reveal_clue',           label: 'Reveal a clue',              description: 'Narration that reveals a clue (subtle or direct).',                                        producesStateUpdates: true,  defaultMessageType: 'gm_narration', group: 'consequences' },
  { key: 'escalate',              label: 'Escalate the situation',     description: 'Push the scene into higher stakes with NPC/faction reactions.',                            producesStateUpdates: true,  defaultMessageType: 'gm_narration', group: 'consequences' },
  { key: 'end_scene',             label: 'End scene',                  description: 'Closing narration + transition prompt + suggested scene summary.',                         producesStateUpdates: false, defaultMessageType: 'gm_narration', group: 'scene' },
  { key: 'chapter_transition',    label: 'Chapter transition',         description: 'Cinematic chapter card text + "Previously on…" recap + opening hook.',                     producesStateUpdates: false, defaultMessageType: 'chapter_transition', group: 'scene' },
  { key: 'summarize_scene',       label: 'Summarize scene → memory',   description: 'Scene summary with major decisions, quotes, unresolved questions + memory updates.',       producesStateUpdates: true,  defaultMessageType: 'campaign_summary', group: 'memory' },
  // ── Transformations ────────────────────────────────────────────
  { key: 'transform_draft',       label: 'Transform draft',            description: 'Rewrite an existing draft with a one-click style transformation.',                         producesStateUpdates: false, defaultMessageType: 'gm_narration', group: 'transform' },
  // ── Legacy tools (kept for back-compat with any older UI) ─────
  { key: 'scene_flavor',          label: 'Scene flavor',               description: 'Draft a sensory paragraph of the current location.',                                       producesStateUpdates: false, group: 'misc' },
  { key: 'npc_dialogue',          label: 'NPC dialogue (legacy)',      description: 'Draft a line of NPC dialogue.',                                                            producesStateUpdates: false, group: 'misc' },
  { key: 'consequences',          label: 'Consequences (legacy)',      description: 'Three plausible consequences.',                                                            producesStateUpdates: true,  group: 'misc' },
  { key: 'three_twists',          label: 'Three twists',               description: 'Three escalations consistent with current canon.',                                         producesStateUpdates: true,  group: 'misc' },
  { key: 'generate_clue',         label: 'Generate a clue',            description: 'Draft a clue tied to current state.',                                                      producesStateUpdates: true,  group: 'misc' },
  { key: 'npc_reaction',          label: 'NPC reaction',               description: 'Draft NPC reaction to last player action.',                                                producesStateUpdates: false, group: 'misc' },
  { key: 'next_scene_options',    label: 'Next scene options',         description: 'Three possible next scenes.',                                                              producesStateUpdates: false, group: 'misc' },
  { key: 'rewrite_in_tone',       label: 'Rewrite in tone',            description: 'Rewrite a passage to match the campaign tone profile.',                                    producesStateUpdates: false, group: 'transform' },
  { key: 'suggest_state_updates', label: 'Suggest state updates',      description: 'Read recent messages and propose state changes.',                                          producesStateUpdates: true,  group: 'misc' },
  { key: 'summarize_recent',      label: 'Summarize last N',           description: 'Catch-up summary for async players.',                                                      producesStateUpdates: false, group: 'memory' },
  { key: 'generate_location',     label: 'Generate location',          description: 'Draft a new location.',                                                                    producesStateUpdates: true,  group: 'misc' },
  { key: 'faction_complication',  label: 'Faction complication',       description: 'Draft a complication tied to a faction.',                                                  producesStateUpdates: true,  group: 'misc' },
];

/** The 10 tools the Writer's Room surfaces by default, in the order
 *  the GM brief specified. Other GM_TOOLS entries remain callable for
 *  backwards-compat but are not picker-listed. */
export const WRITERS_ROOM_TOOL_KEYS: readonly GmToolKey[] = [
  'write_scene_opener',
  'continue_scene',
  'npc_response',
  'resolve_roll',
  'suggest_consequences',
  'reveal_clue',
  'escalate',
  'end_scene',
  'chapter_transition',
  'summarize_scene',
] as const;

/* ─── Writer's Room control surface ────────────────────────────── */

export type WriterTone =
  | 'cinematic' | 'funny' | 'dangerous' | 'subtle'
  | 'chaotic' | 'noir' | 'conversational' | 'high_drama'
  // Flamingo Protocol special tones
  | 'more_flamingo' | 'more_velvetaine' | 'more_miami_vice'
  | 'more_casino' | 'more_catalina' | 'more_tony_pressure'
  | 'more_tape_tension' | 'more_chaos';

export type WriterLength = 'one_liner' | 'short' | 'medium' | 'long' | 'monologue';

export type WriterTransformation =
  | 'shorten' | 'expand' | 'more_cinematic' | 'funnier'
  | 'more_tense' | 'more_subtle' | 'add_flamingo_flavor'
  | 'remove_spoilers' | 'to_npc_dialogue' | 'to_gm_narration'
  | 'add_player_prompt';

export type WriterSafety =
  | 'no_reveal_gm_notes'
  | 'no_reveal_hidden_clues'
  | 'no_auto_state_change'
  | 'no_speak_for_players'
  | 'no_resolve_without_roll'
  | 'keep_mystery'
  | 'protect_secrets';

export interface WriterControls {
  tone?: WriterTone;
  length?: WriterLength;
  safety?: WriterSafety[];
  /** Free-text "what I want from the AI" — the most important input. */
  direction?: string;
  /** Optional NPC id when the tool needs an NPC to speak as / react as. */
  npcId?: string | null;
  /** For npc_response: what the NPC intends to convey/resist. */
  npcIntent?: string;
  /** For transform_draft: the original draft to transform + the
   *  transformation key. */
  originalDraft?: string;
  transformation?: WriterTransformation;
  /** Free-form "GM consequence note" used by resolve_roll. */
  consequenceNote?: string;
  /** For reveal_clue: which clue (id) and reveal mode. */
  clueId?: string | null;
  revealMode?: 'subtle' | 'direct';
}

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
  controls?: WriterControls,
): Promise<AiSuggestion | AiUnavailable> {
  if (!isAiConfigured()) return aiUnavailable();
  try {
    const { data, error } = await supabase.functions.invoke('narrative-ai', {
      body: {
        campaign_id: context.campaignId,
        tool,
        prompt: context.prompt ?? controls?.direction ?? null,
        controls: controls ?? null,
      },
    });
    if (error) return aiUnavailable(`AI gateway error: ${error.message ?? 'unknown'}`);
    if (!data || typeof data !== 'object') return aiUnavailable('Empty AI response.');
    if ('error' in data) return aiUnavailable(String((data as any).error));
    const raw = data as any;
    const extras: AiSuggestion['extras'] | undefined =
      raw.extras && typeof raw.extras === 'object'
        ? {
            summary: typeof raw.extras.summary === 'string' ? raw.extras.summary : undefined,
            recap: typeof raw.extras.recap === 'string' ? raw.extras.recap : undefined,
            hook: typeof raw.extras.hook === 'string' ? raw.extras.hook : undefined,
          }
        : undefined;
    return {
      draft: String(raw.draft ?? ''),
      stateUpdates: Array.isArray(raw.stateUpdates) ? raw.stateUpdates : [],
      rationale: raw.rationale ? String(raw.rationale) : undefined,
      extras,
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
