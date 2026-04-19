// Advance a season's playoffs: trigger transition, set winners, generate next round.
// Idempotent — safe to call repeatedly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateMatchDraft(supabase: any, seasonId: string, matchId: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-playoff-draft`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ seasonId, matchId }),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("generate-playoff-draft failed", r.status, t);
  }
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { seasonId } = await req.json();
    if (!seasonId) {
      return new Response(JSON.stringify({ error: "seasonId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: season, error: sErr } = await supabase
      .from("draft_seasons").select("*").eq("id", seasonId).single();
    if (sErr || !season) throw new Error("season not found");

    const log: string[] = [];

    // ─── PHASE 1: REGULAR → PLAYOFFS TRANSITION ───
    if (season.status === "regular_season") {
      const totalRegular = season.regular_season_drafts || season.regular_season_weeks || 12;
      const { data: regEntries } = await supabase
        .from("draft_season_entries")
        .select("draft_id, drafts:draft_id(status)")
        .eq("season_id", seasonId).eq("is_playoff", false);

      const completedCount = (regEntries || []).filter((e: any) => e.drafts?.status === "complete").length;

      if (completedCount >= totalRegular) {
        // Get top 5 from standings
        const { data: standings } = await supabase
          .from("draft_season_standings").select("*")
          .eq("season_id", seasonId)
          .order("season_points", { ascending: false })
          .order("wins", { ascending: false })
          .order("podiums", { ascending: false })
          .order("avg_finish", { ascending: true })
          .order("avg_score", { ascending: false })
          .limit(5);

        if (!standings || standings.length < 2) {
          return new Response(JSON.stringify({ status: "waiting", reason: "not enough qualifiers" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Assign seeds 1–5
        for (let i = 0; i < standings.length; i++) {
          await supabase.from("draft_season_standings")
            .update({ playoff_seed: i + 1, rank: i + 1 })
            .eq("id", standings[i].id);
        }

        await supabase.from("draft_seasons").update({ status: "playoffs" }).eq("id", seasonId);
        log.push("transitioned to playoffs");

        // Create QF (#4 vs #5) if needed
        const { data: existingQF } = await supabase
          .from("draft_playoff_matches").select("*")
          .eq("season_id", seasonId).eq("round", "qf");

        if (!existingQF || existingQF.length === 0) {
          const seed4 = standings[3];
          const seed5 = standings[4];
          if (seed4 && seed5) {
            const { data: newMatch } = await supabase.from("draft_playoff_matches").insert({
              season_id: seasonId,
              round: "qf",
              match_number: 1,
              seed_a: 4,
              seed_b: 5,
              user_a: seed4.user_id,
              user_b: seed5.user_id,
              status: "pending",
            }).select().single();
            if (newMatch) await generateMatchDraft(supabase, seasonId, newMatch.id);
            log.push("created QF");
          }
        }
      } else {
        return new Response(JSON.stringify({ status: "waiting", completed: completedCount, target: totalRegular }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── PHASE 2: SCORE COMPLETED MATCHES + ADVANCE ───
    const { data: matches } = await supabase
      .from("draft_playoff_matches").select("*")
      .eq("season_id", seasonId)
      .order("round").order("match_number");

    if (!matches) {
      return new Response(JSON.stringify({ status: "ok", log }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Score any complete matches missing winner
    for (const m of matches) {
      if (m.draft_id && m.status !== "complete") {
        const { data: draftRow } = await supabase
          .from("drafts").select("status").eq("id", m.draft_id).single();
        if (draftRow?.status === "complete") {
          const { data: results } = await supabase
            .from("draft_results").select("user_id, total_score")
            .eq("draft_id", m.draft_id);
          if (results && results.length > 0) {
            const sorted = [...results].sort((a: any, b: any) => Number(b.total_score) - Number(a.total_score));
            const winner = sorted[0].user_id;
            await supabase.from("draft_playoff_matches").update({
              winner_user_id: winner,
              status: "complete",
            }).eq("id", m.id);
            m.winner_user_id = winner;
            m.status = "complete";
            log.push(`scored ${m.round} M${m.match_number}, winner ${winner}`);
          }
        }
      }
    }

    // Refresh standings
    const { data: top5 } = await supabase
      .from("draft_season_standings").select("*")
      .eq("season_id", seasonId)
      .not("playoff_seed", "is", null)
      .order("playoff_seed");

    const seedUser = (n: number) => top5?.find((s: any) => s.playoff_seed === n)?.user_id;

    const qfMatches = matches.filter((m: any) => m.round === "qf");
    const sfMatches = matches.filter((m: any) => m.round === "sf");
    const finalMatches = matches.filter((m: any) => m.round === "final");

    const qfDone = qfMatches.length > 0 && qfMatches.every((m: any) => m.status === "complete");
    const sfDone = sfMatches.length === 2 && sfMatches.every((m: any) => m.status === "complete");
    const finalDone = finalMatches.length === 1 && finalMatches[0].status === "complete";

    // Generate Semis once QF complete
    if (qfDone && sfMatches.length === 0) {
      const qfWinner = qfMatches[0].winner_user_id;
      const qfWinnerSeed = qfWinner === qfMatches[0].user_a ? qfMatches[0].seed_a : qfMatches[0].seed_b;
      const seed1 = seedUser(1);
      const seed2 = seedUser(2);
      const seed3 = seedUser(3);

      if (seed1 && seed2 && seed3 && qfWinner) {
        const { data: sf1 } = await supabase.from("draft_playoff_matches").insert({
          season_id: seasonId, round: "sf", match_number: 1,
          seed_a: 1, seed_b: qfWinnerSeed, user_a: seed1, user_b: qfWinner,
          status: "pending",
        }).select().single();
        const { data: sf2 } = await supabase.from("draft_playoff_matches").insert({
          season_id: seasonId, round: "sf", match_number: 2,
          seed_a: 2, seed_b: 3, user_a: seed2, user_b: seed3,
          status: "pending",
        }).select().single();
        if (sf1) await generateMatchDraft(supabase, seasonId, sf1.id);
        if (sf2) await generateMatchDraft(supabase, seasonId, sf2.id);
        log.push("created SFs");
      }
    }

    // Generate Final once both SFs complete
    if (sfDone && finalMatches.length === 0) {
      const sf1 = sfMatches.find((m: any) => m.match_number === 1);
      const sf2 = sfMatches.find((m: any) => m.match_number === 2);
      if (sf1?.winner_user_id && sf2?.winner_user_id) {
        const sf1WinnerSeed = sf1.winner_user_id === sf1.user_a ? sf1.seed_a : sf1.seed_b;
        const sf2WinnerSeed = sf2.winner_user_id === sf2.user_a ? sf2.seed_a : sf2.seed_b;
        const { data: fin } = await supabase.from("draft_playoff_matches").insert({
          season_id: seasonId, round: "final", match_number: 1,
          seed_a: sf1WinnerSeed, seed_b: sf2WinnerSeed,
          user_a: sf1.winner_user_id, user_b: sf2.winner_user_id,
          status: "pending",
        }).select().single();
        if (fin) await generateMatchDraft(supabase, seasonId, fin.id);
        log.push("created Final");
      }
    }

    // Mark season complete
    if (finalDone && season.status !== "complete") {
      await supabase.from("draft_seasons").update({ status: "complete" }).eq("id", seasonId);
      log.push("season complete");
    }

    return new Response(JSON.stringify({ status: "ok", log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("advance-playoffs error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
