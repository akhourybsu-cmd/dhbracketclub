// DH Club — Onboarding status persistence
//
// Tracks what each user has seen, per club, per feature, per version. The
// primary store is localStorage so the framework works out of the box with
// no DB migration. If/when `user_feature_onboarding_status` is created in
// Supabase, the same record shape can be synced through with no API change
// to consumers.
//
// Storage shape (one key per (user, club)):
//   dh_onboarding_v1:{userId}:{clubId} → {
//     introStatus: 'not_started' | 'seen' | 'completed' | 'dismissed' | 'remind_later',
//     introCompletedAt?: ISO,
//     features: {
//       [featureKey]: {
//         version: number,
//         status: Status,
//         firstSeenAt?: ISO,
//         completedAt?: ISO,
//         dismissedAt?: ISO,
//         remindLaterAt?: ISO,
//       }
//     }
//   }

import type { OnboardingType } from './registry';

export type OnboardingStatus =
  | 'not_started'
  | 'seen'
  | 'completed'
  | 'dismissed'
  | 'remind_later';

export interface FeatureStatusRow {
  version: number;
  status: OnboardingStatus;
  firstSeenAt?: string;
  completedAt?: string;
  dismissedAt?: string;
  remindLaterAt?: string;
}

export interface ClubOnboardingRecord {
  introStatus: OnboardingStatus;
  introCompletedAt?: string;
  introDismissedAt?: string;
  features: Record<string, FeatureStatusRow>;
}

const PREFIX = 'dh_onboarding_v1';
const REMIND_AFTER_MS = 1000 * 60 * 60 * 24; // 1 day

function key(userId: string, clubId: string): string {
  return `${PREFIX}:${userId}:${clubId}`;
}

function emptyRecord(): ClubOnboardingRecord {
  return { introStatus: 'not_started', features: {} };
}

export function readRecord(userId: string | undefined, clubId: string | undefined | null): ClubOnboardingRecord {
  if (!userId || !clubId || typeof window === 'undefined') return emptyRecord();
  try {
    const raw = window.localStorage.getItem(key(userId, clubId));
    if (!raw) return emptyRecord();
    const parsed = JSON.parse(raw) as Partial<ClubOnboardingRecord>;
    return {
      introStatus: parsed.introStatus ?? 'not_started',
      introCompletedAt: parsed.introCompletedAt,
      introDismissedAt: parsed.introDismissedAt,
      features: parsed.features ?? {},
    };
  } catch {
    return emptyRecord();
  }
}

function writeRecord(userId: string, clubId: string, record: ClubOnboardingRecord): void {
  try {
    window.localStorage.setItem(key(userId, clubId), JSON.stringify(record));
  } catch { /* private mode / quota — non-fatal */ }
}

/* ─── Public mutators ────────────────────────────────────────────── */

export function updateIntroStatus(
  userId: string | undefined,
  clubId: string | undefined | null,
  status: OnboardingStatus,
): void {
  if (!userId || !clubId) return;
  const r = readRecord(userId, clubId);
  const now = new Date().toISOString();
  r.introStatus = status;
  if (status === 'completed') r.introCompletedAt = now;
  if (status === 'dismissed') r.introDismissedAt = now;
  writeRecord(userId, clubId, r);
}

export function updateFeatureStatus(
  userId: string | undefined,
  clubId: string | undefined | null,
  featureKey: string,
  version: number,
  status: OnboardingStatus,
): void {
  if (!userId || !clubId) return;
  const r = readRecord(userId, clubId);
  const now = new Date().toISOString();
  const existing = r.features[featureKey];
  const row: FeatureStatusRow = {
    version,
    status,
    firstSeenAt: existing?.firstSeenAt ?? now,
    completedAt: existing?.completedAt,
    dismissedAt: existing?.dismissedAt,
    remindLaterAt: existing?.remindLaterAt,
  };
  if (status === 'completed') row.completedAt = now;
  if (status === 'dismissed') row.dismissedAt = now;
  if (status === 'remind_later') row.remindLaterAt = now;
  if (status === 'seen' && !row.firstSeenAt) row.firstSeenAt = now;
  r.features[featureKey] = row;
  writeRecord(userId, clubId, r);
}

/**
 * Mark a batch of features as "seen" at their current version — used when
 * the user first lands on a club, so already-installed features don't
 * subsequently surface as "new".
 */
export function markFeaturesSeenInBatch(
  userId: string | undefined,
  clubId: string | undefined | null,
  entries: Array<{ featureKey: string; version: number }>,
): void {
  if (!userId || !clubId || entries.length === 0) return;
  const r = readRecord(userId, clubId);
  const now = new Date().toISOString();
  for (const { featureKey, version } of entries) {
    if (r.features[featureKey]?.status === 'completed' || r.features[featureKey]?.status === 'dismissed') continue;
    r.features[featureKey] = {
      ...r.features[featureKey],
      version,
      status: 'seen',
      firstSeenAt: r.features[featureKey]?.firstSeenAt ?? now,
    };
  }
  writeRecord(userId, clubId, r);
}

/* ─── Public queries ─────────────────────────────────────────────── */

/**
 * Should the feature's onboarding prompt this user right now?
 * Returns true unless they've completed it, dismissed it, or are inside a
 * "remind me later" cooldown window.
 */
export function shouldPromptFeature(
  record: ClubOnboardingRecord,
  featureKey: string,
  version: number,
): boolean {
  const row = record.features[featureKey];
  if (!row) return true; // never seen at all
  if (row.version !== version) return true; // version bump = re-prompt
  if (row.status === 'completed' || row.status === 'dismissed') return false;
  if (row.status === 'remind_later') {
    const when = row.remindLaterAt ? new Date(row.remindLaterAt).getTime() : 0;
    return Date.now() - when >= REMIND_AFTER_MS;
  }
  return row.status !== 'seen';
}

/** Has the user finished the first-time club tour? */
export function hasCompletedIntro(record: ClubOnboardingRecord): boolean {
  return record.introStatus === 'completed' || record.introStatus === 'dismissed';
}

/* ─── Test / admin helpers ───────────────────────────────────────── */

/** Wipe all onboarding state for a (user, club). Used by admin re-watch CTAs. */
export function resetOnboarding(userId: string | undefined, clubId: string | undefined | null): void {
  if (!userId || !clubId) return;
  try { window.localStorage.removeItem(key(userId, clubId)); } catch { /* ignore */ }
}
