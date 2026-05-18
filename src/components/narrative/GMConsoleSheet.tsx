// DH Club — Narrative RPG · Game Master Console
//
// Portaled side-drawer with the GM's full toolkit organized into tabs:
//   Scene · NPCs · Clues · Items · Factions · Clocks · Memory · Notes · AI
// Players never see this drawer — visibility is enforced by both the
// caller and RLS on each underlying table.
//
// AI Tools tab calls the typed stubs in lib/narrative/aiService — when
// no provider is configured, each button shows a clear "AI not
// configured" message instead of failing silently.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X, Megaphone, Users, KeyRound, Backpack, ShieldAlert, Clock as ClockIcon,
  BookOpenText, StickyNote, Sparkles, PlusCircle, AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { StatusPill } from '@/components/ui/status-pill';
import { ClockCard } from './ClockCard';
import { GM_TOOLS, isAiConfigured } from '@/lib/narrative/aiService';
import type {
  Campaign, Scene, NPC, Clue, Faction, Clock, Item, Location as NarrativeLocation, AiSuggestionRow,
} from '@/lib/narrative/types';

type TabKey = 'scene' | 'npcs' | 'clues' | 'items' | 'factions' | 'clocks' | 'memory' | 'notes' | 'ai';

const TABS: { key: TabKey; label: string; icon: typeof Megaphone }[] = [
  { key: 'scene',    label: 'Scene',    icon: Megaphone },
  { key: 'npcs',     label: 'NPCs',     icon: Users },
  { key: 'clues',    label: 'Clues',    icon: KeyRound },
  { key: 'items',    label: 'Items',    icon: Backpack },
  { key: 'factions', label: 'Factions', icon: ShieldAlert },
  { key: 'clocks',   label: 'Clocks',   icon: ClockIcon },
  { key: 'memory',   label: 'Memory',   icon: BookOpenText },
  { key: 'notes',    label: 'Notes',    icon: StickyNote },
  { key: 'ai',       label: 'AI',       icon: Sparkles },
];

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  currentScene: Scene | null;
  scenes: Scene[];
  npcs: NPC[];
  clues: Clue[];
  items: Item[];
  factions: Faction[];
  clocks: Clock[];
  locations: NarrativeLocation[];
  aiSuggestions: AiSuggestionRow[];
  onCreateScene: (input: { title: string; location?: string; stakes?: string; objective?: string; public_notes?: string; gm_notes?: string }) => Promise<unknown>;
  onEndScene: (sceneId: string) => Promise<unknown>;
  onAdvanceClock: (clockId: string, delta: number, note?: string) => Promise<unknown>;
  onCreateClock: (input: { name: string; description?: string; max_value: number; clock_type: Clock['clock_type']; visibility: 'public' | 'gm_only' }) => Promise<unknown>;
  onCreateNpc: (input: { name: string; role?: string; description?: string; visibility?: 'public' | 'gm_only' }) => Promise<unknown>;
  onCreateClue: (input: { name: string; description?: string; visibility?: 'public' | 'gm_only'; importance?: 'low' | 'normal' | 'high' }) => Promise<unknown>;
  onCreateFaction: (input: { name: string; description?: string; visibility?: 'public' | 'gm_only' }) => Promise<unknown>;
  onCreateItem: (input: { name: string; description?: string; visibility?: 'public' | 'gm_only' }) => Promise<unknown>;
}

export function GMConsoleSheet(props: Props) {
  const { open, onClose } = props;
  const [tab, setTab] = useState<TabKey>('scene');

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex"
      style={{ background: 'hsl(218 50% 3% / 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div className="flex-1" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="w-full sm:w-[420px] h-full flex flex-col bg-card border-l border-border/40 overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/25 flex-shrink-0">
          <div>
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70">Game Master</p>
            <h2 className="text-[15px] font-extrabold tracking-tight">GM Console</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg bg-muted/40 active:scale-90 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab strip */}
        <div className="px-2 py-2 border-b border-border/15 flex-shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-1">
            {TABS.map(t => {
              const Icon = t.icon;
              const selected = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex-shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[10.5px] font-extrabold uppercase tracking-wider transition ${
                    selected ? 'bg-primary/15 text-primary border border-primary/35' : 'bg-muted/25 border border-border/40 text-muted-foreground/75'
                  }`}
                >
                  <Icon className="w-3 h-3" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === 'scene'    && <SceneTab {...props} />}
          {tab === 'npcs'     && <NpcsTab {...props} />}
          {tab === 'clues'    && <CluesTab {...props} />}
          {tab === 'items'    && <ItemsTab {...props} />}
          {tab === 'factions' && <FactionsTab {...props} />}
          {tab === 'clocks'   && <ClocksTab {...props} />}
          {tab === 'memory'   && <MemoryTab {...props} />}
          {tab === 'notes'    && <NotesTab {...props} />}
          {tab === 'ai'       && <AiTab {...props} />}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/* ─── Scene tab ───────────────────────────────────────────────── */

function SceneTab({ currentScene, onCreateScene, onEndScene }: Props) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [objective, setObjective] = useState('');
  const [stakes, setStakes] = useState('');
  const [publicNotes, setPublicNotes] = useState('');
  const [gmNotes, setGmNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error('Give the scene a title.'); return; }
    setBusy(true);
    await onCreateScene({
      title: title.trim(),
      location: location.trim() || undefined,
      objective: objective.trim() || undefined,
      stakes: stakes.trim() || undefined,
      public_notes: publicNotes.trim() || undefined,
      gm_notes: gmNotes.trim() || undefined,
    });
    setBusy(false);
    setTitle(''); setLocation(''); setObjective(''); setStakes(''); setPublicNotes(''); setGmNotes('');
    toast.success('Scene started.');
  };

  return (
    <div className="space-y-4">
      {currentScene && (
        <div className="rounded-2xl border border-gold/30 p-3" style={{ background: 'hsl(var(--gold) / 0.06)' }}>
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-gold">Active scene</p>
          <h3 className="text-[14px] font-extrabold tracking-tight mt-0.5">{currentScene.title}</h3>
          {currentScene.objective && <p className="text-[11px] text-foreground/80 mt-1">{currentScene.objective}</p>}
          <button
            type="button"
            onClick={() => onEndScene(currentScene.id)}
            className="mt-3 w-full h-9 rounded-lg bg-muted/40 border border-border/40 text-[11px] font-extrabold uppercase tracking-wider active:scale-[0.98] transition"
          >
            End scene
          </button>
        </div>
      )}

      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Start a new scene</p>
        <div className="space-y-2">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Scene title" className="h-10" />
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" className="h-10" />
          <Input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Current objective" className="h-10" />
          <Input value={stakes} onChange={e => setStakes(e.target.value)} placeholder="Stakes" className="h-10" />
          <Textarea value={publicNotes} onChange={e => setPublicNotes(e.target.value)} placeholder="Public notes (players see this)" rows={2} className="text-[12.5px]" />
          <Textarea value={gmNotes} onChange={e => setGmNotes(e.target.value)} placeholder="GM-only notes (private to you)" rows={2} className="text-[12.5px]" />
          <button onClick={submit} disabled={busy} className="w-full h-10 rounded-lg text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))', color: 'hsl(var(--primary-foreground))' }}>
            <PlusCircle className="w-3.5 h-3.5" /> Start scene
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── NPCs / Clues / Items / Factions / Locations ────────────────
 * Reusable simple-create pattern: short form at top, list below. */

function SimpleCreate({ label, onCreate, placeholder, descPlaceholder, gmOnly = false }: {
  label: string;
  onCreate: (input: { name: string; description?: string; visibility?: 'public' | 'gm_only' }) => Promise<unknown>;
  placeholder: string;
  descPlaceholder?: string;
  /** When true, default visibility is gm_only (hidden from players). */
  gmOnly?: boolean;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [hidden, setHidden] = useState(gmOnly);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await onCreate({ name: name.trim(), description: desc.trim() || undefined, visibility: hidden ? 'gm_only' : 'public' });
    setBusy(false);
    setName(''); setDesc('');
  };
  return (
    <div className="rounded-xl bg-muted/25 border border-border/40 p-3 space-y-2">
      <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70">Add {label}</p>
      <Input value={name} onChange={e => setName(e.target.value)} placeholder={placeholder} className="h-10" />
      {descPlaceholder && (
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder={descPlaceholder} rows={2} className="text-[12px]" />
      )}
      <div className="flex items-center justify-between gap-2">
        <label className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-muted-foreground/85">
          <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} /> GM-only
        </label>
        <button onClick={submit} disabled={busy || !name.trim()} className="h-9 px-3 rounded-md text-[11px] font-extrabold inline-flex items-center gap-1 active:scale-95 transition disabled:opacity-50" style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.35)' }}>
          <PlusCircle className="w-3 h-3" /> Add
        </button>
      </div>
    </div>
  );
}

function NpcsTab({ npcs, onCreateNpc }: Props) {
  return (
    <div className="space-y-3">
      <SimpleCreate label="NPC" onCreate={onCreateNpc as any} placeholder="NPC name" descPlaceholder="Short description / role" />
      <div className="space-y-1.5">
        {npcs.length === 0 && <EmptyHint message="No NPCs yet." />}
        {npcs.map(n => (
          <div key={n.id} className="rounded-xl bg-card border border-border/40 p-2.5 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-extrabold truncate">{n.name}</span>
                {n.visibility === 'gm_only' && <StatusPill variant="disabled" size="xs">GM only</StatusPill>}
              </div>
              {n.role && <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65">{n.role}</p>}
              {n.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{n.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CluesTab({ clues, onCreateClue }: Props) {
  return (
    <div className="space-y-3">
      <SimpleCreate label="clue" onCreate={onCreateClue as any} placeholder="Clue name" descPlaceholder="What the clue tells the party" />
      <div className="space-y-1.5">
        {clues.length === 0 && <EmptyHint message="No clues discovered yet." />}
        {clues.map(c => (
          <div key={c.id} className="rounded-xl bg-card border border-border/40 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[12.5px] font-extrabold truncate">{c.name}</span>
              <StatusPill variant={c.status === 'solved' ? 'success' : c.status === 'false_lead' ? 'danger' : c.status === 'partial' ? 'warning' : 'info'} size="xs">
                {c.status.replace('_', ' ')}
              </StatusPill>
              {c.visibility === 'gm_only' && <StatusPill variant="disabled" size="xs">GM only</StatusPill>}
            </div>
            {c.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{c.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemsTab({ items, onCreateItem }: Props) {
  return (
    <div className="space-y-3">
      <SimpleCreate label="item" onCreate={onCreateItem as any} placeholder="Item name" descPlaceholder="Description / use" />
      <div className="space-y-1.5">
        {items.length === 0 && <EmptyHint message="No important items yet." />}
        {items.map(i => (
          <div key={i.id} className="rounded-xl bg-card border border-border/40 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[12.5px] font-extrabold truncate">{i.name}</span>
              {i.visibility === 'gm_only' && <StatusPill variant="disabled" size="xs">GM only</StatusPill>}
            </div>
            {i.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{i.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FactionsTab({ factions, onCreateFaction }: Props) {
  return (
    <div className="space-y-3">
      <SimpleCreate label="faction" onCreate={onCreateFaction as any} placeholder="Faction name" descPlaceholder="Who they are, what they want" />
      <div className="space-y-1.5">
        {factions.length === 0 && <EmptyHint message="No factions have entered the story yet." />}
        {factions.map(f => (
          <div key={f.id} className="rounded-xl bg-card border border-border/40 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[12.5px] font-extrabold truncate">{f.name}</span>
              {f.visibility === 'gm_only' && <StatusPill variant="disabled" size="xs">GM only</StatusPill>}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">
              Relationship <span className="tabular-nums">{f.relationship_score}</span> · Suspicion <span className="tabular-nums">{f.suspicion_score}</span>
            </p>
            {f.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{f.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClocksTab({ clocks, onCreateClock, onAdvanceClock }: Props) {
  const [name, setName] = useState('');
  const [maxVal, setMaxVal] = useState(6);
  const [clockType, setClockType] = useState<Clock['clock_type']>('danger');
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-muted/25 border border-border/40 p-3 space-y-2">
        <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70">Add clock</p>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Clock name" className="h-10" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65">Segments</Label>
            <Input type="number" value={maxVal} min={2} max={20} onChange={e => setMaxVal(Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 6)))} className="mt-1 h-9 text-center" />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65">Type</Label>
            <select value={clockType} onChange={e => setClockType(e.target.value as Clock['clock_type'])} className="mt-1 w-full h-9 rounded-md border border-border/40 bg-card px-2 text-[12px]">
              <option value="danger">Danger</option>
              <option value="opportunity">Opportunity</option>
              <option value="mystery">Mystery</option>
              <option value="faction">Faction</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-muted-foreground/85">
            <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} /> GM-only
          </label>
          <button
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              await onCreateClock({ name: name.trim(), max_value: maxVal, clock_type: clockType, visibility: hidden ? 'gm_only' : 'public' });
              setBusy(false);
              setName(''); setMaxVal(6); setHidden(false);
            }}
            className="h-9 px-3 rounded-md text-[11px] font-extrabold active:scale-95 disabled:opacity-50"
            style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.35)' }}
          >
            Add clock
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {clocks.length === 0 && <EmptyHint message="No clocks yet." />}
        {clocks.map(c => (
          <ClockCard key={c.id} clock={c} showVisibility onAdvance={delta => onAdvanceClock(c.id, delta)} />
        ))}
      </div>
    </div>
  );
}

function MemoryTab({ campaign }: Props) {
  return (
    <div className="space-y-2">
      <EmptyHint message="No memory has been saved yet. Summarize a scene to begin building the campaign record." />
      <p className="text-[10.5px] text-muted-foreground/65 leading-snug">
        Campaign memory is updated <span className="font-bold text-foreground/80">manually</span> — never auto-saved. Use the AI tab to draft a scene summary, review the result, then approve it into memory.
      </p>
      {campaign.memory_summary && (
        <div className="rounded-xl bg-card border border-border/40 p-3 mt-3">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70">Current summary</p>
          <p className="text-[12px] text-foreground/85 leading-snug mt-1 whitespace-pre-wrap">{campaign.memory_summary}</p>
        </div>
      )}
    </div>
  );
}

function NotesTab({}: Props) {
  return <EmptyHint message="GM-only notes coming next pass. For now, use private GM messages in Story Chat." />;
}

function AiTab(props: Props) {
  const configured = isAiConfigured();
  return (
    <div className="space-y-3">
      {!configured && (
        <div className="rounded-xl border border-warning/35 bg-warning/8 p-3 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-warning flex-shrink-0" />
          <div>
            <p className="text-[11.5px] font-extrabold">AI provider not configured</p>
            <p className="text-[10.5px] text-muted-foreground/75 leading-snug mt-0.5">
              These tools are wired up and ready — once your edge function is connected, every button below will return drafts + structured state-update suggestions for you to review.
            </p>
          </div>
        </div>
      )}
      <p className="text-[10.5px] text-muted-foreground/70 leading-snug">
        Every AI tool returns a <span className="font-extrabold text-foreground/85">draft</span> and optional <span className="font-extrabold text-foreground/85">state-update suggestions</span>. Nothing changes the campaign until you approve.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {GM_TOOLS.map(t => (
          <button
            key={t.key}
            type="button"
            disabled={!configured}
            onClick={() => toast.info('AI provider not configured.')}
            className="text-left rounded-xl bg-card border border-border/40 p-2.5 active:scale-[0.98] transition disabled:opacity-55"
          >
            <p className="text-[12px] font-extrabold">{t.label}</p>
            <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5">{t.description}</p>
          </button>
        ))}
      </div>

      {/* Suggestion review queue */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2 mt-4">Review queue</p>
        {props.aiSuggestions.filter(s => s.status === 'pending').length === 0 ? (
          <EmptyHint message="No pending AI suggestions." />
        ) : (
          <div className="space-y-2">
            {props.aiSuggestions.filter(s => s.status === 'pending').map(s => (
              <div key={s.id} className="rounded-xl bg-card border border-border/40 p-3">
                <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-primary">{s.suggestion_type.replace('_', ' ')}</p>
                <p className="text-[12px] text-foreground/85 leading-snug mt-1 whitespace-pre-wrap">{s.suggested_content}</p>
                {Array.isArray(s.suggested_state_updates) && s.suggested_state_updates.length > 0 && (
                  <p className="text-[10.5px] text-muted-foreground/70 mt-1">{s.suggested_state_updates.length} state update{s.suggested_state_updates.length === 1 ? '' : 's'} proposed</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button className="flex-1 h-8 rounded-md text-[10.5px] font-bold bg-muted/40 border border-border/40">Reject</button>
                  <button className="flex-1 h-8 rounded-md text-[10.5px] font-extrabold" style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.4)' }}>Approve</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-muted/25 border border-dashed border-border/40 p-3 text-center">
      <p className="text-[11.5px] text-muted-foreground/75">{message}</p>
    </div>
  );
}
