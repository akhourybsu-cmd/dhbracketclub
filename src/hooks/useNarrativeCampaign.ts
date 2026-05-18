// DH Club — Narrative RPG · Single campaign hook
//
// Wraps everything the campaign detail page needs:
//   • The campaign row + my role within it
//   • Messages (real-time INSERT subscription)
//   • Characters + my character
//   • Members
//   • Scenes / chapters / clocks / NPCs / clues / factions / items / locations
//   • Mutators for messages, character, dice rolls
//
// Real-time: subscribes to message + clock INSERTs and merges them
// optimistically. Avoids fetching huge history on every push.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { rollChronicle, type ChronicleStat, type RollAdvantage } from '@/lib/narrative/chronicleRuleset';
import type {
  Campaign, CampaignMember, Character, Scene, Message, MessageType,
  NPC, Faction, Clock, Clue, Item, Location as NarrativeLocation,
  AiSuggestionRow,
} from '@/lib/narrative/types';

interface UseNarrativeCampaignResult {
  campaign: Campaign | null;
  myRole: 'game_master' | 'player' | 'spectator' | null;
  isGm: boolean;
  members: CampaignMember[];
  characters: Character[];
  myCharacter: Character | null;
  currentScene: Scene | null;
  scenes: Scene[];
  messages: Message[];
  npcs: NPC[];
  factions: Faction[];
  clocks: Clock[];
  clues: Clue[];
  items: Item[];
  locations: NarrativeLocation[];
  aiSuggestions: AiSuggestionRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  // Story chat
  postMessage: (input: PostMessageInput) => Promise<Message | null>;
  rollDice: (input: RollDiceInput) => Promise<Message | null>;

  // Character
  createCharacter: (c: Omit<Character, 'id' | 'created_at' | 'updated_at' | 'campaign_id' | 'owner_id' | 'is_retired'>) => Promise<Character | null>;
  updateCharacter: (id: string, patch: Partial<Character>) => Promise<boolean>;

  // GM mutations
  createScene: (input: { title: string; location?: string; stakes?: string; objective?: string; public_notes?: string; gm_notes?: string }) => Promise<Scene | null>;
  endScene: (sceneId: string) => Promise<boolean>;
  advanceClock: (clockId: string, delta: number, note?: string) => Promise<boolean>;
  createClock: (input: { name: string; description?: string; max_value: number; clock_type: Clock['clock_type']; visibility: 'public' | 'gm_only' }) => Promise<Clock | null>;
  createNpc: (input: Partial<NPC> & { name: string }) => Promise<NPC | null>;
  createClue: (input: Partial<Clue> & { name: string }) => Promise<Clue | null>;
  createFaction: (input: Partial<Faction> & { name: string }) => Promise<Faction | null>;
  createItem: (input: Partial<Item> & { name: string }) => Promise<Item | null>;
  createLocation: (input: Partial<NarrativeLocation> & { name: string }) => Promise<NarrativeLocation | null>;
}

interface PostMessageInput {
  body: string;
  message_type: MessageType;
  scene_id?: string | null;
  character_id?: string | null;
  visibility?: 'public' | 'gm_only' | 'private';
  metadata?: Record<string, unknown>;
}

interface RollDiceInput {
  stat: ChronicleStat | 'none';
  statValue: number;
  modifier?: number;
  difficulty?: number;
  advantage?: RollAdvantage;
  reason?: string;
  character_id?: string | null;
  visibility?: 'public' | 'gm_only';
  scene_id?: string | null;
}

export function useNarrativeCampaign(campaignId: string | undefined): UseNarrativeCampaignResult {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [clocks, setClocks] = useState<Clock[]>([]);
  const [clues, setClues] = useState<Clue[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<NarrativeLocation[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mirror campaign in a ref so real-time callbacks have current data.
  const campaignRef = useRef<Campaign | null>(null);
  useEffect(() => { campaignRef.current = campaign; }, [campaign]);

  const refresh = useCallback(async () => {
    if (!campaignId || !user) return;
    setLoading(true);
    setError(null);
    // Fetch everything in parallel. RLS handles visibility — anything the
    // user can't see simply doesn't come back.
    const sb = supabase as any;
    const [
      campRes, membersRes, charactersRes, scenesRes, messagesRes,
      npcsRes, factionsRes, clocksRes, cluesRes, itemsRes, locsRes,
      aiRes,
    ] = await Promise.all([
      sb.from('narrative_campaigns').select('*').eq('id', campaignId).maybeSingle(),
      sb.from('narrative_campaign_members').select('*').eq('campaign_id', campaignId),
      sb.from('narrative_characters').select('*').eq('campaign_id', campaignId),
      sb.from('narrative_scenes').select('*').eq('campaign_id', campaignId).order('position', { ascending: true }),
      sb.from('narrative_messages').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true }).limit(200),
      sb.from('narrative_npcs').select('*').eq('campaign_id', campaignId),
      sb.from('narrative_factions').select('*').eq('campaign_id', campaignId),
      sb.from('narrative_clocks').select('*').eq('campaign_id', campaignId),
      sb.from('narrative_clues').select('*').eq('campaign_id', campaignId),
      sb.from('narrative_items').select('*').eq('campaign_id', campaignId),
      sb.from('narrative_locations').select('*').eq('campaign_id', campaignId),
      sb.from('narrative_ai_suggestions').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
    ]);
    if (campRes.error) { setError(campRes.error.message); setLoading(false); return; }
    setCampaign(campRes.data as Campaign | null);
    setMembers((membersRes.data ?? []) as CampaignMember[]);
    setCharacters((charactersRes.data ?? []) as Character[]);
    setScenes((scenesRes.data ?? []) as Scene[]);
    setMessages((messagesRes.data ?? []) as Message[]);
    setNpcs((npcsRes.data ?? []) as NPC[]);
    setFactions((factionsRes.data ?? []) as Faction[]);
    setClocks((clocksRes.data ?? []) as Clock[]);
    setClues((cluesRes.data ?? []) as Clue[]);
    setItems((itemsRes.data ?? []) as Item[]);
    setLocations((locsRes.data ?? []) as NarrativeLocation[]);
    setAiSuggestions((aiRes.data ?? []) as AiSuggestionRow[]);
    setLoading(false);
  }, [campaignId, user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Real-time: messages + clocks
  useEffect(() => {
    if (!campaignId) return;
    const ch = (supabase as any)
      .channel(`narrative:${campaignId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'narrative_messages', filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new as Message]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'narrative_clocks', filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => setClocks(prev => prev.map(c => c.id === payload.new.id ? payload.new as Clock : c)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'narrative_clocks', filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => setClocks(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, payload.new as Clock]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'narrative_scenes', filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => setScenes(prev => prev.map(s => s.id === payload.new.id ? payload.new as Scene : s)))
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [campaignId]);

  /* ── Derived ─────────────────────────────────────────────── */

  const myRole: 'game_master' | 'player' | 'spectator' | null = useMemo(() => {
    if (!user) return null;
    if (campaign?.gm_id === user.id) return 'game_master';
    const m = members.find(m => m.user_id === user.id && m.status === 'active');
    return (m?.role ?? null) as any;
  }, [user, campaign?.gm_id, members]);

  const isGm = myRole === 'game_master';

  const myCharacter = useMemo(
    () => characters.find(c => c.owner_id === user?.id && !c.is_retired) ?? null,
    [characters, user?.id],
  );

  const currentScene = useMemo(
    () => scenes.find(s => s.id === campaign?.current_scene_id)
        ?? scenes.find(s => s.status === 'active')
        ?? null,
    [scenes, campaign?.current_scene_id],
  );

  /* ── Mutators: messages ──────────────────────────────────── */

  const postMessage = useCallback(async (input: PostMessageInput): Promise<Message | null> => {
    if (!user || !campaignId) return null;
    const row = {
      campaign_id: campaignId,
      scene_id: input.scene_id ?? currentScene?.id ?? null,
      sender_id: user.id,
      character_id: input.character_id ?? null,
      message_type: input.message_type,
      body: input.body,
      visibility: input.visibility ?? 'public',
      metadata: input.metadata ?? {},
    };
    const { data, error: err } = await (supabase as any)
      .from('narrative_messages').insert(row).select('*').single();
    if (err) { setError(err.message); return null; }
    return data as Message;
  }, [user, campaignId, currentScene?.id]);

  const rollDice = useCallback(async (input: RollDiceInput): Promise<Message | null> => {
    if (!user || !campaignId) return null;
    const result = rollChronicle({
      stat: input.stat,
      statValue: input.statValue,
      modifier: input.modifier ?? 0,
      difficulty: input.difficulty ?? 0,
      advantage: input.advantage ?? 'none',
    });
    // 1. Insert message of type dice_roll with metadata payload
    const messageRow = {
      campaign_id: campaignId,
      scene_id: input.scene_id ?? currentScene?.id ?? null,
      sender_id: user.id,
      character_id: input.character_id ?? null,
      message_type: 'dice_roll' as MessageType,
      body: input.reason ?? null,
      visibility: input.visibility ?? 'public',
      metadata: {
        stat: input.stat,
        stat_value: input.statValue,
        modifier: input.modifier ?? 0,
        difficulty: input.difficulty ?? 0,
        advantage: input.advantage ?? 'none',
        d20: result.d20,
        secondary_d20: result.secondaryD20 ?? null,
        total: result.total,
        outcome: result.outcome,
        outcome_label: result.outcomeLabel,
      },
    };
    const { data: msg, error: msgErr } = await (supabase as any)
      .from('narrative_messages').insert(messageRow).select('*').single();
    if (msgErr || !msg) { setError(msgErr?.message ?? 'roll failed'); return null; }
    // 2. Insert dedicated roll row for analytics
    await (supabase as any).from('narrative_rolls').insert({
      campaign_id: campaignId,
      scene_id: messageRow.scene_id,
      message_id: msg.id,
      roller_id: user.id,
      character_id: input.character_id ?? null,
      stat: input.stat,
      modifier: input.modifier ?? 0,
      difficulty: input.difficulty ?? 0,
      advantage: input.advantage ?? 'none',
      d20: result.d20,
      total: result.total,
      outcome: result.outcome,
      reason: input.reason ?? null,
      visibility: input.visibility ?? 'public',
    });
    return msg as Message;
  }, [user, campaignId, currentScene?.id]);

  /* ── Mutators: character ─────────────────────────────────── */

  const createCharacter = useCallback(async (c: Omit<Character, 'id' | 'created_at' | 'updated_at' | 'campaign_id' | 'owner_id' | 'is_retired'>): Promise<Character | null> => {
    if (!user || !campaignId) return null;
    const row = { ...c, campaign_id: campaignId, owner_id: user.id, is_retired: false };
    const { data, error: err } = await (supabase as any)
      .from('narrative_characters').insert(row).select('*').single();
    if (err) { setError(err.message); return null; }
    await refresh();
    return data as Character;
  }, [user, campaignId, refresh]);

  const updateCharacter = useCallback(async (id: string, patch: Partial<Character>): Promise<boolean> => {
    const { error: err } = await (supabase as any)
      .from('narrative_characters').update(patch).eq('id', id);
    if (err) { setError(err.message); return false; }
    await refresh();
    return true;
  }, [refresh]);

  /* ── Mutators: GM ────────────────────────────────────────── */

  const createScene = useCallback(async (input: Parameters<UseNarrativeCampaignResult['createScene']>[0]) => {
    if (!user || !campaignId) return null;
    const { data, error: err } = await (supabase as any)
      .from('narrative_scenes').insert({
        campaign_id: campaignId,
        title: input.title,
        location: input.location ?? null,
        stakes: input.stakes ?? null,
        objective: input.objective ?? null,
        public_notes: input.public_notes ?? null,
        gm_notes: input.gm_notes ?? null,
        status: 'active',
        position: scenes.length,
        created_by: user.id,
      }).select('*').single();
    if (err || !data) { setError(err?.message ?? 'scene create failed'); return null; }
    // Make it the current scene
    await (supabase as any).from('narrative_campaigns')
      .update({ current_scene_id: data.id }).eq('id', campaignId);
    // System message
    await (supabase as any).from('narrative_messages').insert({
      campaign_id: campaignId,
      scene_id: data.id,
      sender_id: user.id,
      message_type: 'scene_card',
      body: input.title,
      visibility: 'public',
      metadata: { location: input.location ?? null, objective: input.objective ?? null, stakes: input.stakes ?? null },
    });
    await refresh();
    return data as Scene;
  }, [user, campaignId, scenes.length, refresh]);

  const endScene = useCallback(async (sceneId: string): Promise<boolean> => {
    const { error: err } = await (supabase as any).from('narrative_scenes')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', sceneId);
    if (err) { setError(err.message); return false; }
    await refresh();
    return true;
  }, [refresh]);

  const advanceClock = useCallback(async (clockId: string, delta: number, note?: string): Promise<boolean> => {
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return false;
    const next = Math.max(0, Math.min(clock.max_value, clock.current_value + delta));
    const hist = Array.isArray(clock.history) ? clock.history : [];
    const { error: err } = await (supabase as any).from('narrative_clocks')
      .update({
        current_value: next,
        history: [...hist, { at: new Date().toISOString(), delta, to: next, note: note ?? null }],
      })
      .eq('id', clockId);
    if (err) { setError(err.message); return false; }
    // Public clocks emit a system message; gm_only stay silent.
    if (clock.visibility === 'public' && campaignId && user) {
      await (supabase as any).from('narrative_messages').insert({
        campaign_id: campaignId,
        scene_id: currentScene?.id ?? null,
        sender_id: user.id,
        message_type: 'clock_update',
        body: `${clock.name}: ${next}/${clock.max_value}`,
        visibility: 'public',
        metadata: { clock_id: clockId, from: clock.current_value, to: next, note: note ?? null },
      });
    }
    return true;
  }, [clocks, campaignId, user, currentScene?.id]);

  const createClock = useCallback(async (input: Parameters<UseNarrativeCampaignResult['createClock']>[0]) => {
    if (!user || !campaignId) return null;
    const { data, error: err } = await (supabase as any).from('narrative_clocks').insert({
      campaign_id: campaignId,
      name: input.name,
      description: input.description ?? null,
      current_value: 0,
      max_value: input.max_value,
      clock_type: input.clock_type,
      visibility: input.visibility,
      created_by: user.id,
    }).select('*').single();
    if (err) { setError(err.message); return null; }
    await refresh();
    return data as Clock;
  }, [user, campaignId, refresh]);

  // Generic helper for the simple "create row" GM ops below.
  const createInTable = useCallback(async <T extends { id?: string }>(table: string, payload: Record<string, unknown>): Promise<T | null> => {
    if (!campaignId) return null;
    const { data, error: err } = await (supabase as any).from(table)
      .insert({ campaign_id: campaignId, ...payload })
      .select('*').single();
    if (err) { setError(err.message); return null; }
    await refresh();
    return data as T;
  }, [campaignId, refresh]);

  const createNpc      = useCallback((i: Partial<NPC> & { name: string })      => createInTable<NPC>('narrative_npcs', i),                              [createInTable]);
  const createClue     = useCallback((i: Partial<Clue> & { name: string })     => createInTable<Clue>('narrative_clues', i),                            [createInTable]);
  const createFaction  = useCallback((i: Partial<Faction> & { name: string })  => createInTable<Faction>('narrative_factions', i),                      [createInTable]);
  const createItem     = useCallback((i: Partial<Item> & { name: string })     => createInTable<Item>('narrative_items', i),                            [createInTable]);
  const createLocation = useCallback((i: Partial<NarrativeLocation> & { name: string }) => createInTable<NarrativeLocation>('narrative_locations', i), [createInTable]);

  return {
    campaign, myRole, isGm,
    members, characters, myCharacter, currentScene, scenes,
    messages, npcs, factions, clocks, clues, items, locations,
    aiSuggestions,
    loading, error, refresh,
    postMessage, rollDice,
    createCharacter, updateCharacter,
    createScene, endScene, advanceClock, createClock,
    createNpc, createClue, createFaction, createItem, createLocation,
  };
}
