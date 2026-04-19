// Generate a head-to-head playoff draft between two users with an AI-generated topic.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROUND_LABEL: Record<string, string> = {
  qf: "Quarterfinal",
  sf: "Semifinal",
  final: "Championship",
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
    const { seasonId, matchId } = await req.json();
    if (!seasonId || !matchId) {
      return new Response(JSON.stringify({ error: "seasonId and matchId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    if (mErr || !match) throw new Error(mErr?.message || "match not found");

    if (match.draft_id) {
      return new Response(JSON.stringify({ draftId: match.draft_id, alreadyExists: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!match.user_a || !match.user_b) {
      throw new Error("match missing users");
    }

    // Load season + previous topics for variety
    const { data: season } = await supabase
      .from("draft_seasons").select("*").eq("id", seasonId).single();

    const { data: priorEntries } = await supabase
      .from("draft_season_entries")
      .select("drafts:draft_id(topic)")
      .eq("season_id", seasonId);
    const priorTopics = (priorEntries || [])
      .map((e: any) => e.drafts?.topic).filter(Boolean);

    // Load player names
    const { data: profiles } = await supabase
      .from("profiles").select("id, display_name").in("id", [match.user_a, match.user_b]);
    const nameA = profiles?.find((p: any) => p.id === match.user_a)?.display_name || "Player A";
    const nameB = profiles?.find((p: any) => p.id === match.user_b)?.display_name || "Player B";

    // Ask AI for a topic
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const roundLabel = ROUND_LABEL[match.round] || match.round;
    const sysPrompt = `You generate fun, accessible head-to-head draft topics for a friend group's playoff matchup. Each topic must be a "Top 5 X" style draft where two people take turns picking items. Topics must be specific, fun, and broadly relevant — pop culture, food, sports, movies, music, life experiences. Avoid niche or obscure subjects. Never repeat a previously used topic.`;

    const userPrompt = `Generate ONE fresh draft topic for a ${roundLabel} matchup between ${nameA} (#${match.seed_a}) and ${nameB} (#${match.seed_b}).

Previously used topics this season (DO NOT repeat or closely resemble):
${priorTopics.length ? priorTopics.map((t: string) => `- ${t}`).join("\n") : "(none yet)"}

Return a topic that is fun, conversational, and easy for two players to argue about. Examples of style: "Top 5 Movie Villains of All Time", "Best Pizza Toppings", "Greatest Comedy Movies of the 2000s", "Top 5 Road Trip Snacks".`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "set_topic",
            description: "Return the generated draft topic",
            parameters: {
              type: "object",
              properties: {
                topic: { type: "string", description: "The draft topic title (e.g. 'Top 5 Movie Villains of All Time')" },
                category: { type: "string", description: "Short category tag", enum: ["movies", "tv", "music", "food", "sports", "games", "people", "lifestyle", "other"] },
              },
              required: ["topic", "category"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "set_topic" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      throw new Error(`AI gateway ${aiResp.status}`);
    }
    const aiJson = await aiResp.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : null;
    const topic = parsed?.topic || `${roundLabel}: ${nameA} vs ${nameB}`;
    const category = parsed?.category || "other";

    // Create competition + draft
    const { data: comp, error: cErr } = await supabase
      .from("competitions").insert({
        title: `${season?.name || "Season"} ${roundLabel}`,
        type: "draft",
        status: "active",
        created_by: season?.commissioner_user_id || match.user_a,
        description: `Playoff ${roundLabel}: #${match.seed_a} ${nameA} vs #${match.seed_b} ${nameB}`,
      }).select().single();
    if (cErr) throw cErr;

    const { data: draft, error: dErr } = await supabase
      .from("drafts").insert({
        competition_id: comp.id,
        topic,
        category,
        num_rounds: 5,
        status: "setup",
        created_by: season?.commissioner_user_id || match.user_a,
        timer_seconds: 60,
      }).select().single();
    if (dErr) throw dErr;

    // Random pick order (Fisher-Yates)
    const order = shuffle([match.user_a, match.user_b]);
    const { error: pErr } = await supabase.from("draft_participants").insert([
      { draft_id: draft.id, user_id: order[0], pick_order: 1 },
      { draft_id: draft.id, user_id: order[1], pick_order: 2 },
    ]);
    if (pErr) throw pErr;

    // Set first turn
    await supabase.from("drafts").update({
      current_pick_user_id: order[0],
      current_pick_number: 1,
      current_round: 1,
    }).eq("id", draft.id);

    // Link to match + assign to season as a playoff entry
    await supabase.from("draft_playoff_matches").update({
      draft_id: draft.id,
      status: "in_progress",
    }).eq("id", matchId);

    // Mark in season entries (sequential after regular drafts)
    const { data: maxEntry } = await supabase
      .from("draft_season_entries").select("week_number")
      .eq("season_id", seasonId).order("week_number", { ascending: false }).limit(1);
    const nextNum = (maxEntry?.[0]?.week_number || 0) + 1;
    await supabase.from("draft_season_entries").insert({
      season_id: seasonId,
      draft_id: draft.id,
      week_number: nextNum,
      is_playoff: true,
    });

    return new Response(JSON.stringify({ draftId: draft.id, topic, category }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-playoff-draft error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
