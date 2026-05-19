// DH Club — Narrative RPG · Apply approved state updates
//
// Translates an array of structured StateUpdateAction objects (produced
// by the AI service or the Summary Wizard) into actual DB writes.
//
// CRITICAL: this helper is the ONLY path that converts AI suggestions
// into real campaign state. It is invoked from GM-side code paths only;
// RLS on each underlying table also enforces GM/admin role at the DB
// layer as defense-in-depth.
//
// Every action returns a result object so the caller can report what
// actually changed (e.g. "advanced 'Tony loses patience' to 5/8").

import { supabase } from '@/integrations/supabase/client';
import type { StateUpdateAction } from './aiService';

export interface AppliedAction {
  action: StateUpdateAction;
  ok: boolean;
  message: string;
  insertedId?: string;
}

export async function applyStateUpdates(
  campaignId: string,
  actions: StateUpdateAction[],
): Promise<AppliedAction[]> {
  const results: AppliedAction[] = [];
  const sb = supabase as any;
  for (const a of actions) {
    try {
      switch (a.kind) {
        case 'add_item': {
          const p = a.payload as { name: string; description?: string; owner_character_id?: string | null; visibility?: 'public' | 'gm_only' };
          const { data, error } = await sb.from('narrative_items').insert({
            campaign_id: campaignId,
            name: p.name,
            description: p.description ?? null,
            owner_character_id: p.owner_character_id ?? null,
            visibility: p.visibility ?? 'public',
          }).select('id').single();
          if (error) throw error;
          results.push({ action: a, ok: true, message: `Item "${p.name}" added.`, insertedId: data?.id });
          break;
        }
        case 'add_clue': {
          const p = a.payload as { name: string; description?: string; visibility?: 'public' | 'gm_only'; importance?: 'low' | 'normal' | 'high' };
          const { data, error } = await sb.from('narrative_clues').insert({
            campaign_id: campaignId,
            name: p.name,
            description: p.description ?? null,
            visibility: p.visibility ?? 'public',
            importance: p.importance ?? 'normal',
            status: 'discovered',
          }).select('id').single();
          if (error) throw error;
          results.push({ action: a, ok: true, message: `Clue "${p.name}" added.`, insertedId: data?.id });
          break;
        }
        case 'create_npc': {
          const p = a.payload as { name: string; role?: string; description?: string; visibility?: 'public' | 'gm_only' };
          const { data, error } = await sb.from('narrative_npcs').insert({
            campaign_id: campaignId,
            name: p.name,
            role: p.role ?? null,
            description: p.description ?? null,
            visibility: p.visibility ?? 'public',
          }).select('id').single();
          if (error) throw error;
          results.push({ action: a, ok: true, message: `NPC "${p.name}" created.`, insertedId: data?.id });
          break;
        }
        case 'add_location': {
          const p = a.payload as { name: string; description?: string; visibility?: 'public' | 'gm_only' };
          const { data, error } = await sb.from('narrative_locations').insert({
            campaign_id: campaignId,
            name: p.name,
            description: p.description ?? null,
            visibility: p.visibility ?? 'public',
          }).select('id').single();
          if (error) throw error;
          results.push({ action: a, ok: true, message: `Location "${p.name}" added.`, insertedId: data?.id });
          break;
        }
        case 'advance_clock': {
          const p = a.payload as { clock_id: string; delta?: number; note?: string };
          if (!p.clock_id) throw new Error('clock_id required');
          const delta = p.delta ?? 1;
          // Atomic clamp + history via RPC — closes the read-then-write
          // race the previous implementation had.
          const { data, error } = await sb.rpc('advance_narrative_clock', {
            _campaign_id: campaignId,
            _clock_id: p.clock_id,
            _delta: delta,
            _note: p.note ?? null,
          });
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : data;
          results.push({
            action: a,
            ok: true,
            message: row?.name
              ? `Clock "${row.name}" → ${row.current_value}/${row.max_value}.`
              : `Clock advanced.`,
          });
          break;
        }
        case 'update_faction': {
          const p = a.payload as { faction_id: string; relationship_delta?: number; suspicion_delta?: number; attitude?: string };
          if (!p.faction_id) throw new Error('faction_id required');
          // Scope by campaign_id as defense-in-depth — RLS would also
          // catch a cross-campaign payload, but failing fast here gives
          // a clearer error message.
          const { data: f, error: getErr } = await sb.from('narrative_factions').select('*').eq('id', p.faction_id).eq('campaign_id', campaignId).maybeSingle();
          if (getErr || !f) throw getErr ?? new Error('faction not found in campaign');
          const patch: Record<string, unknown> = {};
          if (typeof p.relationship_delta === 'number') {
            patch.relationship_score = Math.max(-100, Math.min(100, f.relationship_score + p.relationship_delta));
          }
          if (typeof p.suspicion_delta === 'number') {
            patch.suspicion_score = Math.max(0, Math.min(100, f.suspicion_score + p.suspicion_delta));
          }
          if (p.attitude) patch.attitude = p.attitude;
          if (Object.keys(patch).length === 0) {
            results.push({ action: a, ok: true, message: `Faction "${f.name}" — no-op.` });
            break;
          }
          const { error } = await sb.from('narrative_factions').update(patch).eq('id', p.faction_id);
          if (error) throw error;
          results.push({ action: a, ok: true, message: `Faction "${f.name}" updated.` });
          break;
        }
        case 'add_condition': {
          const p = a.payload as { character_id: string; condition: string };
          if (!p.character_id || !p.condition) throw new Error('character_id + condition required');
          const { data: c, error: getErr } = await sb.from('narrative_characters').select('id, name, conditions').eq('id', p.character_id).eq('campaign_id', campaignId).maybeSingle();
          if (getErr || !c) throw getErr ?? new Error('character not found in campaign');
          const existing = Array.isArray(c.conditions) ? c.conditions : [];
          const { error } = await sb.from('narrative_characters').update({
            conditions: [...existing, { label: p.condition, applied_at: new Date().toISOString() }],
          }).eq('id', p.character_id);
          if (error) throw error;
          results.push({ action: a, ok: true, message: `Added condition "${p.condition}" to ${c.name}.` });
          break;
        }
        case 'update_memory': {
          const p = a.payload as { field: string; value: string };
          if (!p.field) throw new Error('memory field required');
          // Upsert into narrative_memory row keyed by campaign_id.
          const patch: Record<string, unknown> = {};
          const allowed = new Set([
            'current_state', 'current_location', 'current_objective', 'tone_guide', 'gm_only_notes',
          ]);
          if (allowed.has(p.field)) {
            patch[p.field] = p.value;
          } else {
            // Append to a JSON array memory bucket if the field matches one.
            // Restricted to known keys to avoid arbitrary writes.
            const arrayFields = new Set(['major_decisions', 'running_jokes', 'important_quotes', 'unresolved', 'canon_locks']);
            if (!arrayFields.has(p.field)) throw new Error(`unsupported memory field ${p.field}`);
            const { data: cur } = await sb.from('narrative_memory').select(p.field).eq('campaign_id', campaignId).maybeSingle();
            const existing: unknown[] = Array.isArray((cur as any)?.[p.field]) ? (cur as any)[p.field] : [];
            patch[p.field] = [...existing, { text: p.value, at: new Date().toISOString() }];
          }
          patch.updated_at = new Date().toISOString();
          const { error } = await sb.from('narrative_memory').upsert(
            { campaign_id: campaignId, ...patch },
            { onConflict: 'campaign_id' },
          );
          if (error) throw error;
          results.push({ action: a, ok: true, message: `Memory.${p.field} updated.` });
          break;
        }
        case 'add_log_entry': {
          const p = a.payload as { title?: string; body: string; visibility?: 'public' | 'gm_only' };
          if (!p.body) throw new Error('log body required');
          const { error } = await sb.from('narrative_summaries').insert({
            campaign_id: campaignId,
            title: p.title ?? null,
            body: p.body,
            visibility: p.visibility ?? 'public',
            generated_by_ai: true,
          });
          if (error) throw error;
          results.push({ action: a, ok: true, message: `Log entry added.` });
          break;
        }
        default: {
          results.push({ action: a, ok: false, message: `Unknown action: ${(a as any).kind}` });
        }
      }
    } catch (e) {
      results.push({ action: a, ok: false, message: (e as Error).message ?? 'failed' });
    }
  }
  return results;
}

/** Render a human description of an action for the review UI. */
export function describeAction(a: StateUpdateAction): string {
  switch (a.kind) {
    case 'add_item':       return `Add item "${(a.payload as any).name}"`;
    case 'add_clue':       return `Add clue "${(a.payload as any).name}"`;
    case 'update_faction': return `Update faction (relationship ${(a.payload as any).relationship_delta ?? 0}, suspicion ${(a.payload as any).suspicion_delta ?? 0})`;
    case 'advance_clock':  return `Advance clock by ${(a.payload as any).delta ?? 1}`;
    case 'create_npc':     return `Create NPC "${(a.payload as any).name}"`;
    case 'add_location':   return `Add location "${(a.payload as any).name}"`;
    case 'add_condition':  return `Add condition "${(a.payload as any).condition}" to character`;
    case 'update_memory':  return `Update memory.${(a.payload as any).field}`;
    case 'add_log_entry':  return `Add log entry`;
    default:               return `Unknown action`;
  }
}
