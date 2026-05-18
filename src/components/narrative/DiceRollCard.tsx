// DH Club — Narrative RPG · Dice roll result card
//
// Inline card rendered inside Story Chat when a player or GM rolls.
// Reads d20 + stat + modifier + outcome from the message metadata
// payload and styles per outcome band.

import { useState } from 'react';
import { Dices, Eye, EyeOff, Sparkles, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { StatusPill } from '@/components/ui/status-pill';
import { getStatMeta } from '@/lib/narrative/chronicleRuleset';
import { bandForTotal } from '@/lib/narrative/chronicleRuleset';
import { suggestRollResolution, isAiConfigured } from '@/lib/narrative/aiService';
import { supabase } from '@/integrations/supabase/client';
import type { Message } from '@/lib/narrative/types';

interface Props {
  message: Message;
  rollerName?: string;
  /** Set true when the viewer is the campaign's GM — unlocks the
   *  "Resolve cinematically" AI affordance. */
  isGm?: boolean;
  /** Campaign id is required to invoke the resolve_roll AI tool. */
  campaignId?: string;
}

export function DiceRollCard({ message, rollerName, isGm, campaignId }: Props) {
  const m = message.metadata as any;
  const stat = m?.stat as ReturnType<typeof getStatMeta>['id'] | 'none' | undefined;
  const statMeta = stat && stat !== 'none' ? getStatMeta(stat as any) : null;
  const total: number = m?.total ?? 0;
  const d20: number = m?.d20 ?? 0;
  const secondary: number | null = m?.secondary_d20 ?? null;
  const statValue: number = m?.stat_value ?? 0;
  const modifier: number = m?.modifier ?? 0;
  const difficulty: number = m?.difficulty ?? 0;
  const advantage: string = m?.advantage ?? 'none';
  const band = bandForTotal(total);
  const outcomeAccent = band.accent;

  const isHidden = message.visibility === 'gm_only';
  const [resolving, setResolving] = useState(false);
  const [resolveDraft, setResolveDraft] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const aiEnabled = isAiConfigured();

  const askForResolution = async () => {
    if (!campaignId) return;
    setResolving(true);
    setResolveDraft(null);
    const result = await suggestRollResolution({
      campaignId,
      characterName: rollerName,
      stat: stat as any ?? 'none',
      outcome: m?.outcome ?? band.outcome,
      reason: message.body ?? undefined,
    });
    setResolving(false);
    if ('available' in result && result.available === false) {
      toast.error(result.reason);
      return;
    }
    setResolveDraft(result.draft);
  };

  const postAsNarration = async () => {
    if (!campaignId || !resolveDraft?.trim()) return;
    setPosting(true);
    const { data: claims } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('narrative_messages').insert({
      campaign_id: campaignId,
      scene_id: message.scene_id ?? null,
      sender_id: claims.user?.id ?? null,
      message_type: 'gm_narration',
      body: resolveDraft.trim(),
      visibility: 'public',
      metadata: { resolves_message_id: message.id },
    });
    setPosting(false);
    if (error) { toast.error(`Post failed: ${error.message}`); return; }
    toast.success('Resolution posted.');
    setResolveDraft(null);
  };

  return (
    <div
      className="rounded-2xl p-3 bg-card border"
      style={{
        borderColor: `hsl(${outcomeAccent} / 0.45)`,
        boxShadow: `0 0 14px -8px hsl(${outcomeAccent} / 0.4)`,
      }}
    >
      {/* Eyebrow */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <Dices className="w-3 h-3" style={{ color: `hsl(${outcomeAccent})` }} />
        <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: `hsl(${outcomeAccent})` }}>
          {rollerName ? `${rollerName} · ` : ''}
          {statMeta ? statMeta.label : 'Roll'}
        </p>
        {isHidden && (
          <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground/65">
            <EyeOff className="w-2.5 h-2.5" /> Hidden roll
          </span>
        )}
        {!isHidden && (
          <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground/55">
            <Eye className="w-2.5 h-2.5" /> Visible
          </span>
        )}
      </div>

      {/* Reason */}
      {message.body && (
        <p className="text-[12.5px] font-bold text-foreground/85 leading-snug mb-2">{message.body}</p>
      )}

      {/* Result row */}
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, hsl(${outcomeAccent} / 0.25), hsl(${outcomeAccent} / 0.08))`,
            border: `1px solid hsl(${outcomeAccent} / 0.55)`,
          }}
        >
          <span className="text-[8px] font-extrabold uppercase tracking-wider" style={{ color: `hsl(${outcomeAccent})` }}>Total</span>
          <span className="text-[20px] font-black tabular-nums leading-none" style={{ color: `hsl(${outcomeAccent})` }}>{total}</span>
        </div>
        <div className="flex-1 min-w-0">
          <StatusPill accent={outcomeAccent} size="sm">{band.label}</StatusPill>
          <p className="text-[10.5px] text-muted-foreground/75 mt-1.5 leading-snug">
            d20 <span className="font-bold tabular-nums text-foreground/85">{d20}</span>
            {secondary !== null && <span className="text-muted-foreground/55"> / {secondary}</span>}
            {statValue !== 0 && <> · {stat} <span className="font-bold tabular-nums text-foreground/85">{statValue >= 0 ? `+${statValue}` : statValue}</span></>}
            {modifier !== 0 && <> · mod <span className="font-bold tabular-nums text-foreground/85">{modifier >= 0 ? `+${modifier}` : modifier}</span></>}
            {difficulty !== 0 && <> · diff <span className="font-bold tabular-nums text-foreground/85">{difficulty}</span></>}
            {advantage !== 'none' && <> · {advantage}</>}
          </p>
        </div>
      </div>

      {/* GM-only AI resolution affordance — drafts a cinematic narration
          for this roll outcome. Nothing posts automatically; the GM
          reviews the draft and decides whether to publish it as GM
          narration. */}
      {isGm && aiEnabled && campaignId && (
        <div className="mt-2.5">
          {!resolveDraft && (
            <button
              type="button"
              onClick={askForResolution}
              disabled={resolving}
              className="w-full h-8 rounded-md text-[10.5px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-60"
              style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.32)' }}
            >
              {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {resolving ? 'Drafting…' : 'Resolve cinematically'}
            </button>
          )}
          {resolveDraft && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">AI draft</p>
              <p className="text-[12px] text-foreground/85 leading-snug mt-1 whitespace-pre-wrap">{resolveDraft}</p>
              <div className="mt-2 flex gap-1.5">
                <button onClick={() => setResolveDraft(null)} className="flex-1 h-7 rounded-md text-[10px] font-bold bg-muted/40 border border-border/40">Discard</button>
                <button onClick={askForResolution} disabled={resolving} className="flex-1 h-7 rounded-md text-[10px] font-bold bg-muted/40 border border-border/40 inline-flex items-center justify-center gap-1 disabled:opacity-60">
                  {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Regenerate'}
                </button>
                <button onClick={postAsNarration} disabled={posting || !resolveDraft.trim()} className="flex-1 h-7 rounded-md text-[10px] font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-60" style={{ background: 'hsl(var(--primary) / 0.2)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.4)' }}>
                  {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Post
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
