// Nexus Defense — Cooperative Operation hooks
//
// Surfaces the active club Operation, the contribution leaderboard,
// and recent run feed. Subscribes to realtime so the progress hub
// updates live as teammates submit runs.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface NexusOperation {
  id: string;
  name: string;
  flavor: string | null;
  status: 'upcoming' | 'active' | 'complete';
  current_phase: 1 | 2 | 3;
  phase1_target: number;
  phase1_progress: number;
  phase2_target: number;
  phase2_progress: number;
  phase3_target: number;
  phase3_progress: number;
  total_runs: number;
  total_contributors: number;
  started_at: string;
  completed_at: string | null;
}

export interface NexusOperationContribution {
  user_id: string;
  total_kills: number;
  total_score: number;
  total_waves: number;
  total_boss_damage: number;
  runs_submitted: number;
  best_score: number;
  best_waves: number;
  contribution_points: number;
  last_contribution_at: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface NexusOperationRun {
  id: string;
  user_id: string;
  kills: number;
  score: number;
  waves: number;
  boss_damage: number;
  contribution_points: number;
  created_at: string;
  display_name?: string | null;
}

/* ---------- helpers ---------- */

async function fetchActiveOperation(): Promise<NexusOperation | null> {
  const { data } = await (supabase as any)
    .from('nexus_operations')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function fetchLeaderboard(operationId: string): Promise<NexusOperationContribution[]> {
  const { data: rows } = await (supabase as any)
    .from('nexus_operation_contributions')
    .select('*')
    .eq('operation_id', operationId)
    .order('contribution_points', { ascending: false })
    .limit(50);
  if (!rows?.length) return [];
  const ids = Array.from(new Set(rows.map((r: any) => r.user_id)));
  const { data: profiles } = await (supabase as any)
    .from('profiles').select('id, display_name, avatar_url').in('id', ids);
  const byId = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
  return rows.map((r: any) => ({ ...r, display_name: byId.get(r.user_id)?.display_name, avatar_url: byId.get(r.user_id)?.avatar_url }));
}

async function fetchRecentRuns(operationId: string): Promise<NexusOperationRun[]> {
  const { data: rows } = await (supabase as any)
    .from('nexus_operation_runs')
    .select('id, user_id, kills, score, waves, boss_damage, contribution_points, created_at')
    .eq('operation_id', operationId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (!rows?.length) return [];
  const ids = Array.from(new Set(rows.map((r: any) => r.user_id)));
  const { data: profiles } = await (supabase as any)
    .from('profiles').select('id, display_name').in('id', ids);
  const byId = new Map<string, string | null>((profiles ?? []).map((p: any) => [p.id, p.display_name]));
  return rows.map((r: any) => ({ ...r, display_name: byId.get(r.user_id) ?? null }));
}

/* ---------- hook ---------- */

export function useActiveOperation() {
  const [operation, setOperation] = useState<NexusOperation | null>(null);
  const [leaderboard, setLeaderboard] = useState<NexusOperationContribution[]>([]);
  const [recentRuns, setRecentRuns] = useState<NexusOperationRun[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const op = await fetchActiveOperation();
    setOperation(op);
    if (op) {
      const [lb, runs] = await Promise.all([fetchLeaderboard(op.id), fetchRecentRuns(op.id)]);
      setLeaderboard(lb);
      setRecentRuns(runs);
    } else {
      setLeaderboard([]);
      setRecentRuns([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: any change to ops/contribs/runs triggers a soft refresh.
  // Each mount gets a unique channel name so multiple instances of this
  // hook (e.g. Nexus Home + Operation Hub mounted simultaneously) never
  // collide on the Supabase channel registry.
  useEffect(() => {
    const channelName = `nexus-operation-live-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nexus_operations' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nexus_operation_contributions' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nexus_operation_runs' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  return { operation, leaderboard, recentRuns, loading, refresh };
}

/** Submit an endless run to the active operation. Idempotent server-side. */
export async function submitOperationContribution(args: {
  operationId: string;
  nexusRunId: string | null;
  kills: number;
  score: number;
  waves: number;
  bossDamage: number;
  durationSeconds: number;
}): Promise<{
  ok: boolean;
  duplicate?: boolean;
  pointsAwarded?: number;
  phase?: number;
  status?: string;
  error?: string;
  affectedPhase?: number;
  priorProgress?: number;
  newProgress?: number;
  priorTarget?: number;
  phaseAdvanced?: boolean;
  operationComplete?: boolean;
}> {
  const { data, error } = await (supabase as any).rpc('submit_operation_contribution', {
    _operation_id: args.operationId,
    _nexus_run_id: args.nexusRunId,
    _kills: args.kills,
    _score: args.score,
    _waves: args.waves,
    _boss_damage: args.bossDamage,
    _duration_seconds: args.durationSeconds,
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: !!data?.ok,
    duplicate: !!data?.duplicate,
    pointsAwarded: data?.points_awarded,
    phase: data?.phase,
    status: data?.status,
    affectedPhase: data?.affected_phase,
    priorProgress: data?.prior_progress,
    newProgress: data?.new_progress,
    priorTarget: data?.prior_target,
    phaseAdvanced: !!data?.phase_advanced,
    operationComplete: !!data?.operation_complete,
  };
}

/** Look up the caller's contribution for an operation (for results screen). */
export async function fetchMyContribution(operationId: string, userId: string): Promise<NexusOperationContribution | null> {
  const { data } = await (supabase as any)
    .from('nexus_operation_contributions')
    .select('*')
    .eq('operation_id', operationId)
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

/* ---------- admin helpers ---------- */

export async function startNewOperation(input: {
  name: string;
  flavor?: string | null;
  phase1_target?: number;
  phase2_target?: number;
  phase3_target?: number;
  userId: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data, error } = await (supabase as any)
    .from('nexus_operations')
    .insert({
      name: input.name,
      flavor: input.flavor ?? null,
      status: 'active',
      current_phase: 1,
      phase1_target: input.phase1_target ?? 5000,
      phase2_target: input.phase2_target ?? 500000,
      phase3_target: input.phase3_target ?? 1000000,
      created_by: input.userId,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

export async function endOperation(operationId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await (supabase as any)
    .from('nexus_operations')
    .update({ status: 'complete', completed_at: new Date().toISOString() })
    .eq('id', operationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Hook for admin checks. */
export function useIsAppAdmin(): boolean {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    (supabase as any).rpc('is_app_admin', { _user_id: user.id }).then(({ data }: any) => {
      setIsAdmin(!!data);
    });
  }, [user]);
  return isAdmin;
}
