// Higher seed picks a topic → this creates the draft + participants and links it to the match.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { matchId, topic } = await req.json();
    if (!matchId || !topic || typeof topic !== "string" || topic.trim().length === 0) {
      return new Response(JSON.stringify({ error: "matchId and topic required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller identity
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimData, error: claimErr } = await userClient.auth.getClaims(token);
    if (claimErr || !claimData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimData.claims.sub;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load match
    const { data: match, error: mErr } = await supabase
      .from("draft_playoff_matches")
      .select("*")
      .eq("id", matchId)
      .single();
    if (mErr || !match) throw new Error("match not found");

    if (match.draft_id) {
      return new Response(JSON.stringify({ error: "Match already has a draft", draft_id: match.draft_id }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (match.topic_picker_user_id !== callerId) {
      return new Response(JSON.stringify({ error: "Only the higher seed can pick the topic" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!match.user_a || !match.user_b) {
      return new Response(JSON.stringify({ error: "Match missing participants" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedTopic = topic.trim().slice(0, 200);

    // Create competition
    const { data: comp, error: cErr } = await supabase
      .from("competitions")
      .insert({
        type: "draft",
        title: trimmedTopic,
        description: `Playoff matchup (${String(match.round).toUpperCase()} M${match.match_number})`,
        created_by: callerId,
        status: "active",
      })
      .select()
      .single();
    if (cErr || !comp) throw cErr || new Error("failed to create competition");

    // Create draft
    const { data: draft, error: dErr } = await supabase
      .from("drafts")
      .insert({
        competition_id: comp.id,
        topic: trimmedTopic,
        num_rounds: 5,
        status: "setup",
        created_by: callerId,
      })
      .select()
      .single();
    if (dErr || !draft) throw dErr || new Error("failed to create draft");

    // Random snake order for the two players
    const order = shuffle([match.user_a, match.user_b]);
    await supabase.from("draft_participants").insert([
      { draft_id: draft.id, user_id: order[0], pick_order: 1 },
      { draft_id: draft.id, user_id: order[1], pick_order: 2 },
    ]);

    // Tag draft as a playoff entry in the season
    await supabase.from("draft_season_entries").insert({
      season_id: match.season_id,
      draft_id: draft.id,
      week_number: 0,
      is_playoff: true,
    });

    // Link match
    await supabase.from("draft_playoff_matches").update({
      draft_id: draft.id,
      status: "pending",
    }).eq("id", matchId);

    return new Response(JSON.stringify({ ok: true, draft_id: draft.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("start-playoff-match error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
