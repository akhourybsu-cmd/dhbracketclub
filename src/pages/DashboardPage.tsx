// DH Club Home — Orchestrator
//
// Slim, club-aware Home that composes a few modular sections built around
// the installed-asset system. Each section decides for itself whether to
// render based on (a) whether its parent asset is installed and (b)
// whether it has anything to show. The orchestrator's only jobs are:
//   • Resolve who the user is and which club is active
//   • Fan out a few cheap data fetches (profile, season, drafts, activity, events)
//   • Run the next-action ranker
//   • Hand each module the data it needs
//
// Replaces the previous 1000-line Dashboard. Long lists for drafts/brackets/
// rankings/polls were intentionally moved off Home — they have their own
// dedicated pages reachable from the AssetLauncher.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import {
  useCurrentSeason, useSeasonStandings, useSeasonEntries, getSeasonDraftTarget,
} from '@/hooks/useDraftSeasons';
import { useActivityFeedUpdates, useDraftListUpdates } from '@/hooks/useRealtimeSubscription';

import { HomeHero } from '@/components/home/HomeHero';
import { QuickBar } from '@/components/home/QuickBar';
import { QuickBarSheet } from '@/components/home/QuickBarSheet';
import { useQuickBar } from '@/components/home/useQuickBar';
import { RightNowCard } from '@/components/home/RightNowCard';
import { AssetLauncher } from '@/components/home/AssetLauncher';
import { Highlights, type HighlightItem } from '@/components/home/Highlights';
import { LeagueSnapshot } from '@/components/home/LeagueSnapshot';
import { EventsStrip } from '@/components/home/EventsStrip';
import { ClubPulse } from '@/components/home/ClubPulse';
import { MembersOnline } from '@/components/home/MembersOnline';
import { DiscoverStrip } from '@/components/home/DiscoverStrip';
import { EmptyClubState } from '@/components/home/EmptyClubState';
import { ClubOnboardingFlow } from '@/components/onboarding/ClubOnboardingFlow';
import { WhatIsNewCard } from '@/components/onboarding/WhatIsNewCard';
import { useClubOnboarding, useNewFeatures } from '@/hooks/useOnboarding';
import { CelebrationsHomeWidget } from '@/components/celebrations/CelebrationsHomeWidget';
import { useCelebrationSettings } from '@/hooks/useCelebrations';
import { rankNextActions } from '@/lib/home/nextAction';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';

const NEXUS_SAVE_PREFIX = 'nexus_run_state_v1';
const PWA_DISMISS_KEY = 'dh_pwa_install_dismissed_v1';

/** Read the PWA-install dismissed flag once on mount. SSR-safe. */
function readPwaDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(PWA_DISMISS_KEY) === '1'; } catch { return false; }
}

/** Scan localStorage for an in-flight Nexus run owned by the user. */
function findEndlessSavedRun(userId: string | undefined): { missionName: string; waveLabel: string } | null {
  if (!userId || typeof window === 'undefined') return null;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k?.startsWith(`${NEXUS_SAVE_PREFIX}:${userId}:`)) continue;
    try {
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed?.state || parsed.state.status === 'victory' || parsed.state.status === 'defeat') continue;
      const isEndless = parsed.missionId === ENDLESS_MISSION_ID;
      return {
        missionName: isEndless ? 'Endless Defense' : `Mission ${parsed.missionId}`,
        waveLabel: `Wave ${(parsed.state.waveIndex ?? 0) + 1}`,
      };
    } catch { /* ignore */ }
  }
  return null;
}

interface DraftRow {
  id: string;
  topic: string;
  status: string;
  current_pick_user_id: string | null;
}

interface ActivityRow {
  id: string;
  event_type: string;
  created_at: string;
  target_type?: string | null;
  target_id?: string | null;
  profiles?: { display_name?: string } | null;
}

interface EventRow {
  id: string;
  title: string;
  starts_at: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { club, isClubAdmin } = useClub();
  const { installedAssets, allAssets, loading: assetsLoading, isInstalled } = useClubAssets();
  const { canInstall, install: doInstall } = usePwaInstall();

  // Season + standings come from existing hooks (Draft Arena's data layer).
  const { season } = useCurrentSeason();
  const { standings } = useSeasonStandings(season?.id);
  const { entries: seasonEntries } = useSeasonEntries(season?.id);

  // Light state — user profile + a handful of cheap reads. No bracket/poll/
  // ranking fetches anymore; those live on dedicated pages.
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [pwaDismissed, setPwaDismissed] = useState(readPwaDismissed);

  const dismissPwa = useCallback(() => {
    setPwaDismissed(true);
    try { window.localStorage.setItem(PWA_DISMISS_KEY, '1'); } catch { /* private mode, no-op */ }
  }, []);
  const [loading, setLoading] = useState(true);

  const hasFeed = isInstalled('feed');
  const hasEvents = isInstalled('events');
  const hasDrafts = isInstalled('draft-arena');
  const hasNexus = isInstalled('nexus-defense');

  // QuickBar — user's pinned apps + edit sheet open state
  const enabledAssets = useMemo(
    () => installedAssets.filter(ia => ia.enabled),
    [installedAssets],
  );
  const quickBar = useQuickBar(enabledAssets);
  const [qbOpen, setQbOpen] = useState(false);

  // Onboarding framework — first-time tour + "What's New" prompts
  const onboarding = useClubOnboarding();
  const newFeatures = useNewFeatures();

  // Celebrations plugin (only renders if asset is installed)
  const hasCelebrations = isInstalled('birthdays-milestones');
  const { settings: celebrationSettings } = useCelebrationSettings();
  const showCelebrationsOnHome = hasCelebrations && (celebrationSettings?.show_on_home !== false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const profilePromise = supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single();

    // Drafts only matter when Draft Arena is installed AND only the active
    // ones (we don't show stale completed drafts on Home anymore).
    const draftsPromise = hasDrafts
      ? supabase
          .from('drafts')
          .select('id, topic, status, current_pick_user_id')
          .in('status', ['in_progress', 'setup'])
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as DraftRow[], error: null });

    const activityPromise = hasFeed
      ? supabase
          .from('activity_feed')
          .select('id, event_type, created_at, target_type, target_id, profiles:actor_user_id(display_name)')
          .order('created_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] as ActivityRow[], error: null });

    const eventsPromise = hasEvents
      ? supabase
          .from('events')
          .select('id, title, starts_at')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(6)
      : Promise.resolve({ data: [] as EventRow[], error: null });

    const [profileRes, draftsRes, activityRes, eventsRes] = await Promise.all([
      profilePromise, draftsPromise, activityPromise, eventsPromise,
    ]);

    if ('data' in profileRes && profileRes.data) {
      setDisplayName(profileRes.data.display_name ?? '');
      setAvatarUrl(profileRes.data.avatar_url ?? null);
    }
    setDrafts(((draftsRes as any).data as DraftRow[]) ?? []);
    setActivity(((activityRes as any).data as ActivityRow[]) ?? []);
    setEvents(((eventsRes as any).data as EventRow[]) ?? []);

    setLoading(false);
  }, [user, hasDrafts, hasFeed, hasEvents]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime: refresh activity + drafts when relevant signals come in.
  useActivityFeedUpdates(() => {
    if (!user || !hasFeed) return;
    supabase
      .from('activity_feed')
      .select('id, event_type, created_at, target_type, target_id, profiles:actor_user_id(display_name)')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => { if (data) setActivity(data as ActivityRow[]); });
  });
  useDraftListUpdates(fetchData, !!user);

  // ─── Derived ─────────────────────────────────────────────────────
  const installedSlugs = useMemo(
    () => new Set(installedAssets.filter(ia => ia.enabled).map(ia => ia.asset.slug)),
    [installedAssets],
  );

  const draftsRemaining = useMemo(() => {
    if (!season) return 0;
    const target = getSeasonDraftTarget(season);
    const completed = seasonEntries.filter(e => !e.is_playoff).length;
    return Math.max(0, target - completed);
  }, [season, seasonEntries]);

  // Cheap synchronous scan for an in-flight Nexus run — feeds into the
  // priority ranker so a "Resume your run" card can lead the Right Now
  // surface when no other action outranks it.
  const endlessSavedRun = useMemo(
    () => installedSlugs.has('nexus-defense') ? findEndlessSavedRun(user?.id) : null,
    [user?.id, installedSlugs],
  );

  const actions = useMemo(() => rankNextActions({
    userId: user?.id,
    installedSlugs,
    drafts,
    season: season ?? null,
    draftsRemaining,
    isClubAdmin,
    endlessSavedRun,
    // pickem/operation specifics are also surfaced as live status chips on
    // the AssetLauncher tiles — the ranker only sees them if/when the
    // orchestrator is asked to fetch them. Keeping Home queries minimal.
  }), [user?.id, installedSlugs, drafts, season, draftsRemaining, isClubAdmin, endlessSavedRun]);

  // Derive the truly-empty signal — nothing installed beyond default
  // navigation assets, no season, no events, no activity.
  const gameClassSlugs = ['draft-arena', 'rune-delve', 'nexus-defense', 'nfl-pickem', 'portfolio-wars', 'lockbox', 'brackets'];
  const hasAnyGameInstalled = gameClassSlugs.some(s => installedSlugs.has(s));
  const isFreshClub = !loading && !assetsLoading && !hasAnyGameInstalled && !season && events.length === 0 && activity.length === 0;

  const accent = club?.accent_color ?? '152 72% 46%';
  const seasonTarget = season ? getSeasonDraftTarget(season) : 0;
  const regularEntries = seasonEntries.filter(e => !e.is_playoff).length;

  // Build highlights from activity_feed (cheap — already fetched above) and
  // any other signals we have on hand. Filtered to celebratory event types.
  const highlights = useMemo<HighlightItem[]>(() => {
    if (!hasFeed) return [];
    const items: HighlightItem[] = [];
    for (const a of activity) {
      if (a.event_type === 'draft_completed' && a.target_id) {
        items.push({
          id: `feed-${a.id}`,
          kind: 'draft-winner',
          tag: 'DRAFT COMPLETE',
          headline: a.profiles?.display_name ? `${a.profiles.display_name} closed a draft` : 'A draft just wrapped',
          sub: 'Tap for results',
          to: `/drafts/${a.target_id}`,
          at: a.created_at,
          tint: '45 95% 55%',
        });
      } else if (a.event_type === 'bracket_submitted' && a.target_id) {
        items.push({
          id: `feed-${a.id}`,
          kind: 'feed-event',
          tag: 'BRACKET LOCKED IN',
          headline: a.profiles?.display_name ? `${a.profiles.display_name} submitted a bracket` : 'New bracket submitted',
          to: `/pools/${a.target_id}`,
          at: a.created_at,
          tint: '210 80% 60%',
        });
      } else if (a.event_type === 'event_created' && a.target_id) {
        items.push({
          id: `feed-${a.id}`,
          kind: 'feed-event',
          tag: 'NEW EVENT',
          headline: a.profiles?.display_name ? `${a.profiles.display_name} added an event` : 'A new event is up',
          to: `/events/${a.target_id}`,
          at: a.created_at,
          tint: '38 100% 60%',
        });
      } else if (a.event_type === 'post_created' && a.target_id) {
        items.push({
          id: `feed-${a.id}`,
          kind: 'feed-event',
          tag: 'NEW DISCUSSION',
          headline: a.profiles?.display_name ? `${a.profiles.display_name} started a discussion` : 'New discussion',
          to: `/posts/${a.target_id}`,
          at: a.created_at,
          tint: '195 80% 65%',
        });
      }
      if (items.length >= 6) break;
    }
    return items;
  }, [activity, hasFeed]);

  // ─── Loading skeleton ────────────────────────────────────────────
  if (loading || assetsLoading) {
    return (
      <div className="pb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl skeleton-shimmer" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 rounded skeleton-shimmer" />
            <div className="h-2 w-32 rounded skeleton-shimmer" />
          </div>
          <div className="w-10 h-10 rounded-2xl skeleton-shimmer" />
        </div>
        <div className="h-20 rounded-2xl skeleton-shimmer mb-4" />
        <div className="flex gap-2 mb-5 overflow-hidden">
          {[1,2,3,4,5].map(i => <div key={i} className="w-[78px] h-[88px] rounded-2xl skeleton-shimmer flex-shrink-0" />)}
        </div>
        <div className="h-28 rounded-2xl skeleton-shimmer mb-5" />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div
      className="pb-6"
      style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <HomeHero
        club={club}
        displayName={displayName}
        avatarUrl={avatarUrl}
        pendingCount={actions.length}
      />

      {/* QuickBar — user-pinned dock. Sits above everything for muscle memory. */}
      <QuickBar
        pinned={quickBar.pinned}
        accent={accent}
        onEditClick={() => setQbOpen(true)}
      />

      {/* "What's New" — surface unseen, newly-installed important features */}
      {newFeatures.newFeatures.length > 0 && (
        <WhatIsNewCard
          newFeatures={newFeatures.newFeatures}
          accent={accent}
          onFeatureCompleted={(key, ver) => newFeatures.setStatus(key, ver, 'completed')}
          onFeatureDismissed={(key, ver) => newFeatures.setStatus(key, ver, 'dismissed')}
          onFeatureRemindLater={(key, ver) => newFeatures.setStatus(key, ver, 'remind_later')}
          onDismissAll={newFeatures.dismissAll}
        />
      )}

      {/* PWA install hint — slim inline chip, only when applicable.
          Two real buttons (install + dismiss) sit inside the chip so screen
          readers see them as separate actions instead of a nested
          role="button" inside another button. Dismiss persists via
          localStorage so users aren't re-prompted on every refresh. */}
      <AnimatePresence>
        {canInstall && !pwaDismissed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full mb-4 flex items-center gap-1 rounded-xl pr-1 text-[11px] font-bold"
            style={{
              background: `hsl(${accent} / 0.12)`,
              border: `1px solid hsl(${accent} / 0.28)`,
              color: `hsl(${accent})`,
            }}
          >
            <button
              type="button"
              onClick={doInstall}
              className="flex-1 flex items-center gap-2 text-left px-3 py-2 rounded-l-xl active:scale-[0.99] transition"
              aria-label="Install DH on your phone"
            >
              <Download className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">Install DH on your phone</span>
            </button>
            <button
              type="button"
              onClick={dismissPwa}
              aria-label="Dismiss install prompt"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-current opacity-65 hover:opacity-100 active:scale-90 transition"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Now — single highest-priority action */}
      <RightNowCard actions={actions} />

      {/* Celebrations — Today / Upcoming / Empty card, only when plugin enabled */}
      {showCelebrationsOnHome && <CelebrationsHomeWidget enabled />}

      {/* Asset launcher — installed apps with live status chips */}
      {enabledAssets.length > 0 && (
        <AssetLauncher
          installedAssets={enabledAssets}
          canManage={isClubAdmin}
          accent={accent}
        />
      )}

      {/* Highlights — recent club wins. Pulls double duty as a screen-fill
          module on quiet days and a celebratory surface on busy ones. */}
      <Highlights items={highlights} />

      {/* League snapshot — Draft Arena + active season */}
      {hasDrafts && season && (
        <LeagueSnapshot
          season={season}
          standings={standings as any}
          regularEntries={regularEntries}
          seasonTarget={seasonTarget}
          userId={user?.id}
        />
      )}

      {/* Up Next events strip */}
      {hasEvents && events.length > 0 && (
        <EventsStrip events={events} accent={accent} />
      )}

      {/* Club pulse — high-signal activity */}
      {hasFeed && activity.length > 0 && (
        <ClubPulse activity={activity} />
      )}

      {/* Members online — small presence strip (renders nothing if you're alone) */}
      <MembersOnline
        myDisplayName={displayName}
        myAvatarUrl={avatarUrl}
        accent={accent}
      />

      {/* Discover — admin-only un-installed assets */}
      <DiscoverStrip
        allAssets={allAssets}
        installedAssets={installedAssets}
        isAdmin={isClubAdmin}
        accent={accent}
      />

      {/* Fresh-club empty state — only when truly nothing to surface */}
      {isFreshClub && (
        <EmptyClubState isAdmin={isClubAdmin} accent={accent} clubName={club?.name} />
      )}

      {/* QuickBar customization sheet — portaled, mounts only when open */}
      <AnimatePresence>
        {qbOpen && (
          <QuickBarSheet
            pinned={quickBar.pinned}
            available={quickBar.available}
            max={quickBar.max}
            accent={accent}
            onPin={quickBar.pin}
            onUnpin={quickBar.unpin}
            onMove={quickBar.move}
            onReset={quickBar.reset}
            onClose={() => setQbOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* First-time club onboarding — full-screen, dismissible, runs once */}
      <ClubOnboardingFlow
        open={onboarding.needsFirstTime}
        club={club}
        displayName={displayName}
        installedAssets={enabledAssets}
        isAdmin={isClubAdmin}
        onComplete={onboarding.complete}
        onDismiss={onboarding.dismiss}
      />
    </div>
  );
}
