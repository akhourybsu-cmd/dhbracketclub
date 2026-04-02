import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface RealtimeConfig {
  table: string;
  schema?: string;
  event?: PostgresEvent;
  filter?: string;
}

interface UseRealtimeOptions<T> {
  configs: RealtimeConfig[];
  channelName: string;
  onPayload?: (payload: { eventType: string; table: string; new: any; old: any }) => void;
  enabled?: boolean;
}

/**
 * Abstracted realtime subscription hook.
 * Subscribes to postgres_changes on specified tables.
 * Returns connection status and last updated timestamp.
 */
export function useRealtimeSubscription<T = any>({
  configs,
  channelName,
  onPayload,
  enabled = true,
}: UseRealtimeOptions<T>) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || configs.length === 0) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');

    let channel = supabase.channel(channelName);

    for (const config of configs) {
      const filterConfig: any = {
        event: config.event || '*',
        schema: config.schema || 'public',
        table: config.table,
      };
      if (config.filter) {
        filterConfig.filter = config.filter;
      }

      channel = channel.on(
        'postgres_changes' as any,
        filterConfig,
        (payload: any) => {
          setLastUpdated(new Date());
          onPayload?.({
            eventType: payload.eventType,
            table: config.table,
            new: payload.new,
            old: payload.old,
          });
        }
      );
    }

    channel.subscribe((subscribedStatus) => {
      if (subscribedStatus === 'SUBSCRIBED') {
        setStatus('connected');
      } else if (subscribedStatus === 'CHANNEL_ERROR') {
        setStatus('error');
      } else if (subscribedStatus === 'CLOSED') {
        setStatus('disconnected');
      }
    });

    channelRef.current = channel;

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled, JSON.stringify(configs)]);

  return { status, lastUpdated, cleanup };
}

/**
 * Subscribe to game updates for a tournament.
 */
export function useGameUpdates(
  tournamentId: string | undefined,
  onUpdate: () => void,
  enabled = true
) {
  return useRealtimeSubscription({
    channelName: `games-${tournamentId}`,
    configs: tournamentId
      ? [{ table: 'games', event: 'UPDATE', filter: `tournament_id=eq.${tournamentId}` }]
      : [],
    onPayload: onUpdate,
    enabled: enabled && !!tournamentId,
  });
}

/**
 * Subscribe to standings updates for a pool.
 */
export function useStandingsUpdates(
  poolId: string | undefined,
  onUpdate: () => void,
  enabled = true
) {
  return useRealtimeSubscription({
    channelName: `standings-${poolId}`,
    configs: poolId
      ? [{ table: 'standings', event: '*', filter: `pool_id=eq.${poolId}` }]
      : [],
    onPayload: onUpdate,
    enabled: enabled && !!poolId,
  });
}

/**
 * Subscribe to sync run updates (for admin tools).
 */
export function useSyncRunUpdates(onUpdate: () => void, enabled = true) {
  return useRealtimeSubscription({
    channelName: 'sync-runs',
    configs: [{ table: 'sync_runs', event: '*' }],
    onPayload: onUpdate,
    enabled,
  });
}

/**
 * Subscribe to poll vote updates.
 */
export function usePollVoteUpdates(
  pollId: string | undefined,
  onUpdate: () => void,
  enabled = true
) {
  return useRealtimeSubscription({
    channelName: `poll-votes-${pollId}`,
    configs: pollId
      ? [{ table: 'poll_votes', event: '*', filter: `poll_id=eq.${pollId}` }]
      : [],
    onPayload: onUpdate,
    enabled: enabled && !!pollId,
  });
}

/**
 * Subscribe to draft updates (picks, participants, and draft status).
 */
export function useDraftUpdates(
  draftId: string | undefined,
  onUpdate: () => void,
  enabled = true
) {
  return useRealtimeSubscription({
    channelName: `draft-${draftId}`,
    configs: draftId
      ? [
          { table: 'draft_picks', event: '*', filter: `draft_id=eq.${draftId}` },
          { table: 'draft_participants', event: '*', filter: `draft_id=eq.${draftId}` },
          { table: 'drafts', event: 'UPDATE', filter: `id=eq.${draftId}` },
        ]
      : [],
    onPayload: onUpdate,
    enabled: enabled && !!draftId,
  });
}

/**
 * Subscribe to ranking submission updates.
 */
export function useRankingUpdates(
  rankingId: string | undefined,
  onUpdate: () => void,
  enabled = true
) {
  return useRealtimeSubscription({
    channelName: `ranking-${rankingId}`,
    configs: rankingId
      ? [{ table: 'ranking_submissions', event: '*', filter: `ranking_id=eq.${rankingId}` }]
      : [],
    onPayload: onUpdate,
    enabled: enabled && !!rankingId,
  });
}

/**
 * Subscribe to draft list updates (any draft status/pick changes).
 */
export function useDraftListUpdates(
  onUpdate: () => void,
  enabled = true
) {
  return useRealtimeSubscription({
    channelName: 'draft-list-updates',
    configs: [
      { table: 'drafts', event: 'UPDATE' },
      { table: 'draft_picks', event: '*' },
      { table: 'draft_participants', event: '*' },
    ],
    onPayload: onUpdate,
    enabled,
  });
}

/**
 * Subscribe to activity feed updates.
 */
export function useActivityFeedUpdates(
  onUpdate: () => void,
  enabled = true
) {
  return useRealtimeSubscription({
    channelName: 'activity-feed',
    configs: [{ table: 'activity_feed', event: 'INSERT' }],
    onPayload: onUpdate,
    enabled,
  });
}
