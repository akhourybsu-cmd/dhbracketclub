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
  }, [channelName, enabled, configs.map(c => `${c.table}:${c.filter || ''}`).join(',')]);

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
