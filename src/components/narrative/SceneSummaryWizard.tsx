// DH Club — Narrative RPG · Summarize Scene → Memory Wizard
//
// Three-step manual memory update flow for the Game Master:
//
//   1. Generate — calls the narrative-ai edge function with the
//      summarize_scene GM tool. Receives a draft summary + structured
//      stateUpdates (suggested memory deltas, advance_clock proposals,
//      add_clue / add_log_entry actions).
//   2. Review — GM edits the summary text. Each state-update is shown
//      in a checklist they can toggle, edit, or remove. Nothing is
//      saved until they click Approve.
//   3. Apply — the wizard writes the summary as a narrative_summaries
//      row, posts a campaign_summary message to the chat for catch-up,
//      then runs applyStateUpdates() for every approved entry.
//
// Renders nothing if AI is unavailable; the entry-point button in the
// GM Console explains why.

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X, Sparkles, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { invokeGmTool, type AiSuggestion, type StateUpdateAction } from '@/lib/narrative/aiService';
import { applyStateUpdates, describeAction } from '@/lib/narrative/applyStateUpdates';
import type { Campaign, Scene } from '@/lib/narrative/types';

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  currentScene: Scene | null;
  /** Called after successful save so the parent can refresh data. */
  onApplied?: () => void;
}

type Step = 'generate' | 'review' | 'applied';

interface ReviewableAction {
  action: StateUpdateAction;
  approved: boolean;
}

export function SceneSummaryWizard({ open, onClose, campaign, currentScene, onApplied }: Props) {
  const [step, setStep] = useState<Step>('generate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [rationale, setRationale] = useState<string | null>(null);
  const [actions, setActions] = useState<ReviewableAction[]>([]);
  const [applying, setApplying] = useState(false);

  const reset = useCallback(() => {
    setStep('generate');
    setLoading(false);
    setError(null);
    setDraft('');
    setRationale(null);
    setActions([]);
    setApplying(false);
  }, []);

  const handleClose = () => { reset(); onClose(); };

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await invokeGmTool('summarize_scene', { campaignId: campaign.id });
    setLoading(false);
    if ('available' in result && result.available === false) {
      setError(result.reason);
      return;
    }
    const s = result as AiSuggestion;
    setDraft(s.draft ?? '');
    setRationale(s.rationale ?? null);
    setActions((s.stateUpdates ?? []).map(a => ({ action: a, approved: true })));
    setStep('review');
  }, [campaign.id]);

  const toggleAction = (idx: number) => {
    setActions(prev => prev.map((a, i) => i === idx ? { ...a, approved: !a.approved } : a));
  };
  const removeAction = (idx: number) => {
    setActions(prev => prev.filter((_, i) => i !== idx));
  };

  const apply = useCallback(async () => {
    if (!draft.trim()) {
      toast.error('Add a summary first.');
      return;
    }
    setApplying(true);
    try {
      // 1. Insert summary row.
      const { error: sumErr } = await (supabase as any).from('narrative_summaries').insert({
        campaign_id: campaign.id,
        scene_id: currentScene?.id ?? null,
        title: currentScene?.title ?? null,
        body: draft.trim(),
        visibility: 'public',
        generated_by_ai: true,
      });
      if (sumErr) throw sumErr;

      // 2. Post a campaign_summary message into chat (so async players see it on catch-up).
      await (supabase as any).from('narrative_messages').insert({
        campaign_id: campaign.id,
        scene_id: currentScene?.id ?? null,
        sender_id: (await supabase.auth.getUser()).data.user?.id ?? null,
        message_type: 'campaign_summary',
        body: draft.trim(),
        visibility: 'public',
      });

      // 3. Apply approved state updates.
      const approved = actions.filter(a => a.approved).map(a => a.action);
      if (approved.length > 0) {
        const results = await applyStateUpdates(campaign.id, approved);
        const failed = results.filter(r => !r.ok);
        if (failed.length) {
          toast.warning(`Applied ${results.length - failed.length} of ${results.length}; ${failed.length} failed.`);
        }
      }
      toast.success('Summary saved.');
      setStep('applied');
      onApplied?.();
    } catch (e) {
      toast.error((e as Error).message ?? 'Failed to save summary.');
    } finally {
      setApplying(false);
    }
  }, [draft, actions, campaign.id, currentScene, onApplied]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
      style={{ background: 'hsl(218 50% 3% / 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[92dvh] rounded-t-2xl flex flex-col overflow-hidden bg-card border border-border/40"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/25">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-[14px] font-extrabold tracking-tight">Summarize scene</h2>
          </div>
          <button onClick={handleClose} aria-label="Close" className="w-8 h-8 rounded-lg bg-muted/40 active:scale-90 flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {step === 'generate' && (
            <div className="space-y-4">
              <p className="text-[12px] text-foreground/85 leading-relaxed">
                Generate a manual scene summary draft. Nothing saves until you review and approve.
              </p>
              {currentScene && (
                <div className="rounded-xl bg-muted/25 border border-border/40 p-3">
                  <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70">Current scene</p>
                  <p className="text-[13px] font-extrabold tracking-tight mt-0.5">{currentScene.title}</p>
                  {currentScene.objective && <p className="text-[11px] text-muted-foreground/80 mt-1">{currentScene.objective}</p>}
                </div>
              )}
              {!currentScene && (
                <div className="rounded-xl bg-muted/25 border border-dashed border-border/40 p-3 text-center">
                  <p className="text-[11.5px] text-muted-foreground/75">No active scene — the summary will be drawn from recent messages.</p>
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-warning/35 bg-warning/8 p-3 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-warning flex-shrink-0" />
                  <p className="text-[11.5px] text-foreground/85 leading-snug">{error}</p>
                </div>
              )}
              <button
                onClick={generate}
                disabled={loading}
                className="w-full h-12 rounded-xl text-[13px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
                  color: 'hsl(var(--primary-foreground))',
                  boxShadow: '0 4px 14px hsl(var(--primary) / 0.4)',
                }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? 'Generating…' : 'Generate draft'}
              </button>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Summary (edit freely)</p>
                <Textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={6}
                  className="text-[12.5px]"
                />
              </div>

              {rationale && (
                <div className="rounded-xl bg-muted/25 border border-border/40 p-2.5">
                  <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70">AI rationale</p>
                  <p className="text-[11px] text-muted-foreground/85 mt-0.5 leading-snug">{rationale}</p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
                  Suggested state updates ({actions.filter(a => a.approved).length} of {actions.length} approved)
                </p>
                {actions.length === 0 ? (
                  <div className="rounded-xl bg-muted/25 border border-dashed border-border/40 p-3 text-center">
                    <p className="text-[11.5px] text-muted-foreground/75">No state updates proposed.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {actions.map((a, i) => (
                      <div
                        key={i}
                        className={`rounded-xl border p-2.5 transition ${a.approved ? 'border-primary/40 bg-primary/8' : 'border-border/40 bg-card opacity-60'}`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => toggleAction(i)}
                            aria-label={a.approved ? 'Unapprove' : 'Approve'}
                            className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center border ${a.approved ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border/50'}`}
                          >
                            {a.approved && <Check className="w-3 h-3" strokeWidth={3} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11.5px] font-extrabold">{describeAction(a.action)}</p>
                            <p className="text-[10.5px] text-muted-foreground/75 mt-0.5 break-words">
                              {JSON.stringify(a.action.payload, null, 0)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAction(i)}
                            aria-label="Remove"
                            className="flex-shrink-0 w-7 h-7 rounded-md text-muted-foreground/60 hover:text-destructive active:scale-90 flex items-center justify-center"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'applied' && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'hsl(var(--success) / 0.16)' }}>
                <Check className="w-6 h-6" style={{ color: 'hsl(var(--success))' }} strokeWidth={3} />
              </div>
              <p className="text-[13px] font-extrabold">Summary saved to campaign memory.</p>
              <p className="text-[11px] text-muted-foreground/75 mt-1">Players can read it from the Log tab.</p>
            </div>
          )}
        </div>

        {step !== 'applied' && (
          <div className="px-4 py-3 border-t border-border/25 flex items-center gap-2">
            {step === 'review' && (
              <button
                type="button"
                onClick={() => setStep('generate')}
                className="flex-1 h-11 rounded-xl bg-muted/40 border border-border/40 text-[12px] font-extrabold inline-flex items-center justify-center gap-1 active:scale-[0.98] transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Regenerate
              </button>
            )}
            {step === 'review' && (
              <button
                type="button"
                onClick={apply}
                disabled={applying || !draft.trim()}
                className="flex-1 h-11 rounded-xl text-[12px] font-extrabold inline-flex items-center justify-center gap-1 active:scale-[0.98] transition disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
                  color: 'hsl(var(--primary-foreground))',
                }}
              >
                {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {applying ? 'Saving…' : 'Approve & save'}
              </button>
            )}
          </div>
        )}
        {step === 'applied' && (
          <div className="px-4 py-3 border-t border-border/25">
            <button onClick={handleClose} className="w-full h-11 rounded-xl text-[12px] font-extrabold bg-muted/40 border border-border/40">
              Done
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
