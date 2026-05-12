// DH Club — Onboarding hooks
//
// Three hooks that read & write the onboarding store. All three are
// permission-aware (admin/member) and asset-aware (installed/enabled
// status from useClubAssets), so callers never have to filter manually.
//
//   useClubOnboarding()     → first-time club tour state
//   useNewFeatures()        → list of unseen, promptable installed features
//   useFeatureOnboarding(k) → state for a single feature (used by admin preview)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import {
  type FeatureOnboarding,
  isPromptable,
  isVisibleToRole,
  resolveOnboarding,
} from '@/lib/onboarding/registry';
import {
  type ClubOnboardingRecord,
  type OnboardingStatus,
  hasCompletedIntro,
  markFeaturesSeenInBatch,
  readRecord,
  resetOnboarding,
  shouldPromptFeature,
  updateFeatureStatus,
  updateIntroStatus,
} from '@/lib/onboarding/storage';

/**
 * Internal — subscribes to storage record for a (user, club). Re-reads on
 * a tick whenever a sibling mutator runs. We don't subscribe via the
 * Storage event because the same-tab updates we want to react to don't
 * fire it; instead we expose a `bump()` helper that triggers re-read.
 */
function useRecord() {
  const { user } = useAuth();
  const { club } = useClub();
  const [version, setVersion] = useState(0);
  const record = useMemo<ClubOnboardingRecord>(
    () => readRecord(user?.id, club?.id),
    // version bump forces re-read after a mutation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, club?.id, version],
  );
  const bump = useCallback(() => setVersion(v => v + 1), []);
  return { record, bump, userId: user?.id, clubId: club?.id };
}

/* ─── useClubOnboarding ─────────────────────────────────────────── */

export interface UseClubOnboardingReturn {
  /** Whether the first-time tour should be shown right now. */
  needsFirstTime: boolean;
  /** Mark the first-time tour completed (user finished it). */
  complete: () => void;
  /** Mark the first-time tour dismissed (user skipped or closed). */
  dismiss: () => void;
  /** Force re-show — used by admin "replay onboarding" surfaces. */
  reset: () => void;
}

export function useClubOnboarding(): UseClubOnboardingReturn {
  const { record, bump, userId, clubId } = useRecord();
  const { isClubAdmin } = useClub();
  const { installedAssets, loading: assetsLoading } = useClubAssets();

  // Existing-user grace: if the user has no record yet AND the club already
  // has assets installed AND they're not a brand-new admin, default the
  // intro to "completed" silently so we don't barrage existing users with a
  // tour for a club they already know.
  useEffect(() => {
    if (!userId || !clubId || assetsLoading) return;
    if (record.introStatus !== 'not_started') return;
    const clubAlreadyHasAssets = installedAssets.filter(ia => ia.enabled).length >= 3;
    if (clubAlreadyHasAssets && !isClubAdmin) {
      // Snapshot current features as "seen" so they don't all surface as "new"
      // on first dashboard load.
      const promptable = installedAssets
        .filter(ia => ia.enabled)
        .map(ia => resolveOnboarding(ia.asset))
        .filter(o => isPromptable(o) && isVisibleToRole(o, isClubAdmin));
      markFeaturesSeenInBatch(
        userId, clubId,
        promptable.map(o => ({ featureKey: o.featureKey, version: o.version })),
      );
      updateIntroStatus(userId, clubId, 'completed');
      bump();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, clubId, assetsLoading]);

  const needsFirstTime = !assetsLoading && !hasCompletedIntro(record);

  const complete = useCallback(() => {
    if (!userId || !clubId) return;
    // When completing the intro, also batch-mark all currently-installed
    // promptable features as "seen" so we don't immediately turn around and
    // prompt the user for everything they just toured.
    const promptable = installedAssets
      .filter(ia => ia.enabled)
      .map(ia => resolveOnboarding(ia.asset))
      .filter(o => isPromptable(o) && isVisibleToRole(o, isClubAdmin));
    markFeaturesSeenInBatch(
      userId, clubId,
      promptable.map(o => ({ featureKey: o.featureKey, version: o.version })),
    );
    updateIntroStatus(userId, clubId, 'completed');
    bump();
  }, [userId, clubId, installedAssets, isClubAdmin, bump]);

  const dismiss = useCallback(() => {
    if (!userId || !clubId) return;
    // Same batch-seen behavior on dismiss — user skipped but we should still
    // suppress New Feature spam for things that already existed.
    const installed = installedAssets.filter(ia => ia.enabled);
    markFeaturesSeenInBatch(
      userId, clubId,
      installed.map(ia => {
        const o = resolveOnboarding(ia.asset);
        return { featureKey: o.featureKey, version: o.version };
      }),
    );
    updateIntroStatus(userId, clubId, 'dismissed');
    bump();
  }, [userId, clubId, installedAssets, bump]);

  const reset = useCallback(() => {
    if (!userId || !clubId) return;
    resetOnboarding(userId, clubId);
    bump();
  }, [userId, clubId, bump]);

  return { needsFirstTime, complete, dismiss, reset };
}

/* ─── useNewFeatures ────────────────────────────────────────────── */

export interface UseNewFeaturesReturn {
  /** Installed assets the user hasn't seen onboarding for. Sorted by importance. */
  newFeatures: FeatureOnboarding[];
  /** Mark a single feature as seen / completed / dismissed / remind-later. */
  setStatus: (featureKey: string, version: number, status: OnboardingStatus) => void;
  /** Convenience — mark every current new feature as seen at once. */
  dismissAll: () => void;
}

const IMPORTANCE_RANK: Record<string, number> = {
  critical: 0,
  important: 1,
  standard: 2,
  minor: 3,
};

export function useNewFeatures(): UseNewFeaturesReturn {
  const { record, bump, userId, clubId } = useRecord();
  const { isClubAdmin } = useClub();
  const { installedAssets, loading: assetsLoading } = useClubAssets();

  const newFeatures = useMemo<FeatureOnboarding[]>(() => {
    if (assetsLoading) return [];
    if (!hasCompletedIntro(record)) return []; // suppressed until intro is resolved
    return installedAssets
      .filter(ia => ia.enabled)
      .map(ia => resolveOnboarding(ia.asset))
      .filter(o => isPromptable(o))
      .filter(o => isVisibleToRole(o, isClubAdmin))
      .filter(o => shouldPromptFeature(record, o.featureKey, o.version))
      .sort((a, b) => (IMPORTANCE_RANK[a.importance] ?? 9) - (IMPORTANCE_RANK[b.importance] ?? 9));
  }, [installedAssets, assetsLoading, record, isClubAdmin]);

  const setStatus = useCallback(
    (featureKey: string, version: number, status: OnboardingStatus) => {
      updateFeatureStatus(userId, clubId, featureKey, version, status);
      bump();
    },
    [userId, clubId, bump],
  );

  const dismissAll = useCallback(() => {
    if (!userId || !clubId) return;
    markFeaturesSeenInBatch(
      userId, clubId,
      newFeatures.map(o => ({ featureKey: o.featureKey, version: o.version })),
    );
    bump();
  }, [userId, clubId, newFeatures, bump]);

  return { newFeatures, setStatus, dismissAll };
}

/* ─── useFeatureOnboarding ──────────────────────────────────────── */

export interface UseFeatureOnboardingReturn {
  onboarding: FeatureOnboarding | undefined;
  status: OnboardingStatus;
  markSeen: () => void;
  markCompleted: () => void;
  markDismissed: () => void;
  markRemindLater: () => void;
}

/**
 * State for a single feature's onboarding. Used by the admin preview
 * surface in the Asset Library and by deep-linked tutorial routes.
 */
export function useFeatureOnboarding(featureKey: string | undefined): UseFeatureOnboardingReturn {
  const { record, bump, userId, clubId } = useRecord();
  const { allAssets } = useClubAssets();

  const onboarding = useMemo<FeatureOnboarding | undefined>(() => {
    if (!featureKey) return undefined;
    const asset = allAssets.find(a => a.slug === featureKey);
    if (asset) return resolveOnboarding(asset);
    return undefined;
  }, [featureKey, allAssets]);

  const status = onboarding ? (record.features[onboarding.featureKey]?.status ?? 'not_started') : 'not_started';

  const setStatus = useCallback(
    (next: OnboardingStatus) => {
      if (!onboarding) return;
      updateFeatureStatus(userId, clubId, onboarding.featureKey, onboarding.version, next);
      bump();
    },
    [onboarding, userId, clubId, bump],
  );

  return {
    onboarding,
    status,
    markSeen: () => setStatus('seen'),
    markCompleted: () => setStatus('completed'),
    markDismissed: () => setStatus('dismissed'),
    markRemindLater: () => setStatus('remind_later'),
  };
}
