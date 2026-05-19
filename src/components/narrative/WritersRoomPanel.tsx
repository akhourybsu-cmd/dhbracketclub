// DH Club — Narrative RPG · Writer's Room / AI Co-GM
//
// Replaces the old "AI Tools" tab inside the GM Console with a full
// Writer's Room. Workflow:
//
//   1. GM picks a writing tool (10 core tools — scene opener, continue,
//      NPC response, resolve roll, consequences, reveal clue, escalate,
//      end scene, chapter transition, summarize scene → memory).
//   2. Per-tool inputs (NPC focus, clue focus, reveal mode, etc.).
//   3. Tone chips (8 base + 8 Flamingo specials when applicable).
//   4. Length chips (5 sizes).
//   5. Safety toggles (defaults baked in, GM can relax for trusted prompts).
//   6. Free-text GM direction.
//   7. Generate → AI returns a draft card.
//
// Draft card supports inline editing, regeneration, one-click
// transformations (shorten / expand / more cinematic / funnier / more
// tense / more subtle / add Flamingo flavor / remove spoilers / convert
// to NPC / convert to GM / add player prompt), post-to-story, save-to-
// notes, add-to-memory, and approve/reject suggested state updates.
//
// AI never posts automatically. Every state update requires explicit
// GM approval before applyStateUpdates() touches the database.

import { useMemo, useState } from 'react';
import {
  Sparkles, Loader2, Wand2, Send, Save, BookPlus, RefreshCw, Check, X,
  Trash2, FileText, Megaphone, MessageCircle, Bookmark, Film, AlertOctagon,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import {
  invokeGmTool, isAiConfigured, WRITERS_ROOM_TOOL_KEYS, GM_TOOLS,
  type GmToolKey, type AiSuggestion, type WriterControls,
  type WriterTone, type WriterLength, type WriterSafety,
  type WriterTransformation, type StateUpdateAction,
} from '@/lib/narrative/aiService';
import { applyStateUpdates, describeAction } from '@/lib/narrative/applyStateUpdates';
import { isFlamingoCampaign, FLAMINGO } from '@/lib/narrative/flamingoTheme';
import type { Campaign, NPC, Clue, Scene } from '@/lib/narrative/types';

interface Props {
  campaign: Campaign;
  currentScene: Scene | null;
  npcs: NPC[];
  clues: Clue[];
  onChanged?: () => void;
}

// ──────────────────────────────────────────────────────────────────────
// Chip groups
// ──────────────────────────────────────────────────────────────────────

const BASE_TONES: { id: WriterTone; label: string }[] = [
  { id: 'cinematic',      label: 'Cinematic' },
  { id: 'funny',          label: 'Funny' },
  { id: 'dangerous',      label: 'Dangerous' },
  { id: 'subtle',         label: 'Subtle' },
  { id: 'chaotic',        label: 'Chaotic' },
  { id: 'noir',           label: 'Noir' },
  { id: 'conversational', label: 'Conversational' },
  { id: 'high_drama',     label: 'High drama' },
];

const FLAMINGO_TONES: { id: WriterTone; label: string }[] = [
  { id: 'more_flamingo',     label: 'More Flamingo' },
  { id: 'more_velvetaine',   label: 'More Velvetaine' },
  { id: 'more_miami_vice',   label: 'More Miami Vice' },
  { id: 'more_casino',       label: 'More casino/studio' },
  { id: 'more_catalina',     label: 'More Catalina' },
  { id: 'more_tony_pressure',label: 'More Tony pressure' },
  { id: 'more_tape_tension', label: 'More tape tension' },
  { id: 'more_chaos',        label: 'More chaos' },
];

const LENGTHS: { id: WriterLength; label: string }[] = [
  { id: 'one_liner', label: 'One-liner' },
  { id: 'short',     label: 'Short' },
  { id: 'medium',    label: 'Medium' },
  { id: 'long',      label: 'Long' },
  { id: 'monologue', label: 'Monologue' },
];

const SAFETY: { id: WriterSafety; label: string; defaultOn: boolean }[] = [
  { id: 'no_reveal_gm_notes',     label: 'Protect GM notes',           defaultOn: true  },
  { id: 'no_reveal_hidden_clues', label: 'Protect hidden clues',       defaultOn: true  },
  { id: 'no_speak_for_players',   label: "Don't speak for players",    defaultOn: true  },
  { id: 'no_resolve_without_roll',label: "Don't auto-resolve actions", defaultOn: true  },
  { id: 'keep_mystery',           label: 'Keep mystery open',          defaultOn: false },
  { id: 'protect_secrets',        label: 'Protect selected secrets',   defaultOn: false },
];

const TRANSFORMS: { id: WriterTransformation; label: string }[] = [
  { id: 'shorten',             label: 'Shorten' },
  { id: 'expand',              label: 'Expand' },
  { id: 'more_cinematic',      label: 'More cinematic' },
  { id: 'funnier',             label: 'Funnier' },
  { id: 'more_tense',          label: 'More tense' },
  { id: 'more_subtle',         label: 'More subtle' },
  { id: 'remove_spoilers',     label: 'Remove spoilers' },
  { id: 'to_npc_dialogue',     label: 'As NPC dialogue' },
  { id: 'to_gm_narration',     label: 'As GM narration' },
  { id: 'add_player_prompt',   label: 'Add player prompt' },
];

const FLAMINGO_TRANSFORMS: { id: WriterTransformation; label: string }[] = [
  { id: 'add_flamingo_flavor', label: 'Add Flamingo flavor' },
];

// ──────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────

interface ReviewAction {
  action: StateUpdateAction;
  approved: boolean;
}

export function WritersRoomPanel({ campaign, currentScene, npcs, clues, onChanged }: Props) {
  const flamingo = isFlamingoCampaign(campaign.template_key);
  const configured = isAiConfigured();

  const [toolKey, setToolKey] = useState<GmToolKey>('write_scene_opener');
  const toolMeta = useMemo(() => GM_TOOLS.find(t => t.key === toolKey)!, [toolKey]);

  // Control surface
  const [tone, setTone] = useState<WriterTone | null>(flamingo ? 'cinematic' : 'cinematic');
  const [length, setLength] = useState<WriterLength>('medium');
  const [safety, setSafety] = useState<Set<WriterSafety>>(() => new Set(SAFETY.filter(s => s.defaultOn).map(s => s.id)));
  const [direction, setDirection] = useState('');
  const [npcId, setNpcId] = useState<string | null>(null);
  const [npcIntent, setNpcIntent] = useState('');
  const [clueId, setClueId] = useState<string | null>(null);
  const [revealMode, setRevealMode] = useState<'subtle' | 'direct'>('subtle');
  const [consequenceNote, setConsequenceNote] = useState('');

  // Draft state
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [rationale, setRationale] = useState<string | null>(null);
  const [actions, setActions] = useState<ReviewAction[]>([]);
  const [posting, setPosting] = useState<'idle' | 'posting' | 'saving' | 'memory'>('idle');
  const [transformBusy, setTransformBusy] = useState<WriterTransformation | null>(null);

  // ──────────────────────────────────────────────────────────────────
  // Generate
  // ──────────────────────────────────────────────────────────────────

  const buildControls = (): WriterControls => ({
    tone: tone ?? undefined,
    length,
    safety: Array.from(safety),
    direction: direction.trim() || undefined,
    npcId: npcId,
    npcIntent: npcIntent.trim() || undefined,
    clueId,
    revealMode,
    consequenceNote: consequenceNote.trim() || undefined,
  });

  const runTool = async (overrideTool?: GmToolKey, overrideControls?: Partial<WriterControls>) => {
    if (!configured) { toast.error('AI provider not configured.'); return; }
    setBusy(true);
    try {
      const result = await invokeGmTool(
        overrideTool ?? toolKey,
        { campaignId: campaign.id },
        { ...buildControls(), ...overrideControls },
      );
      if ('available' in result && result.available === false) {
        toast.error(result.reason);
        return;
      }
      const sug = result as AiSuggestion;
      setDraft(sug.draft ?? '');
      setRationale(sug.rationale ?? null);
      setActions((sug.stateUpdates ?? []).map(a => ({ action: a, approved: false })));
    } finally {
      setBusy(false);
    }
  };

  const transform = async (t: WriterTransformation) => {
    if (!draft.trim()) { toast.error('Generate a draft first.'); return; }
    setTransformBusy(t);
    try {
      await runTool('transform_draft', {
        transformation: t,
        originalDraft: draft,
      });
    } finally {
      setTransformBusy(null);
    }
  };

  // ──────────────────────────────────────────────────────────────────
  // Actions on the draft card
  // ──────────────────────────────────────────────────────────────────

  const postToStory = async () => {
    if (!draft.trim()) return;
    setPosting('posting');
    try {
      const { data: claims } = await supabase.auth.getUser();
      const messageType = toolMeta.defaultMessageType ?? 'gm_narration';
      const { error } = await (supabase as any).from('narrative_messages').insert({
        campaign_id: campaign.id,
        scene_id: currentScene?.id ?? null,
        sender_id: claims.user?.id ?? null,
        message_type: messageType,
        body: draft.trim(),
        visibility: 'public',
        metadata: { ai_drafted: true, tool: toolKey },
      });
      if (error) throw error;

      // If the GM approved any state updates, apply them now.
      const approved = actions.filter(a => a.approved).map(a => a.action);
      if (approved.length > 0) {
        const results = await applyStateUpdates(campaign.id, approved);
        const failed = results.filter(r => !r.ok);
        if (failed.length) {
          toast.warning(`Posted. Applied ${results.length - failed.length} of ${results.length} state updates.`);
        } else {
          toast.success(`Posted. Applied ${results.length} state update${results.length === 1 ? '' : 's'}.`);
        }
      } else {
        toast.success('Posted to story.');
      }
      onChanged?.();
      // Reset card after a successful post so the GM doesn't accidentally re-post.
      resetDraft();
    } catch (e) {
      toast.error(`Post failed: ${(e as Error).message}`);
    } finally {
      setPosting('idle');
    }
  };

  const saveToNotes = async () => {
    if (!draft.trim()) return;
    setPosting('saving');
    try {
      const { data: claims } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from('narrative_gm_notes').insert({
        campaign_id: campaign.id,
        scene_id: currentScene?.id ?? null,
        author_id: claims.user?.id ?? null,
        title: `Writer's Room draft · ${toolMeta.label}`,
        body: draft.trim(),
      });
      if (error) throw error;
      toast.success('Saved to GM notes.');
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setPosting('idle');
    }
  };

  const addToMemory = async () => {
    if (!draft.trim()) return;
    setPosting('memory');
    try {
      const prefix = campaign.memory_summary ? campaign.memory_summary + '\n\n' : '';
      const { error } = await (supabase as any)
        .from('narrative_campaigns')
        .update({ memory_summary: prefix + draft.trim() })
        .eq('id', campaign.id);
      if (error) throw error;
      toast.success('Appended to campaign memory.');
      onChanged?.();
    } catch (e) {
      toast.error(`Memory update failed: ${(e as Error).message}`);
    } finally {
      setPosting('idle');
    }
  };

  const approveAllStateUpdates = async () => {
    if (actions.length === 0) return;
    setPosting('posting');
    try {
      const approved = actions.map(a => a.action);
      const results = await applyStateUpdates(campaign.id, approved);
      const failed = results.filter(r => !r.ok);
      if (failed.length) {
        toast.warning(`Applied ${results.length - failed.length} of ${results.length}.`);
      } else {
        toast.success(`Applied ${results.length} state update${results.length === 1 ? '' : 's'}.`);
      }
      onChanged?.();
      setActions([]);
    } catch (e) {
      toast.error(`Apply failed: ${(e as Error).message}`);
    } finally {
      setPosting('idle');
    }
  };

  const resetDraft = () => {
    setDraft('');
    setRationale(null);
    setActions([]);
  };

  // ──────────────────────────────────────────────────────────────────
  // Render helpers
  // ──────────────────────────────────────────────────────────────────

  const chip = (active: boolean, kind: 'tone' | 'length' | 'safety' | 'transform' = 'tone') => {
    const accent = kind === 'transform' ? FLAMINGO.cyan : kind === 'safety' ? FLAMINGO.gmAmber : FLAMINGO.pink;
    return active
      ? flamingo
        ? {
            background: `linear-gradient(135deg, hsl(${accent} / 0.28), hsl(${FLAMINGO.violet} / 0.15))`,
            border: `1px solid hsl(${accent} / 0.6)`,
            color: `hsl(${FLAMINGO.paper})`,
            boxShadow: `0 0 8px -2px hsl(${accent} / 0.5)`,
          } as React.CSSProperties
        : {
            background: 'hsl(var(--primary) / 0.18)',
            border: '1px solid hsl(var(--primary) / 0.4)',
            color: 'hsl(var(--primary))',
          } as React.CSSProperties
      : flamingo
        ? {
            background: `hsl(${FLAMINGO.ink} / 0.7)`,
            border: `1px solid hsl(${FLAMINGO.paper} / 0.15)`,
            color: `hsl(${FLAMINGO.paper} / 0.7)`,
          } as React.CSSProperties
        : {
            background: 'hsl(var(--muted) / 0.3)',
            border: '1px solid hsl(var(--border) / 0.4)',
            color: 'hsl(var(--muted-foreground) / 0.85)',
          } as React.CSSProperties;
  };

  if (!configured) {
    return (
      <div
        className="rounded-xl p-4 text-center"
        style={flamingo ? {
          background: `hsl(${FLAMINGO.ink} / 0.6)`,
          border: `1px dashed hsl(${FLAMINGO.pink} / 0.3)`,
        } : {
          background: 'hsl(var(--muted) / 0.25)',
          border: '1px dashed hsl(var(--border) / 0.4)',
        }}
      >
        <Wand2
          className="w-6 h-6 mx-auto mb-2"
          style={{ color: flamingo ? `hsl(${FLAMINGO.pink})` : 'hsl(var(--primary))' }}
        />
        <p className="text-[13px] font-extrabold">
          {flamingo ? "Writer's Room is offline" : 'AI Co-GM is offline'}
        </p>
        <p
          className="text-[10.5px] mt-1 leading-snug"
          style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.7)` : 'hsl(var(--muted-foreground) / 0.75)' }}
        >
          Wire <code>LOVABLE_API_KEY</code> on the narrative-ai edge function + set <code>VITE_NARRATIVE_AI_ENABLED</code> on the client to enable.
        </p>
      </div>
    );
  }

  const needsNpc = toolKey === 'npc_response';
  const needsClue = toolKey === 'reveal_clue';
  const needsConsequence = toolKey === 'resolve_roll';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4" style={{ color: flamingo ? `hsl(${FLAMINGO.pink})` : 'hsl(var(--primary))' }} />
        <h3
          className="text-[14px] font-extrabold tracking-tight"
          style={flamingo ? {
            backgroundImage: `linear-gradient(90deg, hsl(${FLAMINGO.paper}), hsl(${FLAMINGO.pink}))`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          } : undefined}
        >
          {flamingo ? "Writer's Room" : 'AI Co-GM'}
        </h3>
      </div>
      <p
        className="text-[10.5px] leading-snug"
        style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.7)` : 'hsl(var(--muted-foreground) / 0.8)' }}
      >
        You direct intent + secrets + consequences. The AI drafts prose, dialogue, and pacing. Nothing posts or mutates until you approve it.
      </p>

      {/* Tool picker */}
      <div>
        <ChipsRow label="Tool">
          {WRITERS_ROOM_TOOL_KEYS.map(k => {
            const meta = GM_TOOLS.find(t => t.key === k)!;
            const active = k === toolKey;
            return (
              <Chip key={k} onClick={() => setToolKey(k)} style={chip(active, 'tone')}>
                {meta.label}
              </Chip>
            );
          })}
        </ChipsRow>
        <p
          className="text-[10px] mt-1 leading-snug px-1"
          style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.6)` : 'hsl(var(--muted-foreground) / 0.7)' }}
        >
          {toolMeta.description}
        </p>
      </div>

      {/* Tool-specific inputs */}
      {needsNpc && (
        <div className="rounded-lg p-2 space-y-2" style={flamingo ? { background: `hsl(${FLAMINGO.ink} / 0.5)`, border: `1px solid hsl(${FLAMINGO.gold} / 0.3)` } : { background: 'hsl(var(--muted) / 0.2)', border: '1px solid hsl(var(--border) / 0.3)' }}>
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.2em]" style={{ color: flamingo ? `hsl(${FLAMINGO.gold})` : 'hsl(var(--muted-foreground) / 0.7)' }}>NPC</p>
          <select
            value={npcId ?? ''}
            onChange={e => setNpcId(e.target.value || null)}
            className="w-full h-9 rounded-md border px-2 text-[12px]"
            style={flamingo ? { background: `hsl(${FLAMINGO.midnight})`, borderColor: `hsl(${FLAMINGO.gold} / 0.4)`, color: `hsl(${FLAMINGO.paper})` } : undefined}
          >
            <option value="">— Pick an NPC —</option>
            {npcs.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <Textarea
            value={npcIntent}
            onChange={e => setNpcIntent(e.target.value)}
            placeholder="NPC intent (what they're trying to do / hide / push)"
            rows={2}
            className="text-[12px]"
          />
        </div>
      )}

      {needsClue && (
        <div className="rounded-lg p-2 space-y-2" style={flamingo ? { background: `hsl(${FLAMINGO.ink} / 0.5)`, border: `1px solid hsl(${FLAMINGO.clue} / 0.3)` } : { background: 'hsl(var(--muted) / 0.2)', border: '1px solid hsl(var(--border) / 0.3)' }}>
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.2em]" style={{ color: flamingo ? `hsl(${FLAMINGO.clue})` : 'hsl(var(--muted-foreground) / 0.7)' }}>Clue</p>
          <select
            value={clueId ?? ''}
            onChange={e => setClueId(e.target.value || null)}
            className="w-full h-9 rounded-md border px-2 text-[12px]"
            style={flamingo ? { background: `hsl(${FLAMINGO.midnight})`, borderColor: `hsl(${FLAMINGO.clue} / 0.4)`, color: `hsl(${FLAMINGO.paper})` } : undefined}
          >
            <option value="">— New clue —</option>
            {clues.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-1.5">
            {(['subtle', 'direct'] as const).map(m => (
              <Chip key={m} onClick={() => setRevealMode(m)} style={chip(revealMode === m, 'tone')}>
                {m}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {needsConsequence && (
        <Textarea
          value={consequenceNote}
          onChange={e => setConsequenceNote(e.target.value)}
          placeholder="Consequence note (what the GM wants the roll to cost or reward)"
          rows={2}
          className="text-[12px]"
        />
      )}

      {/* Tone */}
      <ChipsRow label="Tone">
        {(flamingo ? [...BASE_TONES, ...FLAMINGO_TONES] : BASE_TONES).map(t => (
          <Chip key={t.id} onClick={() => setTone(prev => prev === t.id ? null : t.id)} style={chip(tone === t.id, 'tone')}>
            {t.label}
          </Chip>
        ))}
      </ChipsRow>

      {/* Length */}
      <ChipsRow label="Length">
        {LENGTHS.map(l => (
          <Chip key={l.id} onClick={() => setLength(l.id)} style={chip(length === l.id, 'tone')}>
            {l.label}
          </Chip>
        ))}
      </ChipsRow>

      {/* Safety */}
      <ChipsRow label="Safety">
        {SAFETY.map(s => (
          <Chip
            key={s.id}
            onClick={() => setSafety(prev => {
              const n = new Set(prev);
              if (n.has(s.id)) n.delete(s.id); else n.add(s.id);
              return n;
            })}
            style={chip(safety.has(s.id), 'safety')}
          >
            {s.label}
          </Chip>
        ))}
      </ChipsRow>

      {/* GM direction */}
      <div>
        <p
          className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] mb-1.5"
          style={{ color: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--muted-foreground) / 0.7)' }}
        >
          GM direction
        </p>
        <Textarea
          value={direction}
          onChange={e => setDirection(e.target.value)}
          placeholder="What do you want? e.g. 'Open with Catalina entering through the kitchen — Tony notices, Boilon doesn't.'"
          rows={3}
          className="text-[12.5px]"
        />
      </div>

      {/* Generate */}
      <button
        type="button"
        onClick={() => runTool()}
        disabled={busy}
        className="w-full h-11 rounded-xl text-[12.5px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-55"
        style={flamingo ? {
          background: `linear-gradient(135deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.violet}))`,
          color: `hsl(${FLAMINGO.paper})`,
          boxShadow: `0 0 16px -3px hsl(${FLAMINGO.pink} / 0.6)`,
          border: `1px solid hsl(${FLAMINGO.pink})`,
        } : {
          background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
          color: 'hsl(var(--primary-foreground))',
        }}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {busy ? 'Drafting…' : (draft ? 'Regenerate' : 'Generate draft')}
      </button>

      {/* Draft card */}
      {draft && (
        <DraftCard
          flamingo={flamingo}
          draft={draft}
          setDraft={setDraft}
          rationale={rationale}
          actions={actions}
          setActions={setActions}
          toolLabel={toolMeta.label}
          messageType={toolMeta.defaultMessageType ?? 'gm_narration'}
          posting={posting}
          onPost={postToStory}
          onSaveNotes={saveToNotes}
          onAddMemory={addToMemory}
          onApproveStateUpdates={approveAllStateUpdates}
          onDiscard={resetDraft}
          onTransform={transform}
          transformBusy={transformBusy}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Sub-pieces
// ──────────────────────────────────────────────────────────────────────

function ChipsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] mb-1.5 opacity-70"
      >
        {label}
      </p>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function Chip({ onClick, children, style }: { onClick: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center h-7 px-2.5 rounded-lg text-[10.5px] font-extrabold uppercase tracking-wider active:scale-95 transition"
      style={style}
    >
      {children}
    </button>
  );
}

interface DraftCardProps {
  flamingo: boolean;
  draft: string;
  setDraft: (s: string) => void;
  rationale: string | null;
  actions: ReviewAction[];
  setActions: React.Dispatch<React.SetStateAction<ReviewAction[]>>;
  toolLabel: string;
  messageType: string;
  posting: 'idle' | 'posting' | 'saving' | 'memory';
  onPost: () => void;
  onSaveNotes: () => void;
  onAddMemory: () => void;
  onApproveStateUpdates: () => void;
  onDiscard: () => void;
  onTransform: (t: WriterTransformation) => void;
  transformBusy: WriterTransformation | null;
}

function DraftCard({
  flamingo, draft, setDraft, rationale, actions, setActions,
  toolLabel, messageType, posting, onPost, onSaveNotes, onAddMemory,
  onApproveStateUpdates, onDiscard, onTransform, transformBusy,
}: DraftCardProps) {
  const MessageIcon = messageType === 'npc_dialogue'
    ? MessageCircle
    : messageType === 'chapter_transition'
      ? Bookmark
      : messageType === 'campaign_summary'
        ? Film
        : messageType === 'system'
          ? AlertOctagon
          : Megaphone;

  return (
    <div
      className="rounded-2xl p-3 relative overflow-hidden"
      style={flamingo ? {
        background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
        border: `1px solid hsl(${FLAMINGO.pink} / 0.45)`,
        boxShadow: `0 0 16px -4px hsl(${FLAMINGO.pink} / 0.5)`,
        color: `hsl(${FLAMINGO.paper})`,
      } : {
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--primary) / 0.35)',
      }}
    >
      {flamingo && (
        <div
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: `linear-gradient(180deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.cyan}))` }}
        />
      )}
      <div className={flamingo ? 'pl-2' : ''}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <MessageIcon className="w-3 h-3" style={{ color: flamingo ? `hsl(${FLAMINGO.pink})` : 'hsl(var(--primary))' }} />
          <p
            className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: flamingo ? `hsl(${FLAMINGO.pink})` : 'hsl(var(--primary))' }}
          >
            {toolLabel} · {messageType.replace('_', ' ')}
          </p>
        </div>

        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={Math.min(12, Math.max(4, draft.split('\n').length + 1))}
          className="text-[12.5px] leading-snug"
        />

        {rationale && (
          <p
            className="text-[10px] italic mt-1.5 leading-snug"
            style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.6)` : 'hsl(var(--muted-foreground) / 0.75)' }}
          >
            AI rationale — {rationale}
          </p>
        )}

        {/* Transformation chips */}
        <div className="mt-2.5">
          <p
            className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] mb-1.5"
            style={{ color: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--muted-foreground) / 0.7)' }}
          >
            Transform
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {([...TRANSFORMS, ...(flamingo ? FLAMINGO_TRANSFORMS : [])]).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTransform(t.id)}
                disabled={transformBusy !== null}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10.5px] font-extrabold uppercase tracking-wider active:scale-95 transition disabled:opacity-50"
                style={flamingo ? {
                  background: `hsl(${FLAMINGO.ink} / 0.7)`,
                  border: `1px solid hsl(${FLAMINGO.cyan} / 0.4)`,
                  color: `hsl(${FLAMINGO.cyan})`,
                } : {
                  background: 'hsl(var(--muted) / 0.4)',
                  border: '1px solid hsl(var(--border) / 0.4)',
                }}
              >
                {transformBusy === t.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* State updates */}
        {actions.length > 0 && (
          <div className="mt-2.5">
            <p
              className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] mb-1.5"
              style={{ color: flamingo ? `hsl(${FLAMINGO.gmAmber})` : 'hsl(var(--warning))' }}
            >
              Suggested state updates · {actions.filter(a => a.approved).length} of {actions.length} approved
            </p>
            <div className="space-y-1.5">
              {actions.map((a, i) => (
                <div
                  key={i}
                  className="rounded-lg p-2 flex items-start gap-2"
                  style={a.approved
                    ? flamingo
                      ? { background: `hsl(${FLAMINGO.cyan} / 0.1)`, border: `1px solid hsl(${FLAMINGO.cyan} / 0.45)` }
                      : { background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.4)' }
                    : flamingo
                      ? { background: `hsl(${FLAMINGO.ink} / 0.6)`, border: `1px solid hsl(${FLAMINGO.paper} / 0.15)`, opacity: 0.7 }
                      : { background: 'hsl(var(--muted) / 0.25)', border: '1px solid hsl(var(--border) / 0.3)', opacity: 0.7 }
                  }
                >
                  <button
                    type="button"
                    onClick={() => setActions(prev => prev.map((p, j) => j === i ? { ...p, approved: !p.approved } : p))}
                    aria-label={a.approved ? 'Unapprove' : 'Approve'}
                    className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center border mt-0.5"
                    style={a.approved
                      ? { background: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--primary))', borderColor: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--primary))', color: flamingo ? `hsl(${FLAMINGO.midnight})` : 'hsl(var(--primary-foreground))' }
                      : { background: 'transparent', borderColor: flamingo ? `hsl(${FLAMINGO.paper} / 0.3)` : 'hsl(var(--border))' }
                    }
                  >
                    {a.approved && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-extrabold">{describeAction(a.action)}</p>
                    <p
                      className="text-[10px] break-words mt-0.5"
                      style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.65)` : 'hsl(var(--muted-foreground) / 0.75)' }}
                    >
                      {JSON.stringify(a.action.payload, null, 0)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActions(prev => prev.filter((_, j) => j !== i))}
                    aria-label="Remove"
                    className="flex-shrink-0 w-6 h-6 rounded-md inline-flex items-center justify-center opacity-50 hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action row */}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onPost}
            disabled={posting !== 'idle' || !draft.trim()}
            className="col-span-2 h-10 rounded-lg text-[11.5px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-55"
            style={flamingo ? {
              background: `linear-gradient(135deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.violet}))`,
              color: `hsl(${FLAMINGO.paper})`,
              boxShadow: `0 0 12px -3px hsl(${FLAMINGO.pink} / 0.6)`,
            } : {
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
              color: 'hsl(var(--primary-foreground))',
            }}
          >
            {posting === 'posting' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Post to story{actions.some(a => a.approved) ? ` + apply ${actions.filter(a => a.approved).length}` : ''}
          </button>
          <button
            type="button"
            onClick={onSaveNotes}
            disabled={posting !== 'idle' || !draft.trim()}
            className="h-9 rounded-lg text-[10.5px] font-bold inline-flex items-center justify-center gap-1 active:scale-[0.98] transition disabled:opacity-55"
            style={flamingo ? { background: `hsl(${FLAMINGO.ink})`, border: `1px solid hsl(${FLAMINGO.gmAmber} / 0.4)`, color: `hsl(${FLAMINGO.gmAmber})` } : { background: 'hsl(var(--muted) / 0.4)', border: '1px solid hsl(var(--border) / 0.4)' }}
          >
            {posting === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save to notes
          </button>
          <button
            type="button"
            onClick={onAddMemory}
            disabled={posting !== 'idle' || !draft.trim()}
            className="h-9 rounded-lg text-[10.5px] font-bold inline-flex items-center justify-center gap-1 active:scale-[0.98] transition disabled:opacity-55"
            style={flamingo ? { background: `hsl(${FLAMINGO.ink})`, border: `1px solid hsl(${FLAMINGO.cyan} / 0.4)`, color: `hsl(${FLAMINGO.cyan})` } : { background: 'hsl(var(--muted) / 0.4)', border: '1px solid hsl(var(--border) / 0.4)' }}
          >
            {posting === 'memory' ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookPlus className="w-3 h-3" />}
            Add to memory
          </button>
          {actions.length > 0 && actions.some(a => a.approved) && (
            <button
              type="button"
              onClick={onApproveStateUpdates}
              disabled={posting !== 'idle'}
              className="col-span-2 h-9 rounded-lg text-[10.5px] font-extrabold inline-flex items-center justify-center gap-1 active:scale-[0.98] transition disabled:opacity-55"
              style={flamingo ? { background: `hsl(${FLAMINGO.cyan} / 0.18)`, border: `1px solid hsl(${FLAMINGO.cyan} / 0.5)`, color: `hsl(${FLAMINGO.cyan})` } : { background: 'hsl(var(--success) / 0.12)', border: '1px solid hsl(var(--success) / 0.4)', color: 'hsl(var(--success))' }}
            >
              <Check className="w-3 h-3" /> Apply approved state updates without posting
            </button>
          )}
          <button
            type="button"
            onClick={onDiscard}
            className="col-span-2 h-8 rounded-lg text-[10px] font-bold inline-flex items-center justify-center gap-1 opacity-70 active:opacity-100 transition"
          >
            <X className="w-3 h-3" /> Discard draft
          </button>
        </div>
      </div>
    </div>
  );
}
