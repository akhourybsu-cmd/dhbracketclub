import { DraftResult } from '@/hooks/useDraftResults';

interface Pick {
  id: string;
  user_id: string;
  pick_text: string;
  pick_number: number;
  round: number;
  picked_at?: string;
  profiles?: { display_name: string };
}

interface PickRating {
  pick_id: string;
  pick_text: string;
  score: number;
  explanation: string;
}

interface Participant {
  user_id: string;
  profiles?: { display_name: string };
}

// ─── Timing Stats ───────────────────────────────────────────

export function computePickTimings(picks: Pick[]) {
  if (picks.length < 2) return null;

  const sorted = [...picks].sort((a, b) => a.pick_number - b.pick_number);
  const deltas: { userId: string; pickText: string; deltaMs: number; pickNumber: number }[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev.picked_at || !curr.picked_at) continue;
    const deltaMs = new Date(curr.picked_at).getTime() - new Date(prev.picked_at).getTime();
    if (deltaMs > 0 && deltaMs < 24 * 60 * 60 * 1000) { // ignore >24h gaps
      deltas.push({ userId: curr.user_id, pickText: curr.pick_text, deltaMs, pickNumber: curr.pick_number });
    }
  }

  if (deltas.length === 0) return null;

  const fastest = deltas.reduce((a, b) => a.deltaMs < b.deltaMs ? a : b);
  const slowest = deltas.reduce((a, b) => a.deltaMs > b.deltaMs ? a : b);

  // Per-user average
  const userTimes = new Map<string, number[]>();
  deltas.forEach(d => {
    const arr = userTimes.get(d.userId) || [];
    arr.push(d.deltaMs);
    userTimes.set(d.userId, arr);
  });

  const userAvgs = new Map<string, number>();
  userTimes.forEach((times, uid) => {
    userAvgs.set(uid, times.reduce((a, b) => a + b, 0) / times.length);
  });

  // Total duration
  const firstPick = sorted.find(p => p.picked_at);
  const lastPick = [...sorted].reverse().find(p => p.picked_at);
  const totalDurationMs = firstPick?.picked_at && lastPick?.picked_at
    ? new Date(lastPick.picked_at).getTime() - new Date(firstPick.picked_at).getTime()
    : null;

  return { fastest, slowest, userAvgs, totalDurationMs };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

// ─── Score Stats ────────────────────────────────────────────

export function findMvpPick(results: DraftResult[]): { pickText: string; score: number; userId: string } | null {
  let best: { pickText: string; score: number; userId: string } | null = null;
  for (const r of results) {
    const ratings = (r.pick_ratings || []) as PickRating[];
    for (const pr of ratings) {
      if (!best || pr.score > best.score) {
        best = { pickText: pr.pick_text, score: pr.score, userId: r.user_id };
      }
    }
  }
  return best;
}

export function findBiggestSteal(results: DraftResult[], picks: Pick[]): { pickText: string; score: number; round: number; userId: string } | null {
  // Find the highest-scored pick from the latest rounds
  let best: { pickText: string; score: number; round: number; userId: string } | null = null;
  const maxRound = Math.max(...picks.map(p => p.round), 1);
  const lateRoundThreshold = Math.ceil(maxRound * 0.5); // second half of draft

  for (const r of results) {
    const ratings = (r.pick_ratings || []) as PickRating[];
    for (const pr of ratings) {
      const pick = picks.find(p => p.id === pr.pick_id);
      if (!pick || pick.round < lateRoundThreshold) continue;
      if (!best || pr.score > best.score || (pr.score === best.score && pick.round > best.round)) {
        best = { pickText: pr.pick_text, score: pr.score, round: pick.round, userId: r.user_id };
      }
    }
  }
  return best;
}

export function findMostConsistent(results: DraftResult[]): { userId: string; stdDev: number } | null {
  let best: { userId: string; stdDev: number } | null = null;
  for (const r of results) {
    const ratings = (r.pick_ratings || []) as PickRating[];
    if (ratings.length < 2) continue;
    const scores = ratings.map(pr => pr.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    if (!best || stdDev < best.stdDev) {
      best = { userId: r.user_id, stdDev };
    }
  }
  return best;
}

// ─── Streak Detection ───────────────────────────────────────

export function findScoringStreaks(results: DraftResult[], picks: Pick[], threshold = 7.5): Map<string, number> {
  // Returns userId → longest streak of consecutive picks with score >= threshold
  const streaks = new Map<string, number>();

  for (const r of results) {
    const ratings = (r.pick_ratings || []) as PickRating[];
    // Order ratings by pick_number
    const userPicks = picks.filter(p => p.user_id === r.user_id).sort((a, b) => a.pick_number - b.pick_number);
    const ratingMap = new Map(ratings.map(pr => [pr.pick_id, pr.score]));

    let currentStreak = 0;
    let maxStreak = 0;
    for (const pick of userPicks) {
      const score = ratingMap.get(pick.id);
      if (score !== undefined && score >= threshold) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    if (maxStreak >= 3) {
      streaks.set(r.user_id, maxStreak);
    }
  }
  return streaks;
}

// ─── Aggregated User Stats for DraftsListPage ───────────────

export function computeAggregateStats(allResults: any[], userId: string) {
  const myResults = allResults.filter((r: any) => r.user_id === userId);
  if (myResults.length === 0) return null;

  const totalPoints = myResults.reduce((s: number, r: any) => s + (r.points_awarded || 0), 0);
  const wins = myResults.filter((r: any) => r.rank === 1).length;
  const podiums = myResults.filter((r: any) => r.rank <= 3).length;
  const bestFinish = Math.min(...myResults.map((r: any) => r.rank));
  const avgScore = myResults.reduce((s: number, r: any) => s + (r.total_score || 0), 0) / myResults.length;

  return {
    totalPoints,
    wins,
    draftsRated: myResults.length,
    podiums,
    bestFinish,
    avgScore,
  };
}

export function getDisplayName(userId: string, participants: Participant[]): string {
  return participants.find(p => p.user_id === userId)?.profiles?.display_name || 'Unknown';
}
