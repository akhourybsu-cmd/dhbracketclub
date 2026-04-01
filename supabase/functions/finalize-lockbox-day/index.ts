import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Scoring constants (mirrored from lockboxScoring.ts)
const BASE_CRACK_POINTS = 6;
const BEST_CRACK_BONUS = 2;
const UNCRACKED_DEFENSE_POINTS = 8;

function getEfficiencyBonus(totalAttempts: number): number {
  if (totalAttempts <= 5) return 4;
  if (totalAttempts <= 7) return 3;
  if (totalAttempts <= 9) return 2;
  if (totalAttempts <= 11) return 1;
  return 0;
}

function getDefensePoints(isCracked: boolean, bestCrackAttempts: number | null): number {
  if (!isCracked) return UNCRACKED_DEFENSE_POINTS;
  if (bestCrackAttempts === null) return 0;
  if (bestCrackAttempts >= 10) return 3;
  if (bestCrackAttempts >= 8) return 2;
  if (bestCrackAttempts >= 6) return 1;
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find all active days whose ends_at has passed
    const now = new Date().toISOString();
    const { data: staleDays, error: daysErr } = await supabase
      .from("lockbox_weeks")
      .select("*")
      .eq("status", "active")
      .lt("ends_at", now);

    if (daysErr) throw daysErr;
    if (!staleDays || staleDays.length === 0) {
      return new Response(JSON.stringify({ message: "No days to finalize" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const day of staleDays) {
      // Get all locks for this day
      const { data: locks } = await supabase
        .from("lockbox_locks")
        .select("*")
        .eq("week_id", day.id);

      if (!locks || locks.length === 0) {
        // Mark day complete even if no locks
        await supabase.from("lockbox_weeks").update({ status: "complete" }).eq("id", day.id);
        results.push({ dayId: day.id, weekNumber: day.week_number, players: 0 });
        continue;
      }

      const lockIds = locks.map((l: any) => l.id);

      // Get all solved attempts for these locks
      const { data: attempts } = await supabase
        .from("lockbox_attempts")
        .select("*")
        .in("lock_id", lockIds);

      const allAttempts = attempts || [];

      // Build player scores
      const players = new Map<string, {
        crackPts: number; defensePts: number;
        locksCracked: number; totalAttempts: number; solves: number;
      }>();

      const ensurePlayer = (id: string) => {
        if (!players.has(id)) {
          players.set(id, { crackPts: 0, defensePts: 0, locksCracked: 0, totalAttempts: 0, solves: 0 });
        }
        return players.get(id)!;
      };

      // Defense points for lock owners
      for (const lock of locks) {
        ensurePlayer(lock.user_id);
        const lockSolves = allAttempts.filter((a: any) => a.lock_id === lock.id && a.is_solved);
        const bestCrackAttempts = lockSolves.length > 0
          ? Math.min(...lockSolves.map((a: any) => a.total_attempts))
          : null;
        players.get(lock.user_id)!.defensePts += getDefensePoints(lock.is_cracked, bestCrackAttempts);
      }

      // Crack points for attackers
      for (const lock of locks) {
        const lockSolves = allAttempts.filter((a: any) => a.lock_id === lock.id && a.is_solved);

        for (const a of lockSolves) {
          const p = ensurePlayer(a.attacker_id);
          p.crackPts += BASE_CRACK_POINTS + getEfficiencyBonus(a.total_attempts);
          p.locksCracked++;
          p.totalAttempts += a.total_attempts;
          p.solves++;
        }

        // Best crack bonus
        if (lockSolves.length > 0) {
          const sorted = [...lockSolves].sort((a: any, b: any) => {
            if (a.total_attempts !== b.total_attempts) return a.total_attempts - b.total_attempts;
            const aDur = new Date(a.solved_at).getTime() - new Date(a.started_at).getTime();
            const bDur = new Date(b.solved_at).getTime() - new Date(b.started_at).getTime();
            if (aDur !== bDur) return aDur - bDur;
            return new Date(a.solved_at).getTime() - new Date(b.solved_at).getTime();
          });
          const p = players.get(sorted[0].attacker_id);
          if (p) p.crackPts += BEST_CRACK_BONUS;
        }
      }

      // Rank players
      const ranked = Array.from(players.entries())
        .map(([userId, p]) => ({
          userId,
          totalPts: p.crackPts + p.defensePts,
          crackPts: p.crackPts,
          defensePts: p.defensePts,
          locksCracked: p.locksCracked,
          avgAttempts: p.solves > 0 ? p.totalAttempts / p.solves : 999,
        }))
        .sort((a, b) => {
          if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
          if (b.locksCracked !== a.locksCracked) return b.locksCracked - a.locksCracked;
          return a.avgAttempts - b.avgAttempts;
        });

      // Upsert scores
      const upsertRows = ranked.map((p, idx) => ({
        user_id: p.userId,
        week_id: day.id,
        crack_points: p.crackPts,
        defense_points: p.defensePts,
        total_points: p.totalPts,
        rank: idx + 1,
      }));

      if (upsertRows.length > 0) {
        // Delete existing scores for this day first, then insert
        await supabase.from("lockbox_scores").delete().eq("week_id", day.id);
        const { error: insertErr } = await supabase.from("lockbox_scores").insert(upsertRows);
        if (insertErr) {
          console.error("Error inserting scores:", insertErr);
        }
      }

      // Mark day as complete
      await supabase.from("lockbox_weeks").update({ status: "complete" }).eq("id", day.id);

      results.push({ dayId: day.id, weekNumber: day.week_number, players: ranked.length });
    }

    return new Response(JSON.stringify({ finalized: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("finalize-lockbox-day error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
