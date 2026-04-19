// Returns 3 fresh AI-generated draft topic options for a playoff matchup.
// Filters against prior season topics + already-used playoff topics for variety.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Pull all topics already used in this season (regular + playoffs) to avoid repeats
    const { data: entries } = await supabase
      .from("draft_season_entries")
      .select("drafts:draft_id(topic)")
      .eq("season_id", seasonId);
    const usedTopics = (entries || [])
      .map((e: any) => e.drafts?.topic)
      .filter(Boolean) as string[];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Generate 3 fresh, fun, creative DRAFT topics for a head-to-head pick'em matchup between two friends. Each topic should be a "Top 5" style list where players draft picks one at a time.

Topics should be:
- Universally fun and debatable (movies, music, food, sports, pop culture, life experiences, etc.)
- Specific enough to draft 5 distinct items
- NOT serious or work-related
- Varied across categories

DO NOT use any of these already-used topics:
${usedTopics.map(t => `- ${t}`).join("\n") || "(none yet)"}

Return ONLY a JSON object: { "topics": ["topic 1", "topic 2", "topic 3"] }
No prose, no markdown, just the JSON.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You generate fun draft topics. Reply ONLY with valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI request failed");
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    let parsed: { topics?: string[] };
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 3) : [];

    if (topics.length < 3) {
      // Fallback if AI returned malformed
      const fallback = ["Top 5 Movies of All Time", "Top 5 Pizza Toppings", "Top 5 Vacation Destinations"];
      while (topics.length < 3) topics.push(fallback[topics.length]);
    }

    return new Response(JSON.stringify({ topics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-playoff-topics error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
