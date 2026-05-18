// DH Club — Narrative RPG · AI edge function
//
// One endpoint covering both GM and player AI tools. The request body
// specifies `tool` (a GmToolKey) OR `player` (a PlayerIntent) and a
// context blob. The function:
//
//   1. Authenticates the caller via their Supabase session.
//   2. Loads the campaign + verifies role (GM/admin for GM tools,
//      member for player tools).
//   3. Builds a strict context for the LLM that honors hidden-data
//      boundaries:
//        - GM tools may include campaign memory, scene gm_notes,
//          faction gm_notes, hidden clocks/clues.
//        - Player tools are scoped to PUBLIC data only — even though
//          the caller may technically be a GM, this endpoint
//          intentionally re-fetches with a public lens for player tools.
//   4. Calls the Lovable AI gateway with a constrained system prompt
//      that ENFORCES the "AI is assistive, not authoritative" rules:
//      no state mutation, never reveal hidden info to player tools,
//      always return structured `{ draft, stateUpdates, rationale }`.
//   5. Returns the parsed result — never writes to the DB. State
//      updates are surfaced in the response so the GM can review +
//      approve them in the UI before they're applied.
//
// AiSuggestion shape mirrors src/lib/narrative/aiService.ts exactly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tool keys mirrored from src/lib/narrative/aiService.ts. Keep in sync.
const GM_TOOL_KEYS = new Set([
  "scene_flavor", "npc_dialogue", "consequences", "three_twists", "escalate",
  "resolve_roll", "generate_clue", "npc_reaction", "next_scene_options",
  "rewrite_in_tone", "suggest_state_updates", "summarize_scene",
  "summarize_recent", "generate_location", "faction_complication",
]);

const PLAYER_INTENTS = new Set([
  "in_character", "cinematic", "funnier", "clarify_scene", "recap_public",
]);

interface RequestBody {
  campaign_id: string;
  /** For GM tools. */
  tool?: string;
  /** For player tools. */
  player?: string;
  /** GM tools: caller-provided prompt hint. Player tools: the user's draft. */
  prompt?: string;
  /** Player tools: the user's draft they're trying to improve. */
  draft?: string;
  /** Optional explicit scene id. Defaults to current scene if omitted. */
  scene_id?: string;
}

interface StateUpdateAction {
  kind: string;
  payload: Record<string, unknown>;
}

interface AiSuggestion {
  draft: string;
  stateUpdates: StateUpdateAction[];
  rationale?: string;
}

const PHASE2_VERSION = "2.0";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError(401, "Unauthorized");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return jsonError(503, "AI provider not configured. Set LOVABLE_API_KEY.");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claims.user) return jsonError(401, "Unauthorized");
    const userId = claims.user.id;

    const body = (await req.json()) as RequestBody;
    if (!body.campaign_id) return jsonError(400, "campaign_id required");
    if (!body.tool && !body.player) return jsonError(400, "tool or player required");
    if (body.tool && !GM_TOOL_KEYS.has(body.tool)) return jsonError(400, `unknown tool ${body.tool}`);
    if (body.player && !PLAYER_INTENTS.has(body.player)) return jsonError(400, `unknown player intent ${body.player}`);

    // Service-role client for data access. RLS bypassed for our queries,
    // but we explicitly enforce role checks below before returning data.
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Load campaign + role
    const { data: campaign, error: campErr } = await admin
      .from("narrative_campaigns")
      .select("id, club_id, gm_id, status, tone_profile, current_scene_id, memory_summary")
      .eq("id", body.campaign_id)
      .maybeSingle();
    if (campErr || !campaign) return jsonError(404, "Campaign not found");

    // Check membership / GM status
    const isGm = campaign.gm_id === userId;
    let memberRole: string | null = null;
    if (!isGm) {
      const { data: mem } = await admin
        .from("narrative_campaign_members")
        .select("role, status")
        .eq("campaign_id", body.campaign_id)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      memberRole = mem?.role ?? null;
    }

    // Also check club admin
    const { data: clubMem } = await admin
      .from("club_members")
      .select("role")
      .eq("club_id", campaign.club_id)
      .eq("user_id", userId)
      .maybeSingle();
    const isClubAdmin = clubMem?.role === "admin";

    // Authorization gates
    if (body.tool) {
      if (!isGm && !isClubAdmin) return jsonError(403, "GM tools require Game Master role.");
    } else if (body.player) {
      if (!isGm && !memberRole && !isClubAdmin) return jsonError(403, "Not a campaign member.");
    }

    const sceneId = body.scene_id ?? campaign.current_scene_id;

    // Load context — DIFFERENT for GM vs player tools.
    const ctx = body.tool
      ? await loadGmContext(admin, campaign.id, sceneId, body.prompt)
      : await loadPlayerContext(admin, campaign.id, sceneId, userId);

    // Build prompt + invoke gateway
    const systemPrompt = body.tool
      ? buildGmSystemPrompt(body.tool, campaign.tone_profile ?? undefined)
      : buildPlayerSystemPrompt(body.player!);
    const userPrompt = body.tool
      ? buildGmUserPrompt(body.tool, ctx, body.prompt)
      : buildPlayerUserPrompt(body.player!, ctx, body.draft ?? "");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => "unknown");
      console.error("AI gateway error", aiResponse.status, errText);
      return jsonError(502, "AI gateway failed", { status: aiResponse.status });
    }
    const aiJson = await aiResponse.json();
    const content = aiJson?.choices?.[0]?.message?.content;
    if (!content) return jsonError(502, "Empty AI response");

    let parsed: AiSuggestion;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Fall back to plain text — empty stateUpdates so it stays inert.
      parsed = { draft: String(content), stateUpdates: [] };
    }
    // Strict guard: player tools may never return state updates.
    if (body.player) parsed.stateUpdates = [];

    return new Response(JSON.stringify({ ...parsed, version: PHASE2_VERSION }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("narrative-ai error", err);
    return jsonError(500, "Internal error");
  }
});

function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ─── Context loaders ───────────────────────────────────────── */

async function loadGmContext(admin: any, campaignId: string, sceneId: string | null, _prompt: string | undefined) {
  // GM scope: full visibility
  const [{ data: scene }, { data: msgs }, { data: memory }, { data: factions }, { data: clocks }, { data: npcs }, { data: clues }] = await Promise.all([
    sceneId ? admin.from("narrative_scenes").select("*").eq("id", sceneId).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("narrative_messages").select("message_type, body, sender_id, created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(40),
    admin.from("narrative_memory").select("*").eq("campaign_id", campaignId).maybeSingle(),
    admin.from("narrative_factions").select("name, description, attitude, relationship_score, suspicion_score, gm_notes").eq("campaign_id", campaignId),
    admin.from("narrative_clocks").select("name, current_value, max_value, clock_type, visibility, description").eq("campaign_id", campaignId),
    admin.from("narrative_npcs").select("name, role, description, motives, secrets, voice_notes").eq("campaign_id", campaignId),
    admin.from("narrative_clues").select("name, description, status, visibility, importance").eq("campaign_id", campaignId),
  ]);
  return { scene, recentMessages: (msgs ?? []).reverse(), memory, factions, clocks, npcs, clues };
}

async function loadPlayerContext(admin: any, campaignId: string, sceneId: string | null, userId: string) {
  // Player scope: ONLY public data + this user's own character.
  const [{ data: scene }, { data: msgs }, { data: character }] = await Promise.all([
    sceneId ? admin.from("narrative_scenes").select("title, location, public_notes, objective").eq("id", sceneId).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("narrative_messages")
      .select("message_type, body, sender_id, created_at")
      .eq("campaign_id", campaignId)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(20),
    admin.from("narrative_characters").select("*").eq("campaign_id", campaignId).eq("owner_id", userId).eq("is_retired", false).maybeSingle(),
  ]);
  return { scene, recentMessages: (msgs ?? []).reverse(), character };
}

/* ─── Prompt builders ───────────────────────────────────────── */

const GM_BASE_RULES = `You are a Game Master assistant for a Chronicle Engine tabletop campaign in DH Club. RULES YOU MUST FOLLOW:
- You ARE NOT the Game Master. You assist.
- Never mutate game state directly. You only PROPOSE state changes; the human GM reviews and approves them.
- Return a JSON object with this exact shape: { "draft": string, "stateUpdates": Array<{kind: string, payload: object}>, "rationale": string }.
- "draft" is free narration the GM may post, edit, or discard.
- "stateUpdates" is OPTIONAL. Each entry must have kind ∈ { add_item, add_clue, update_faction, advance_clock, create_npc, add_location, add_condition, update_memory, add_log_entry }. payload is the specific field set for that kind.
- Be terse. The GM reviews this on a phone.
- Match the campaign tone profile when provided.`;

const PLAYER_BASE_RULES = `You are a writing assistant for a single player in a Chronicle Engine campaign in DH Club. STRICT RULES:
- You see ONLY public scene context and this user's own character. You do NOT have access to GM notes, hidden clues, secret NPC motives, hidden factions, or other players' private data.
- Never reveal information beyond what the player can already see in the public scene.
- Never recommend optimal strategic moves based on hidden state — you can't see hidden state.
- Never write for the GM, NPCs, or another player's character.
- Return a JSON object: { "draft": string }. Just rewrite or draft the player's text. Do NOT include stateUpdates.
- Keep it short — phone-sized response.`;

function buildGmSystemPrompt(tool: string, toneProfile?: string) {
  const toneLine = toneProfile ? `\nCampaign tone: ${toneProfile}` : "";
  return `${GM_BASE_RULES}${toneLine}\nTool: ${tool}`;
}

function buildPlayerSystemPrompt(intent: string) {
  return `${PLAYER_BASE_RULES}\nIntent: ${intent}`;
}

function buildGmUserPrompt(tool: string, ctx: any, hint?: string) {
  const sceneBlock = ctx.scene
    ? `CURRENT SCENE:
title: ${ctx.scene.title}
location: ${ctx.scene.location ?? "—"}
objective: ${ctx.scene.objective ?? "—"}
stakes: ${ctx.scene.stakes ?? "—"}
public notes: ${ctx.scene.public_notes ?? "—"}
GM notes (private): ${ctx.scene.gm_notes ?? "—"}`
    : "NO ACTIVE SCENE.";

  const recent = (ctx.recentMessages as any[]).slice(-20)
    .map((m: any) => `[${m.message_type}] ${m.body ?? ""}`).join("\n");

  return `${sceneBlock}

RECENT MESSAGES (oldest first):
${recent || "—"}

CAMPAIGN MEMORY:
${JSON.stringify(ctx.memory ?? {}, null, 2)}

FACTIONS:
${JSON.stringify(ctx.factions ?? [], null, 2)}

CLOCKS:
${JSON.stringify(ctx.clocks ?? [], null, 2)}

NPCs:
${JSON.stringify(ctx.npcs ?? [], null, 2)}

CLUES:
${JSON.stringify(ctx.clues ?? [], null, 2)}

GM HINT (optional): ${hint ?? "—"}

Respond with the JSON object described in the system rules.`;
}

function buildPlayerUserPrompt(intent: string, ctx: any, draft: string) {
  const sceneBlock = ctx.scene
    ? `PUBLIC SCENE:
title: ${ctx.scene.title}
location: ${ctx.scene.location ?? "—"}
public notes: ${ctx.scene.public_notes ?? "—"}
objective: ${ctx.scene.objective ?? "—"}`
    : "NO ACTIVE SCENE.";

  const recent = (ctx.recentMessages as any[]).slice(-10)
    .map((m: any) => `[${m.message_type}] ${m.body ?? ""}`).join("\n");

  const characterBlock = ctx.character
    ? `YOUR CHARACTER:
name: ${ctx.character.name}
archetype: ${ctx.character.archetype ?? "—"}
personality: ${ctx.character.personality ?? "—"}
goal: ${ctx.character.goal ?? "—"}
flaw: ${ctx.character.flaw ?? "—"}
signature move: ${ctx.character.signature_move ?? "—"}`
    : "NO CHARACTER YET.";

  return `${sceneBlock}

${characterBlock}

RECENT PUBLIC MESSAGES:
${recent || "—"}

INTENT: ${intent}
PLAYER DRAFT: ${draft || "(empty — generate from intent)"}

Respond with the JSON: { "draft": string }`;
}
