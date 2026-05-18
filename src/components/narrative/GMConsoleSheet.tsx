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
  BookOpenText, StickyNote, Sparkles, PlusCircle, AlertCircle, Bookmark, Pencil,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { StatusPill } from '@/components/ui/status-pill';
import { ClockCard } from './ClockCard';
import {
  EntityEditSheet, NPC_SCHEMA, CLUE_SCHEMA, ITEM_SCHEMA, FACTION_SCHEMA,
  CLOCK_SCHEMA, SCENE_SCHEMA,
} from './EntityEditSheet';
import { ChapterSheet } from './ChapterSheet';
import { SceneSummaryWizard } from './SceneSummaryWizard';
import { AiSuggestionEditSheet } from './AiSuggestionEditSheet';
import { GM_TOOLS, isAiConfigured, invokeGmTool, type AiSuggestion } from '@/lib/narrative/aiService';
import { applyStateUpdates } from '@/lib/narrative/applyStateUpdates';
import type {
  Campaign, Scene, NPC, Clue, Faction, Clock, Item, Location as NarrativeLocation, AiSuggestionRow,
} from '@/lib/narrative/types';

type TabKey = 'scene' | 'chapters' | 'npcs' | 'clues' | 'items' | 'factions' | 'clocks' | 'memory' | 'notes' | 'ai';

const TABS: { key: TabKey; label: string; icon: typeof Megaphone }[] = [
  { key: 'scene',    label: 'Scene',    icon: Megaphone },
  { key: 'chapters', label: 'Chapters', icon: Bookmark },
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
  /** Called after the GM applies a state-update set so parent can refresh. */
  onChanged?: () => void;
}

export function GMConsoleSheet(props: Props) {
  const { open, onClose } = props;
  const [tab, setTab] = useState<TabKey>('scene');
  const [editTarget, setEditTarget] = useState<{ table: string; label: string; row: any; schema: any } | null>(null);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

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
          {tab === 'scene'    && <SceneTab {...props} onEditScene={(s) => setEditTarget({ table: 'narrative_scenes', label: 'Edit scene', row: s, schema: SCENE_SCHEMA })} />}
          {tab === 'chapters' && <ChaptersTab onOpenChapters={() => setChaptersOpen(true)} />}
          {tab === 'npcs'     && <NpcsTab     {...props} onEdit={(n) => setEditTarget({ table: 'narrative_npcs',     label: 'Edit NPC',     row: n, schema: NPC_SCHEMA })} />}
          {tab === 'clues'    && <CluesTab    {...props} onEdit={(c) => setEditTarget({ table: 'narrative_clues',    label: 'Edit clue',    row: c, schema: CLUE_SCHEMA })} />}
          {tab === 'items'    && <ItemsTab    {...props} onEdit={(i) => setEditTarget({ table: 'narrative_items',    label: 'Edit item',    row: i, schema: ITEM_SCHEMA })} />}
          {tab === 'factions' && <FactionsTab {...props} onEdit={(f) => setEditTarget({ table: 'narrative_factions', label: 'Edit faction', row: f, schema: FACTION_SCHEMA })} />}
          {tab === 'clocks'   && <ClocksTab   {...props} onEdit={(c) => setEditTarget({ table: 'narrative_clocks',   label: 'Edit clock',   row: c, schema: CLOCK_SCHEMA })} />}
          {tab === 'memory'   && <MemoryTab   {...props} onSummarize={() => setSummaryOpen(true)} />}
          {tab === 'notes'    && <NotesTab    {...props} />}
          {tab === 'ai'       && <AiTab       {...props} />}
        </div>

        {/* Edit sheet — opens over the console for the row tapped. */}
        {editTarget && (
          <EntityEditSheet
            open
            onClose={() => setEditTarget(null)}
            table={editTarget.table}
            entityLabel={editTarget.label}
            row={editTarget.row}
            schema={editTarget.schema}
            onSaved={() => { setEditTarget(null); props.onChanged?.(); }}
          />
        )}

        {/* Chapter management drawer */}
        <ChapterSheet
          open={chaptersOpen}
          onClose={() => setChaptersOpen(false)}
          campaign={props.campaign}
          onChanged={props.onChanged}
        />

        {/* Scene summary wizard */}
        <SceneSummaryWizard
          open={summaryOpen}
          onClose={() => setSummaryOpen(false)}
          campaign={props.campaign}
          currentScene={props.currentScene}
          onApplied={props.onChanged}
        />
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/* ─── Scene tab ───────────────────────────────────────────────── */

function SceneTab({ currentScene, onCreateScene, onEndScene, onEditScene }: Props & { onEditScene?: (s: Scene) => void }) {
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
          <div className="mt-3 flex gap-1.5">
            {onEditScene && (
              <button
                type="button"
                onClick={() => onEditScene(currentScene)}
                className="flex-1 h-9 rounded-lg bg-muted/40 border border-border/40 text-[11px] font-extrabold uppercase tracking-wider active:scale-[0.98] transition inline-flex items-center justify-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => onEndScene(currentScene.id)}
              className="flex-1 h-9 rounded-lg bg-muted/40 border border-border/40 text-[11px] font-extrabold uppercase tracking-wider active:scale-[0.98] transition"
            >
              End scene
            </button>
          </div>
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

function NpcsTab({ npcs, onCreateNpc, onEdit }: Props & { onEdit?: (n: NPC) => void }) {
  return (
    <div className="space-y-3">
      <SimpleCreate label="NPC" onCreate={onCreateNpc as any} placeholder="NPC name" descPlaceholder="Short description / role" />
      <div className="space-y-1.5">
        {npcs.length === 0 && <EmptyHint message="No NPCs yet." />}
        {npcs.map(n => (
          <button
            type="button"
            key={n.id}
            onClick={() => onEdit?.(n)}
            className="w-full text-left rounded-xl bg-card border border-border/40 p-2.5 flex items-start gap-2 active:scale-[0.99] transition"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-extrabold truncate">{n.name}</span>
                {n.visibility === 'gm_only' && <StatusPill variant="disabled" size="xs">GM only</StatusPill>}
              </div>
              {n.role && <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65">{n.role}</p>}
              {n.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{n.description}</p>}
            </div>
            <Pencil className="w-3 h-3 text-muted-foreground/55 mt-1 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

function CluesTab({ clues, onCreateClue, onEdit }: Props & { onEdit?: (c: Clue) => void }) {
  return (
    <div className="space-y-3">
      <SimpleCreate label="clue" onCreate={onCreateClue as any} placeholder="Clue name" descPlaceholder="What the clue tells the party" />
      <div className="space-y-1.5">
        {clues.length === 0 && <EmptyHint message="No clues discovered yet." />}
        {clues.map(c => (
          <button
            type="button"
            key={c.id}
            onClick={() => onEdit?.(c)}
            className="w-full text-left rounded-xl bg-card border border-border/40 p-2.5 flex items-start gap-2 active:scale-[0.99] transition"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12.5px] font-extrabold truncate">{c.name}</span>
                <StatusPill variant={c.status === 'solved' ? 'success' : c.status === 'false_lead' ? 'danger' : c.status === 'partial' ? 'warning' : 'info'} size="xs">
                  {c.status.replace('_', ' ')}
                </StatusPill>
                {c.visibility === 'gm_only' && <StatusPill variant="disabled" size="xs">GM only</StatusPill>}
              </div>
              {c.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{c.description}</p>}
            </div>
            <Pencil className="w-3 h-3 text-muted-foreground/55 mt-1 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ItemsTab({ items, onCreateItem, onEdit }: Props & { onEdit?: (i: Item) => void }) {
  return (
    <div className="space-y-3">
      <SimpleCreate label="item" onCreate={onCreateItem as any} placeholder="Item name" descPlaceholder="Description / use" />
      <div className="space-y-1.5">
        {items.length === 0 && <EmptyHint message="No important items yet." />}
        {items.map(i => (
          <button
            type="button"
            key={i.id}
            onClick={() => onEdit?.(i)}
            className="w-full text-left rounded-xl bg-card border border-border/40 p-2.5 flex items-start gap-2 active:scale-[0.99] transition"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-extrabold truncate">{i.name}</span>
                {i.visibility === 'gm_only' && <StatusPill variant="disabled" size="xs">GM only</StatusPill>}
              </div>
              {i.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{i.description}</p>}
            </div>
            <Pencil className="w-3 h-3 text-muted-foreground/55 mt-1 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

function FactionsTab({ factions, onCreateFaction, onEdit }: Props & { onEdit?: (f: Faction) => void }) {
  return (
    <div className="space-y-3">
      <SimpleCreate label="faction" onCreate={onCreateFaction as any} placeholder="Faction name" descPlaceholder="Who they are, what they want" />
      <div className="space-y-1.5">
        {factions.length === 0 && <EmptyHint message="No factions have entered the story yet." />}
        {factions.map(f => (
          <button
            type="button"
            key={f.id}
            onClick={() => onEdit?.(f)}
            className="w-full text-left rounded-xl bg-card border border-border/40 p-2.5 flex items-start gap-2 active:scale-[0.99] transition"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-extrabold truncate">{f.name}</span>
                {f.visibility === 'gm_only' && <StatusPill variant="disabled" size="xs">GM only</StatusPill>}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">
                Relationship <span className="tabular-nums">{f.relationship_score}</span> · Suspicion <span className="tabular-nums">{f.suspicion_score}</span>
              </p>
              {f.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{f.description}</p>}
            </div>
            <Pencil className="w-3 h-3 text-muted-foreground/55 mt-1 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ClocksTab({ clocks, onCreateClock, onAdvanceClock, onEdit }: Props & { onEdit?: (c: Clock) => void }) {
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
          <div key={c.id} className="relative">
            <ClockCard clock={c} showVisibility onAdvance={delta => onAdvanceClock(c.id, delta)} />
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(c)}
                aria-label="Edit clock"
                className="absolute top-2 right-2 w-7 h-7 rounded-md bg-muted/30 border border-border/40 text-muted-foreground/65 active:scale-90 flex items-center justify-center"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Chapters tab — just a launcher into the chapter sheet ── */

function ChaptersTab({ onOpenChapters }: { onOpenChapters: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-foreground/85 leading-relaxed">
        Group scenes into chapters — major story arcs. Starting a chapter posts a transition into the story chat so async players see the structure.
      </p>
      <button
        type="button"
        onClick={onOpenChapters}
        className="w-full h-11 rounded-xl text-[12.5px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
        style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.4)' }}
      >
        <Bookmark className="w-3.5 h-3.5" /> Open chapter manager
      </button>
    </div>
  );
}

function MemoryTab({ campaign, onSummarize }: Props & { onSummarize?: () => void }) {
  const configured = isAiConfigured();
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-foreground/85 leading-relaxed">
        Campaign memory is updated <span className="font-extrabold">manually</span> — never auto-saved. Draft a summary, review the proposed memory changes, then approve.
      </p>
      <button
        type="button"
        onClick={onSummarize}
        disabled={!configured}
        className="w-full h-11 rounded-xl text-[12.5px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-55"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))', color: 'hsl(var(--primary-foreground))' }}
      >
        <Sparkles className="w-3.5 h-3.5" /> Summarize scene → memory
      </button>
      {!configured && (
        <p className="text-[10.5px] text-muted-foreground/70">AI provider not configured. Wire LOVABLE_API_KEY on the narrative-ai edge function + VITE_NARRATIVE_AI_ENABLED on the client to enable.</p>
      )}
      {campaign.memory_summary ? (
        <div className="rounded-xl bg-card border border-border/40 p-3">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70">Current summary</p>
          <p className="text-[12px] text-foreground/85 leading-snug mt-1 whitespace-pre-wrap">{campaign.memory_summary}</p>
        </div>
      ) : (
        <EmptyHint message="No memory has been saved yet. Summarize a scene to begin building the campaign record." />
      )}
    </div>
  );
}

function NotesTab({}: Props) {
  return <EmptyHint message="GM-only notes coming next pass. For now, use private GM messages in Story Chat." />;
}

function AiTab(props: Props) {
  const configured = isAiConfigured();
  const [busyTool, setBusyTool] = useState<string | null>(null);
  const [lastDraft, setLastDraft] = useState<AiSuggestion | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<AiSuggestionRow | null>(null);

  const runTool = async (toolKey: string) => {
    setBusyTool(toolKey);
    setLastDraft(null);
    const result = await invokeGmTool(toolKey as any, { campaignId: props.campaign.id });
    setBusyTool(null);
    if ('available' in result && result.available === false) {
      toast.error(result.reason);
      return;
    }
    setLastDraft(result as AiSuggestion);
  };

  const applyDraft = async () => {
    if (!lastDraft) return;
    // Persist as an AI suggestion row for audit trail.
    const { data: claims } = await (window as any).supabaseClient?.auth.getUser?.() ?? { data: null };
    try {
      const sb = (await import('@/integrations/supabase/client')).supabase as any;
      const me = (await sb.auth.getUser()).data.user;
      await sb.from('narrative_ai_suggestions').insert({
        campaign_id: props.campaign.id,
        created_by: me?.id ?? null,
        suggestion_type: 'gm_draft',
        suggested_content: lastDraft.draft,
        suggested_state_updates: lastDraft.stateUpdates,
        status: 'pending',
      });
      toast.success('Added to review queue.');
    } catch (e) {
      toast.error('Couldn\'t save to queue.');
    }
    setLastDraft(null);
  };

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    const sb = (await import('@/integrations/supabase/client')).supabase as any;
    if (decision === 'approved') {
      const row = props.aiSuggestions.find(s => s.id === id);
      if (row && Array.isArray(row.suggested_state_updates) && row.suggested_state_updates.length > 0) {
        const results = await applyStateUpdates(props.campaign.id, row.suggested_state_updates as any);
        const failed = results.filter(r => !r.ok);
        if (failed.length) toast.warning(`Applied ${results.length - failed.length} of ${results.length}.`);
      }
    }
    const me = (await sb.auth.getUser()).data.user;
    await sb.from('narrative_ai_suggestions').update({
      status: decision,
      reviewed_by: me?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    props.onChanged?.();
    toast.success(decision === 'approved' ? 'Approved + applied.' : 'Rejected.');
  };

  return (
    <div className="space-y-3">
      {!configured && (
        <div className="rounded-xl border border-warning/35 bg-warning/8 p-3 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-warning flex-shrink-0" />
          <div>
            <p className="text-[11.5px] font-extrabold">AI provider not configured</p>
            <p className="text-[10.5px] text-muted-foreground/75 leading-snug mt-0.5">
              Set <code className="font-mono">LOVABLE_API_KEY</code> on the <code className="font-mono">narrative-ai</code> edge function and <code className="font-mono">VITE_NARRATIVE_AI_ENABLED=1</code> on the client.
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
            disabled={!configured || !!busyTool}
            onClick={() => runTool(t.key)}
            className="text-left rounded-xl bg-card border border-border/40 p-2.5 active:scale-[0.98] transition disabled:opacity-55"
          >
            <p className="text-[12px] font-extrabold">{t.label}</p>
            <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5">{t.description}</p>
            {busyTool === t.key && <p className="text-[9.5px] text-primary mt-1">working…</p>}
          </button>
        ))}
      </div>

      {/* Just-generated draft preview */}
      {lastDraft && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-primary">Latest draft</p>
          <p className="text-[12px] text-foreground/85 leading-snug mt-1 whitespace-pre-wrap">{lastDraft.draft}</p>
          {lastDraft.stateUpdates.length > 0 && (
            <p className="text-[10.5px] text-muted-foreground/75 mt-1">+ {lastDraft.stateUpdates.length} state update suggestion{lastDraft.stateUpdates.length === 1 ? '' : 's'}</p>
          )}
          <div className="flex gap-2 mt-2">
            <button onClick={() => setLastDraft(null)} className="flex-1 h-8 rounded-md text-[10.5px] font-bold bg-muted/40 border border-border/40">Discard</button>
            <button onClick={applyDraft} className="flex-1 h-8 rounded-md text-[10.5px] font-extrabold" style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.4)' }}>Add to queue</button>
          </div>
        </div>
      )}

      {/* Suggestion review queue */}
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2 mt-4">Review queue</p>
        {props.aiSuggestions.filter(s => s.status === 'pending').length === 0 ? (
          <EmptyHint message="No pending AI suggestions." />
        ) : (
          <div className="space-y-2">
            {props.aiSuggestions.filter(s => s.status === 'pending').map(s => (
              <div key={s.id} className="rounded-xl bg-card border border-border/40 p-3">
                <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-primary">{s.suggestion_type.replace(/_/g, ' ')}</p>
                <p className="text-[12px] text-foreground/85 leading-snug mt-1 whitespace-pre-wrap">{s.suggested_content}</p>
                {Array.isArray(s.suggested_state_updates) && s.suggested_state_updates.length > 0 && (
                  <p className="text-[10.5px] text-muted-foreground/70 mt-1">{s.suggested_state_updates.length} state update{s.suggested_state_updates.length === 1 ? '' : 's'} proposed</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => decide(s.id, 'rejected')} className="flex-1 h-8 rounded-md text-[10.5px] font-bold bg-muted/40 border border-border/40">Reject</button>
                  <button onClick={() => setEditingSuggestion(s)} className="flex-1 h-8 rounded-md text-[10.5px] font-bold bg-muted/40 border border-border/40 inline-flex items-center justify-center gap-1">
                    <Pencil className="w-2.5 h-2.5" /> Edit
                  </button>
                  <button onClick={() => decide(s.id, 'approved')} className="flex-1 h-8 rounded-md text-[10.5px] font-extrabold" style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.4)' }}>Approve</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {editingSuggestion && (
        <AiSuggestionEditSheet
          open
          onClose={() => setEditingSuggestion(null)}
          campaignId={props.campaign.id}
          suggestion={editingSuggestion}
          onSaved={() => { setEditingSuggestion(null); props.onChanged?.(); }}
        />
      )}
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
