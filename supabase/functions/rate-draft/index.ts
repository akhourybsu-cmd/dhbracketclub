import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claims.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.user.id;

    const { draft_id } = await req.json();
    if (!draft_id) {
      return new Response(JSON.stringify({ error: "draft_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service role for data operations
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch draft
    const { data: draft, error: draftErr } = await admin
      .from("drafts")
      .select("*, profiles:created_by(display_name)")
      .eq("id", draft_id)
      .single();

    if (draftErr || !draft) {
      return new Response(JSON.stringify({ error: "Draft not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (draft.status !== "complete") {
      return new Response(JSON.stringify({ error: "Draft is not complete" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch participants and picks
    const [{ data: participants }, { data: picks }] = await Promise.all([
      admin.from("draft_participants").select("*, profiles:user_id(display_name)").eq("draft_id", draft_id).order("pick_order"),
      admin.from("draft_picks").select("*").eq("draft_id", draft_id).order("pick_number"),
    ]);

    if (!participants?.length || !picks?.length) {
      return new Response(JSON.stringify({ error: "No participants or picks found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Any participant or the creator can trigger report generation
    const isParticipant = participants.some((p: any) => p.user_id === userId);
    if (draft.created_by !== userId && !isParticipant) {
      return new Response(JSON.stringify({ error: "Only draft participants can generate the report" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build prompt
    const participantMap = new Map(participants.map((p: any) => [p.user_id, p.profiles?.display_name || "Unknown"]));

    const picksByUser: Record<string, { pick_id: string; pick_text: string; round: number }[]> = {};
    for (const pick of picks) {
      if (!picksByUser[pick.user_id]) picksByUser[pick.user_id] = [];
      picksByUser[pick.user_id].push({
        pick_id: pick.id,
        pick_text: pick.pick_text,
        round: pick.round,
      });
    }

    const participantSummaries = Object.entries(picksByUser).map(([uid, userPicks]) => {
      const name = participantMap.get(uid) || "Unknown";
      const pickList = userPicks.map((p) => `  Round ${p.round}: "${p.pick_text}" (pick_id: ${p.pick_id})`).join("\n");
      return `Participant: ${name} (user_id: ${uid})\n${pickList}`;
    }).join("\n\n");

    const prompt = `You are an expert strategic draft analyst for DH Bracket Club. The draft topic is: "${draft.topic}"${draft.category ? ` (Category: ${draft.category})` : ""}.

This was a snake-style draft. Evaluate every pick using the following CORE EVALUATION FRAMEWORK. Adapt your reasoning to the specific category while applying the same consistent logic.

=== EVALUATION FACTORS (apply all 8 to every pick) ===

1. CATEGORY FIT — Does the pick clearly belong in this category? Weak fit hurts; clear fit supports.
2. STANDALONE STRENGTH — How strong is this pick on its own within the category? Consider recognition, impact, quality, memorability, and respect within the topic.
3. DRAFT TIMING / SLOT VALUE — Was this pick taken at the right time? A strong item taken too early is penalized. A mid-tier item taken late at good value can be praised. Consider what round/slot it was drafted in.
4. SCARCITY / REPLACEABILITY — Is this pick hard to replace later, or are many similar alternatives available? Scarce, hard-to-replace picks get a boost.
5. BOARD SYNERGY — Does this pick complement the drafter's other selections? Does it add balance, variety, identity, or cohesion? Redundant picks are downgraded.
6. UPSIDE vs SAFETY — Is this a reliable consensus pick or a risky swing? Safe picks are rewarded for reliability. Risky picks are only rewarded if there's a clear upside argument; otherwise penalized.
7. DISTINCTIVENESS — Does this pick help the drafter stand out in a smart, defensible way? Distinctiveness is a bonus, not a replacement for quality. Do not reward randomness.
8. ALTERNATIVE COST — Were there clearly stronger or more efficient options likely available at that slot? If better options were obviously available with no board-based justification, downgrade. If the pick makes strategic sense for the board, it can still be judged well.

=== GOOD PICK ===
A pick is strong if most of: clear category fit, strong standalone quality, good timing, meaningful scarcity/value, good board synergy, clear strategic purpose, easy to defend in 1-2 sentences.

=== WEAK PICK ===
A pick is weak if one or more of: questionable category fit, low standalone quality, taken too early, easily replaceable, redundant, clearly weaker than likely alternatives, risky without upside, hard to justify strategically.

=== BEST PICK (per person) ===
Do NOT simply pick the most famous item. Identify the pick that best combines: quality + timing + value at slot + board impact + strategic fit. It should feel like the smartest or most valuable selection that person made.

=== WORST PICK (per person) ===
Do NOT simply pick the least famous item. Identify the pick that most combines: weak value for slot + weak category fit + low board impact + low scarcity + poor comparison to likely alternatives. It should feel like the least efficient or least helpful choice on that person's board.

=== FEEDBACK STYLE ===
For each pick's explanation, address:
1. What the pick does well
2. Whether the timing was good, early, late, or mixed
3. How it fits the drafter's overall board
4. Any weakness, risk, or limitation

Be strategic, specific, consistent, readable, and confident but not overly harsh. Avoid vague generic praise, random unexplained criticism, over-rewarding popularity alone, over-penalizing niche picks that are strategically sound, and contradicting yourself across similar picks.

=== SCORING ===
Rate each pick on a scale of 1-10. Then rank all participants from best to worst based on their total scores.

=== SUMMARY (per person) ===
Write a 2-3 sentence summary of each participant's draft performance. Mention their best pick, worst pick, overall board identity, and strategic approach.

Here are all participants and their picks:

${participantSummaries}

Use the rate_draft_results tool to return your structured analysis.`;

    // Call AI with tool calling
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a fair and insightful draft competition judge. Provide honest, entertaining, and constructive ratings." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rate_draft_results",
              description: "Return structured draft ratings for all participants",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        user_id: { type: "string", description: "The participant's user_id" },
                        rank: { type: "integer", description: "Rank position (1 = best)" },
                        total_score: { type: "number", description: "Sum of all pick scores" },
                        summary: { type: "string", description: "2-3 sentence summary of this participant's draft performance" },
                        pick_ratings: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              pick_id: { type: "string" },
                              pick_text: { type: "string" },
                              score: { type: "number", description: "Score from 1.0 to 10.0" },
                              explanation: { type: "string", description: "Brief explanation for the score" },
                            },
                            required: ["pick_id", "pick_text", "score", "explanation"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["user_id", "rank", "total_score", "summary", "pick_ratings"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["results"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "rate_draft_results" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "AI returned unexpected format" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { results } = JSON.parse(toolCall.function.arguments);
    if (!Array.isArray(results) || results.length === 0) {
      return new Response(JSON.stringify({ error: "AI returned empty results" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calculate points: 1st = N, 2nd = N-1, etc.
    const numParticipants = participants.length;
    const sortedResults = [...results].sort((a: any, b: any) => a.rank - b.rank);

    // Delete existing results for regeneration
    await admin.from("draft_results").delete().eq("draft_id", draft_id);

    // Insert results
    const inserts = sortedResults.map((r: any) => ({
      draft_id,
      user_id: r.user_id,
      rank: r.rank,
      total_score: r.total_score,
      pick_ratings: r.pick_ratings,
      summary: r.summary,
      points_awarded: Math.max(1, numParticipants - r.rank + 1),
    }));

    const { error: insertErr } = await admin.from("draft_results").insert(inserts);
    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to save results" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ results: inserts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rate-draft error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
