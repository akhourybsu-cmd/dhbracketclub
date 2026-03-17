// Bracket tree traversal and scoring utilities

export interface Team {
  id: string;
  school_name: string;
  short_name: string;
  seed: number;
  region: string;
  play_in_group?: number | null;
}

export interface Game {
  id: string;
  tournament_id: string;
  round_number: number;
  round_name: string;
  region: string;
  game_slot: number;
  team1_id: string | null;
  team2_id: string | null;
  winner_team_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  status: string | null;
  scheduled_at?: string | null;
  live_clock?: string | null;
  live_period?: string | null;
  source_last_updated_at?: string | null;
  is_result_final?: boolean;
}

export interface Pick {
  game_id: string;
  picked_team_id: string;
  picked_in_round: number;
}

export const ROUND_NAMES = [
  'Round of 64',
  'Round of 32',
  'Sweet 16',
  'Elite 8',
  'Final Four',
  'Championship',
];

export const ROUND_SHORT = ['R64', 'R32', 'S16', 'E8', 'F4', 'Champ'];

/** First Four play-in round (round_number = 0) */
export const FIRST_FOUR_ROUND_NAME = 'First Four';
export const FIRST_FOUR_ROUND_SHORT = 'FF';

export const TOTAL_GAMES = 63; // Main bracket games (excludes First Four)
export const FIRST_FOUR_GAMES = 4;

/**
 * Get all round names including First Four.
 */
export const ALL_ROUND_NAMES = [FIRST_FOUR_ROUND_NAME, ...ROUND_NAMES];
export const ALL_ROUND_SHORT = [FIRST_FOUR_ROUND_SHORT, ...ROUND_SHORT];

export const DEFAULT_SCORING: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 16,
  6: 32,
};

/**
 * Given a game in a later round, determine which team fills a slot
 * based on picks from feeder games.
 * For Round of 64 games with a First Four feeder, the feeder game
 * has round_number=0 and a matching feeder_game_slot.
 */
export function getEffectiveTeam(
  game: Game,
  slot: 'team1' | 'team2',
  games: Game[],
  teams: Map<string, Team>,
  picks: Map<string, Pick>
): Team | null {
  const teamId = slot === 'team1' ? game.team1_id : game.team2_id;
  if (teamId) return teams.get(teamId) || null;

  // For Round of 64, check if there's a First Four feeder game
  if (game.round_number === 1) {
    // First Four feeders are round 0 games whose game_slot matches this game's slot
    const feederGame = games.find(
      g => g.round_number === 0 && g.region === game.region
    );
    if (feederGame) {
      // Check if the actual game result is in
      if (feederGame.winner_team_id) {
        return teams.get(feederGame.winner_team_id) || null;
      }
      // Otherwise check if user has a pick for the First Four game
      const pick = picks.get(feederGame.id);
      if (pick) return teams.get(pick.picked_team_id) || null;
    }
    return null;
  }

  if (game.round_number <= 0) return null;

  const prevRoundGames = games.filter(g => g.round_number === game.round_number - 1);
  const feederSlot = slot === 'team1' ? game.game_slot * 2 - 1 : game.game_slot * 2;
  const feederGame = prevRoundGames.find(g => g.game_slot === feederSlot);

  if (feederGame) {
    const pick = picks.get(feederGame.id);
    if (pick) return teams.get(pick.picked_team_id) || null;
  }
  return null;
}

/**
 * After setting a pick, clear any downstream picks that are now invalid.
 * Returns a new picks map.
 */
export function handlePickWithCascade(
  gameId: string,
  teamId: string,
  round: number,
  games: Game[],
  teams: Map<string, Team>,
  currentPicks: Map<string, Pick>
): Map<string, Pick> {
  const newPicks = new Map(currentPicks);
  newPicks.set(gameId, { game_id: gameId, picked_team_id: teamId, picked_in_round: round });

  const currentGame = games.find(g => g.id === gameId);
  if (!currentGame) return newPicks;

  const clearDownstream = (fromRound: number, fromSlot: number) => {
    const nextRound = fromRound + 1;
    const nextSlot = Math.ceil(fromSlot / 2);
    const nextGame = games.find(g => g.round_number === nextRound && g.game_slot === nextSlot);

    if (!nextGame) return;

    const existingPick = newPicks.get(nextGame.id);
    if (existingPick) {
      const t1 = getEffectiveTeam(nextGame, 'team1', games, teams, newPicks);
      const t2 = getEffectiveTeam(nextGame, 'team2', games, teams, newPicks);
      if (existingPick.picked_team_id !== t1?.id && existingPick.picked_team_id !== t2?.id) {
        newPicks.delete(nextGame.id);
        clearDownstream(nextRound, nextSlot);
      }
    }
  };

  clearDownstream(currentGame.round_number, currentGame.game_slot);
  return newPicks;
}

/**
 * Calculate scoring for a single bracket.
 */
export function calculateBracketScore(
  picks: Pick[],
  games: Game[],
  scoringRules: Record<number, number>
): { totalPoints: number; correctPicks: number; possiblePointsRemaining: number } {
  const decidedGames = new Map<string, Game>();
  const undecidedGames = new Map<string, Game>();

  games.forEach(g => {
    if (g.winner_team_id) {
      decidedGames.set(g.id, g);
    } else {
      undecidedGames.set(g.id, g);
    }
  });

  let totalPoints = 0;
  let correctPicks = 0;
  let possiblePointsRemaining = 0;

  picks.forEach(pick => {
    const decidedGame = decidedGames.get(pick.game_id);
    const pts = scoringRules[pick.picked_in_round] || 0;

    if (decidedGame) {
      if (decidedGame.winner_team_id === pick.picked_team_id) {
        correctPicks++;
        totalPoints += pts;
      }
      // If decided and wrong, no possible points
    } else {
      // Undecided game — check if the picked team is still alive
      const isEliminated = isTeamEliminated(pick.picked_team_id, games);
      if (!isEliminated) {
        possiblePointsRemaining += pts;
      }
    }
  });

  return { totalPoints, correctPicks, possiblePointsRemaining };
}

/**
 * Check if a team has been eliminated (lost a decided game).
 */
function isTeamEliminated(teamId: string, games: Game[]): boolean {
  return games.some(
    g =>
      g.winner_team_id !== null &&
      g.winner_team_id !== teamId &&
      (g.team1_id === teamId || g.team2_id === teamId)
  );
}

/**
 * Get the champion pick (round 6 pick) from a set of picks.
 */
export function getChampionPick(
  picks: Pick[],
  teams: Map<string, Team>
): Team | null {
  const champPick = picks.find(p => p.picked_in_round === 6);
  if (!champPick) return null;
  return teams.get(champPick.picked_team_id) || null;
}

/**
 * Determine effective bracket status considering lock time.
 */
export function getBracketDisplayStatus(
  bracketStatus: string | null,
  poolLockTime: string,
  picksCount: number,
  totalGames: number = TOTAL_GAMES
): 'draft' | 'submitted' | 'locked' | 'incomplete' | 'none' {
  if (!bracketStatus) return 'none';

  const isLocked = new Date(poolLockTime) <= new Date();

  if (!isLocked) {
    return bracketStatus === 'submitted' ? 'submitted' : 'draft';
  }

  // After lock
  if (bracketStatus === 'submitted') return 'locked';
  if (picksCount >= totalGames) return 'locked'; // Draft but complete
  return 'incomplete';
}

export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  none: { label: 'Not Started', className: 'bg-secondary text-secondary-foreground' },
  draft: { label: 'Draft', className: 'bg-warning/15 text-warning' },
  submitted: { label: 'Submitted', className: 'bg-success/15 text-success' },
  locked: { label: 'Locked', className: 'bg-primary/15 text-primary' },
  incomplete: { label: 'Incomplete', className: 'bg-destructive/15 text-destructive' },
};
