// DH Club — Narrative RPG · Story Chat surface
//
// Default tab inside a campaign. Renders the pinned current-scene card,
// the message stream (via SceneMessage), and a mobile-friendly composer
// with three send modes (Speak as character / Action / OOC), a Roll
// button that opens DiceRollSheet, and GM extras (Post as GM,
// Post as NPC, Private GM note).

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Dices, Megaphone, MessageCircle, Sparkles, Lock, ChevronDown, EyeOff, Wand2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Textarea } from '@/components/ui/textarea';
import { SceneMessage } from './SceneMessage';
import { DiceRollSheet } from './DiceRollSheet';
import { ClockCard } from './ClockCard';
import { PlayerAiAssistMenu } from './PlayerAiAssistMenu';
import { isAiConfigured } from '@/lib/narrative/aiService';
import type { Campaign, Character, CampaignMember, Message, MessageType, Scene, Clock } from '@/lib/narrative/types';

interface Props {
  campaign: Campaign;
  isGm: boolean;
  myRole: 'game_master' | 'player' | 'spectator' | null;
  myCharacter: Character | null;
  characters: Character[];
  members: CampaignMember[];
  scenes: Scene[];
  currentScene: Scene | null;
  messages: Message[];
  clocks: Clock[];
  onPost: (input: { body: string; message_type: MessageType; character_id?: string | null; visibility?: 'public' | 'gm_only' | 'private' }) => Promise<void>;
  onRoll: (input: { stat: string; statValue: number; modifier: number; difficulty: number; advantage: 'none' | 'advantage' | 'disadvantage'; reason: string; visibility: 'public' | 'gm_only' }) => Promise<void>;
}

type PostMode = 'character' | 'action' | 'ooc' | 'gm_narration' | 'gm_private';

const MODE_META: Record<PostMode, { label: string; type: MessageType; icon: typeof MessageCircle }> = {
  character:     { label: 'In character',  type: 'player',            icon: MessageCircle },
  action:        { label: 'Action',        type: 'character_action',  icon: Sparkles },
  ooc:           { label: 'OOC',           type: 'ooc',               icon: MessageCircle },
  gm_narration:  { label: 'GM narration',  type: 'gm_narration',      icon: Megaphone },
  gm_private:    { label: 'GM private',    type: 'gm_private',        icon: EyeOff },
};

export function StoryChat({
  campaign, isGm, myRole, myCharacter, characters, members, scenes, currentScene, messages, clocks, onPost, onRoll,
}: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<PostMode>('character');
  const [rollOpen, setRollOpen] = useState(false);
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const aiEnabled = isAiConfigured();
  const [autoScroll, setAutoScroll] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-default mode for spectators and non-character-having players
  useEffect(() => {
    if (myRole === 'spectator') setMode('ooc');
    else if (!myCharacter && !isGm) setMode('ooc');
    else if (isGm) setMode('gm_narration');
  }, [myRole, myCharacter, isGm]);

  // Maps for SceneMessage
  const characterMap = useMemo(() => {
    const m = new Map<string, Character>();
    for (const c of characters) m.set(c.id, c);
    return m;
  }, [characters]);

  // We don't have profile fetches here — synthesize names from member rows
  // by user_id (display_name comes from the campaign data joined in v2).
  // Players see their character names; GM-spoken messages show as the GM.
  const senderNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) {
      m.set(mem.user_id, mem.role === 'game_master' ? 'Game Master' : 'Player');
    }
    return m;
  }, [members]);

  // Auto-scroll on new messages when near bottom
  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, autoScroll]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(nearBottom);
  };

  const submit = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    const meta = MODE_META[mode];
    await onPost({
      body: draft.trim(),
      message_type: meta.type,
      character_id: mode === 'character' || mode === 'action' ? myCharacter?.id ?? null : null,
      visibility: mode === 'gm_private' ? 'gm_only' : 'public',
    });
    setDraft('');
    setSending(false);
    setAutoScroll(true);
  };

  const visibleClocks = clocks.filter(c => c.visibility === 'public' || isGm);

  const canCharacterMode = !!myCharacter;
  const allowedModes: PostMode[] = (() => {
    if (myRole === 'spectator') return ['ooc'];
    if (isGm) return ['gm_narration', 'character', 'action', 'ooc', 'gm_private'];
    return canCharacterMode ? ['character', 'action', 'ooc'] : ['ooc'];
  })();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Pinned scene + clocks header */}
      {(currentScene || visibleClocks.length > 0) && (
        <div className="px-4 pt-3 pb-2 space-y-2 border-b border-border/15 bg-background/95 backdrop-blur-md sticky top-0 z-10">
          {currentScene && (
            <div
              className="rounded-xl border p-2.5"
              style={{ borderColor: 'hsl(var(--gold) / 0.35)', background: 'hsl(var(--gold) / 0.06)' }}
            >
              <div className="flex items-center gap-1.5">
                <Megaphone className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
                <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(var(--gold))' }}>
                  Current Scene
                </p>
              </div>
              <h3 className="text-[13px] font-extrabold tracking-tight mt-0.5">{currentScene.title}</h3>
              {currentScene.objective && (
                <p className="text-[11px] text-foreground/80 mt-0.5">
                  <span className="text-muted-foreground/65 font-bold uppercase text-[9px] tracking-wider mr-1.5">Objective</span>{currentScene.objective}
                </p>
              )}
            </div>
          )}
          {visibleClocks.length > 0 && (
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {visibleClocks.slice(0, 6).map(c => (
                <div key={c.id} className="flex-shrink-0 w-[180px]">
                  <ClockCard clock={c} compact showVisibility={isGm && c.visibility === 'gm_only'} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0"
        style={{ overscrollBehavior: 'contain' }}
      >
        {!currentScene && messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-muted/30">
              <Megaphone className="w-5 h-5 text-muted-foreground/70" />
            </div>
            <p className="text-[13px] font-extrabold">{isGm ? 'Start a scene to give your players a place to act.' : 'Waiting for the Game Master to set the scene.'}</p>
          </div>
        )}
        {messages.map(m => (
          <SceneMessage
            key={m.id}
            message={m}
            characters={characterMap}
            senderNames={senderNames}
            isOwn={m.sender_id === user?.id}
            isGm={isGm}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Jump-to-latest */}
      <AnimatePresence>
        {!autoScroll && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 8 }}
            onClick={() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); setAutoScroll(true); }}
            className="absolute right-4 bottom-32 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-20"
            aria-label="Jump to latest"
          >
            <ChevronDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Composer */}
      <div
        className="border-t border-border/20 px-3 pt-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Mode chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {allowedModes.map(m => {
            const meta = MODE_META[m];
            const Icon = meta.icon;
            const selected = m === mode;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={m === 'character' && !canCharacterMode}
                className={`flex-shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition disabled:opacity-40 ${
                  selected ? 'bg-primary/18 text-primary border border-primary/40' : 'bg-muted/30 border border-border/40 text-muted-foreground/75'
                }`}
              >
                <Icon className="w-2.5 h-2.5" /> {meta.label}
              </button>
            );
          })}
        </div>

        {/* Composer row */}
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={
              mode === 'gm_narration'   ? 'Set the scene…' :
              mode === 'gm_private'     ? 'Private GM note (only you see this)…' :
              mode === 'action'         ? "What's your character doing?" :
              mode === 'ooc'            ? 'Out-of-character message…' :
              `${myCharacter?.name ?? 'Your character'} says…`
            }
            rows={1}
            className="flex-1 resize-none text-[13px] min-h-[44px]"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
          />
          {/* Player AI assist — only for players (incl. GM playing) when AI is enabled. */}
          {myRole !== 'spectator' && aiEnabled && (
            <button
              type="button"
              onClick={() => setAiAssistOpen(true)}
              aria-label="Help me write"
              className="flex-shrink-0 w-11 h-11 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center text-foreground/75 active:scale-95 transition"
              title="Help me write"
            >
              <Wand2 className="w-4 h-4" />
            </button>
          )}
          {myRole !== 'spectator' && (
            <button
              type="button"
              onClick={() => setRollOpen(true)}
              aria-label="Roll dice"
              className="flex-shrink-0 w-11 h-11 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center text-foreground/75 active:scale-95 transition"
            >
              <Dices className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || sending}
            onMouseDown={e => e.preventDefault()}
            aria-label="Send"
            className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition disabled:opacity-50"
            style={{
              background: draft.trim() ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))' : 'hsl(var(--muted) / 0.5)',
              color: 'hsl(var(--primary-foreground))',
            }}
          >
            {mode === 'gm_private' ? <Lock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <DiceRollSheet
        open={rollOpen}
        onClose={() => setRollOpen(false)}
        character={myCharacter}
        isGm={isGm}
        onRoll={async input => { await onRoll(input as any); }}
      />
      <PlayerAiAssistMenu
        open={aiAssistOpen}
        onClose={() => setAiAssistOpen(false)}
        campaignId={campaign.id}
        character={myCharacter}
        draft={draft}
        onApply={next => setDraft(next)}
      />
    </div>
  );
}
