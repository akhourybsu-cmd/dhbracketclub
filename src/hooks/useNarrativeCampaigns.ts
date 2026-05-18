// DH Club — Narrative RPG · Campaign list + create + approval hooks
//
// One hook returns the campaigns visible to the current user in the
// active club (RLS does the heavy lifting). Mutators handle the creation
// + approval lifecycle. All mutators write an audit row to
// `narrative_approval_events` so the workflow stays auditable.
//
// Optimistic updates: campaign creation is a single insert + member row
// — no need for rollback gymnastics. Approval transitions write the
// audit row in the same call but don't roll back the campaign update on
// audit-row failure (the campaign change is authoritative).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import type { Campaign, CampaignStatus, CampaignPlayMode, CampaignVisibility } from '@/lib/narrative/types';
import { getTemplate, type TemplateKey } from '@/lib/narrative/templates';

interface UseNarrativeCampaignsResult {
  campaigns: Campaign[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCampaign: (input: CreateCampaignInput) => Promise<Campaign | null>;
  approveCampaign: (campaignId: string, notes?: string) => Promise<boolean>;
  requestChanges: (campaignId: string, notes: string) => Promise<boolean>;
  rejectCampaign: (campaignId: string, notes: string) => Promise<boolean>;
  archiveCampaign: (campaignId: string) => Promise<boolean>;
  submitForApproval: (campaignId: string) => Promise<boolean>;
}

export interface CreateCampaignInput {
  title: string;
  pitch?: string;
  description?: string;
  template_key: TemplateKey;
  tone_profile?: string;
  play_mode: CampaignPlayMode;
  visibility: CampaignVisibility;
  proposed_gm_id?: string | null;
  player_limit?: number | null;
  spectators_allowed?: boolean;
  content_notes?: string;
  opening_premise?: string;
  schedule_note?: string;
  /** Submit immediately vs save as draft. */
  submit: boolean;
}

export function useNarrativeCampaigns(): UseNarrativeCampaignsResult {
  const { user } = useAuth();
  const { club } = useClub();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !club?.id) return;
    setLoading(true);
    setError(null);
    // RLS filters everything — we just ask for the club's campaigns.
    const { data, error: dbErr } = await (supabase as any)
      .from('narrative_campaigns')
      .select('*')
      .eq('club_id', club.id)
      .order('updated_at', { ascending: false });
    if (dbErr) {
      setError(dbErr.message);
      setLoading(false);
      return;
    }
    setCampaigns((data ?? []) as Campaign[]);
    setLoading(false);
  }, [user, club?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const createCampaign = useCallback(async (input: CreateCampaignInput): Promise<Campaign | null> => {
    if (!user || !club?.id) return null;
    const template = getTemplate(input.template_key);
    const insertRow = {
      club_id: club.id,
      title: input.title.trim(),
      pitch: input.pitch?.trim() || null,
      description: input.description?.trim() || null,
      template_key: input.template_key,
      tone_profile: input.tone_profile?.trim() || template.toneProfile || null,
      play_mode: input.play_mode,
      visibility: input.visibility,
      player_limit: input.player_limit ?? null,
      spectators_allowed: input.spectators_allowed ?? false,
      content_notes: input.content_notes?.trim() || null,
      opening_premise: input.opening_premise?.trim() || template.openingPremise || null,
      schedule_note: input.schedule_note?.trim() || null,
      created_by: user.id,
      // Creator is the default GM unless they nominate someone else.
      proposed_gm_id: input.proposed_gm_id ?? user.id,
      status: input.submit ? 'pending_approval' : 'draft',
      submitted_at: input.submit ? new Date().toISOString() : null,
    };
    const { data: row, error: insertErr } = await (supabase as any)
      .from('narrative_campaigns')
      .insert(insertRow)
      .select('*')
      .single();
    if (insertErr || !row) {
      setError(insertErr?.message ?? 'Failed to create campaign');
      return null;
    }
    // Add creator as game_master member by default.
    await (supabase as any).from('narrative_campaign_members').insert({
      campaign_id: row.id,
      user_id: (insertRow.proposed_gm_id ?? user.id),
      role: 'game_master',
      status: 'active',
      invited_by: user.id,
    });
    // Audit event
    await (supabase as any).from('narrative_approval_events').insert({
      campaign_id: row.id,
      actor_id: user.id,
      event_type: input.submit ? 'submitted' : 'created_draft',
      from_status: null,
      to_status: row.status,
    });
    await refresh();
    return row as Campaign;
  }, [user, club?.id, refresh]);

  /** Internal helper for status transitions + audit. */
  const transition = useCallback(async (
    campaignId: string,
    nextStatus: CampaignStatus,
    eventType: string,
    notes?: string,
    extraPatch: Record<string, unknown> = {},
  ): Promise<boolean> => {
    if (!user) return false;
    const prev = campaigns.find(c => c.id === campaignId);
    const patch: Record<string, unknown> = {
      status: nextStatus,
      approval_notes: notes ?? prev?.approval_notes ?? null,
      ...extraPatch,
    };
    const { error: updErr } = await (supabase as any)
      .from('narrative_campaigns')
      .update(patch)
      .eq('id', campaignId);
    if (updErr) {
      setError(updErr.message);
      return false;
    }
    await (supabase as any).from('narrative_approval_events').insert({
      campaign_id: campaignId,
      actor_id: user.id,
      event_type: eventType,
      from_status: prev?.status ?? null,
      to_status: nextStatus,
      notes: notes ?? null,
    });
    await refresh();
    return true;
  }, [user, campaigns, refresh]);

  const submitForApproval = useCallback((id: string) =>
    transition(id, 'pending_approval', 'submitted', undefined, { submitted_at: new Date().toISOString() }),
  [transition]);

  const approveCampaign = useCallback((id: string, notes?: string) =>
    transition(id, 'active', 'approved', notes, { approved_at: new Date().toISOString(), approved_by: user?.id ?? null }),
  [transition, user?.id]);

  const requestChanges = useCallback((id: string, notes: string) =>
    transition(id, 'needs_changes', 'changes_requested', notes),
  [transition]);

  const rejectCampaign = useCallback((id: string, notes: string) =>
    transition(id, 'rejected', 'rejected', notes),
  [transition]);

  const archiveCampaign = useCallback((id: string) =>
    transition(id, 'archived', 'archived'),
  [transition]);

  return useMemo(() => ({
    campaigns,
    loading,
    error,
    refresh,
    createCampaign,
    approveCampaign,
    requestChanges,
    rejectCampaign,
    archiveCampaign,
    submitForApproval,
  }), [campaigns, loading, error, refresh, createCampaign, approveCampaign, requestChanges, rejectCampaign, archiveCampaign, submitForApproval]);
}
