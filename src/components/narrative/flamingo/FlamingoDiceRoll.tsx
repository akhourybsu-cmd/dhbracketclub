// DH Club — Narrative RPG · Flamingo Protocol dice roll card
//
// Branded version of the inline dice-result card used inside Story Chat
// when the campaign is Flamingo Protocol. Same data + GM "Resolve
// cinematically" affordance as the calm DiceRollCard — we only restyle
// the chrome. Color-codes the outcome band:
//   crit    → pink/cyan double glow
//   success → cyan glow
//   mixed   → gold glow
//   fail    → danger red glow
//
// Hidden GM rolls keep the "Hidden roll" eyebrow label so private rolls
// don't accidentally read like public canon.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Dices, Eye, EyeOff, Sparkles, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { getStatMeta, bandForTotal } from '@/lib/narrative/chronicleRuleset';
import { suggestRollResolution, isAiConfigured } from '@/lib/narrative/aiService';
import { supabase } from '@/integrations/supabase/client';
import { FLAMINGO } from '@/lib/narrative/flamingoTheme';
import { COUNT_UP_SPRING, SPRING_HERO, haptic } from '@/lib/narrative/motion';

// Helper at module scope so the hook isn't recreated per render.
const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
import type { Message } from '@/lib/narrative/types';

interface Props {
  message: Message;
  rollerName?: string;
  isGm?: boolean;
  campaignId?: string;
}

/** Pick the dominant outcome-band accent for the card glow. */
function outcomeAccent(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('crit')) return FLAMINGO.pink;     // critical = brand
  if (l.includes('fail')) return FLAMINGO.danger;
  if (l.includes('mixed')) return FLAMINGO.gold;
  if (l.includes('success')) return FLAMINGO.cyan;
  return FLAMINGO.cyan;
}

export function FlamingoDiceRoll({ message, rollerName, isGm, campaignId }: Props) {
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
  const accent = outcomeAccent(band.label);
  const isCrit = band.label.toLowerCase().includes('crit');
  const isFail = band.label.toLowerCase().includes('fail');

  // First-time-seen detection — drives the dramatic reveal. We key on
  // the message id so re-renders from realtime don't replay the
  // animation, only the first mount of a brand-new roll does.
  const seenRef = useRef<string | null>(null);
  const firstMount = seenRef.current !== message.id;
  useEffect(() => { seenRef.current = message.id; }, [message.id]);

  // Count-up the d20 total from 0 → result on first mount. Uses a
  // motion value so the DOM updates without re-rendering the parent.
  const totalMv = useMotionValue(firstMount ? 0 : total);
  const totalText = useTransform(totalMv, latest => Math.round(latest).toString());
  useEffect(() => {
    if (!firstMount) { totalMv.set(total); return; }
    haptic(isCrit ? 'success' : isFail ? 'fail' : 'medium');
    const controls = animate(totalMv, total, { ...COUNT_UP_SPRING, duration: isCrit ? 0.9 : 0.55 });
    return () => controls.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!('draft' in result)) return;
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
    <motion.div
      initial={firstMount ? { opacity: 0, scale: 0.94, y: 12 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={SPRING_HERO}
      className="rounded-2xl p-3 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
        border: `1px solid hsl(${accent} / 0.5)`,
        boxShadow: isCrit
          ? `0 0 22px -4px hsl(${FLAMINGO.pink} / 0.6), 0 0 22px -8px hsl(${FLAMINGO.cyan} / 0.55)`
          : `0 0 16px -6px hsl(${accent} / 0.55)`,
      }}
    >
      {/* Crit celebration — six pink/cyan sparkles fanning out on first
          mount of a critical roll. Particles use motion.div with
          staggered keyframes; no JS animation loop. Disabled when the
          user has prefers-reduced-motion enabled. */}
      {isCrit && firstMount && !prefersReducedMotion() && (
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0.6, 1.1, 0.4],
                x: Math.cos((deg * Math.PI) / 180) * 70,
                y: Math.sin((deg * Math.PI) / 180) * 70,
              }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
              className="absolute left-[28px] top-[44px] w-1.5 h-1.5 rounded-full"
              style={{
                background: i % 2 === 0 ? `hsl(${FLAMINGO.pink})` : `hsl(${FLAMINGO.cyan})`,
                boxShadow: `0 0 8px hsl(${i % 2 === 0 ? FLAMINGO.pink : FLAMINGO.cyan})`,
              }}
            />
          ))}
        </div>
      )}
      {/* Eyebrow */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <Dices className="w-3 h-3" style={{ color: `hsl(${accent})` }} />
        <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: `hsl(${accent})` }}>
          {rollerName ? `${rollerName} · ` : ''}
          {statMeta ? statMeta.label : 'Roll'}
        </p>
        {isHidden ? (
          <span
            className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold"
            style={{ color: `hsl(${FLAMINGO.gmAmber})` }}
          >
            <EyeOff className="w-2.5 h-2.5" /> Hidden
          </span>
        ) : (
          <span
            className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold"
            style={{ color: `hsl(${FLAMINGO.paper} / 0.5)` }}
          >
            <Eye className="w-2.5 h-2.5" /> Visible
          </span>
        )}
      </div>

      {message.body && (
        <p
          className="text-[12.5px] font-bold leading-snug mb-2"
          style={{ color: `hsl(${FLAMINGO.paper} / 0.92)` }}
        >
          {message.body}
        </p>
      )}

      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, hsl(${accent} / 0.3), hsl(${accent} / 0.08))`,
            border: `1px solid hsl(${accent} / 0.6)`,
            boxShadow: `inset 0 0 10px hsl(${accent} / 0.3)`,
          }}
        >
          <span className="text-[8px] font-extrabold uppercase tracking-wider" style={{ color: `hsl(${accent})` }}>Total</span>
          <motion.span className="text-[20px] font-black tabular-nums leading-none" style={{ color: `hsl(${accent})` }}>
            {totalText}
          </motion.span>
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-[2px] text-[9px] font-extrabold uppercase tracking-[0.18em]"
            style={{
              background: `hsl(${accent} / 0.18)`,
              border: `1px solid hsl(${accent} / 0.5)`,
              color: `hsl(${accent})`,
              boxShadow: `0 0 8px -2px hsl(${accent} / 0.5)`,
            }}
          >
            {band.label}
          </span>
          <p className="text-[10.5px] mt-1.5 leading-snug" style={{ color: `hsl(${FLAMINGO.paper} / 0.75)` }}>
            d20 <span className="font-bold tabular-nums" style={{ color: `hsl(${FLAMINGO.paper})` }}>{d20}</span>
            {secondary !== null && <span style={{ color: `hsl(${FLAMINGO.paper} / 0.45)` }}> / {secondary}</span>}
            {statValue !== 0 && <> · {stat} <span className="font-bold tabular-nums" style={{ color: `hsl(${FLAMINGO.paper})` }}>{statValue >= 0 ? `+${statValue}` : statValue}</span></>}
            {modifier !== 0 && <> · mod <span className="font-bold tabular-nums" style={{ color: `hsl(${FLAMINGO.paper})` }}>{modifier >= 0 ? `+${modifier}` : modifier}</span></>}
            {difficulty !== 0 && <> · diff <span className="font-bold tabular-nums" style={{ color: `hsl(${FLAMINGO.paper})` }}>{difficulty}</span></>}
            {advantage !== 'none' && <> · {advantage}</>}
          </p>
        </div>
      </div>

      {/* GM-only Writer's-Room resolution affordance */}
      {isGm && aiEnabled && campaignId && (
        <div className="mt-2.5">
          {!resolveDraft && (
            <button
              type="button"
              onClick={askForResolution}
              disabled={resolving}
              className="w-full h-8 rounded-md text-[10.5px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.16), hsl(${FLAMINGO.cyan} / 0.12))`,
                color: `hsl(${FLAMINGO.pink})`,
                border: `1px solid hsl(${FLAMINGO.pink} / 0.4)`,
              }}
            >
              {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {resolving ? 'Drafting…' : 'Resolve cinematically'}
            </button>
          )}
          {resolveDraft && (
            <div
              className="rounded-md p-2.5"
              style={{ background: `hsl(${FLAMINGO.pink} / 0.06)`, border: `1px solid hsl(${FLAMINGO.pink} / 0.4)` }}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: `hsl(${FLAMINGO.pink})` }}>
                Writer's Room draft
              </p>
              <p
                className="text-[12px] leading-snug mt-1 whitespace-pre-wrap"
                style={{ color: `hsl(${FLAMINGO.paper} / 0.92)` }}
              >
                {resolveDraft}
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => setResolveDraft(null)}
                  className="flex-1 h-7 rounded-md text-[10px] font-bold"
                  style={{ background: `hsl(${FLAMINGO.smoke} / 0.6)`, color: `hsl(${FLAMINGO.paper} / 0.75)`, border: `1px solid hsl(${FLAMINGO.paper} / 0.18)` }}
                >
                  Discard
                </button>
                <button
                  onClick={askForResolution}
                  disabled={resolving}
                  className="flex-1 h-7 rounded-md text-[10px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-60"
                  style={{ background: `hsl(${FLAMINGO.smoke} / 0.6)`, color: `hsl(${FLAMINGO.paper} / 0.75)`, border: `1px solid hsl(${FLAMINGO.paper} / 0.18)` }}
                >
                  {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Regenerate'}
                </button>
                <button
                  onClick={postAsNarration}
                  disabled={posting || !resolveDraft.trim()}
                  className="flex-1 h-7 rounded-md text-[10px] font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-60"
                  style={{
                    background: `linear-gradient(135deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.violet}))`,
                    color: `hsl(${FLAMINGO.paper})`,
                    boxShadow: `0 0 10px -2px hsl(${FLAMINGO.pink} / 0.6)`,
                  }}
                >
                  {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Post
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
