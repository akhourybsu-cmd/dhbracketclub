// Nexus Defense — battle persistence
//
// Saves the live BattleState to localStorage so a player can close the tab,
// background the PWA, or accidentally navigate away mid-mission and pick up
// exactly where they left off. Pairs with the auto-pause-on-hidden behaviour
// in NexusBattlePage so the engine never advances unattended.
//
// We persist by (userId, missionId) so each player keeps one in-flight run
// per mission. Endless and campaign runs each get their own slot because
// they use different mission IDs.

import type { BattleState } from './types';

const STORAGE_PREFIX = 'nexus_run_state_v1';
/** Throttle window for incremental saves during play. */
export const SAVE_THROTTLE_MS = 1500;
/** Drop saves older than this on resume — stale state is more confusing than useful. */
const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

export interface PersistedRun {
  savedAt: number;
  missionId: number;
  abilities: string[];
  state: BattleState;
}

function key(userId: string | null | undefined, missionId: number): string {
  return `${STORAGE_PREFIX}:${userId ?? 'anon'}:${missionId}`;
}

export function saveBattle(
  userId: string | null | undefined,
  missionId: number,
  abilities: string[],
  state: BattleState,
): void {
  // Don't checkpoint terminal states — those go through the normal end-of-run flow.
  if (state.status === 'victory' || state.status === 'defeat') return;
  try {
    const payload: PersistedRun = {
      savedAt: Date.now(),
      missionId,
      abilities,
      state,
    };
    localStorage.setItem(key(userId, missionId), JSON.stringify(payload));
  } catch {
    // Quota or private-mode failures are non-fatal.
  }
}

export function loadBattle(
  userId: string | null | undefined,
  missionId: number,
): PersistedRun | null {
  try {
    const raw = localStorage.getItem(key(userId, missionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRun;
    if (!parsed?.state || parsed.missionId !== missionId) return null;
    if (Date.now() - parsed.savedAt > STALE_AFTER_MS) {
      localStorage.removeItem(key(userId, missionId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearBattle(
  userId: string | null | undefined,
  missionId: number,
): void {
  try { localStorage.removeItem(key(userId, missionId)); } catch { }
}
