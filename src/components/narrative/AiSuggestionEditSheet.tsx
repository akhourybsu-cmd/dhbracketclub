// DH Club — Narrative RPG · Edit-in-place for AI suggestions
//
// The review queue (GM Console → AI tab) lets the GM Approve or Reject
// a pending suggestion as-is. This sheet adds the missing third option:
// EDIT. The GM can rewrite the draft text and toggle/remove individual
// state-update entries before approving.
//
// Save flow:
//   1. Update the narrative_ai_suggestions row with the edited content
//      + filtered state_updates + status 'edited' (audit-friendly).
//   2. If the GM clicked "Save + approve", we ALSO call
//      applyStateUpdates() with the approved entries, then flip the
//      row's status to 'approved' so the queue stops showing it.
//
// Pure save (no apply) leaves the row in 'edited' so the GM can come
// back to it later.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Save, Check, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { applyStateUpdates, describeAction } from '@/lib/narrative/applyStateUpdates';
import type { AiSuggestionRow } from '@/lib/narrative/types';
import type { StateUpdateAction } from '@/lib/narrative/aiService';

interface Props {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  suggestion: AiSuggestionRow;
  onSaved?: () => void;
}

interface ReviewableAction {
  action: StateUpdateAction;
  approved: boolean;
}

export function AiSuggestionEditSheet({ open, onClose, campaignId, suggestion, onSaved }: Props) {
  const [draft, setDraft] = useState('');
  const [actions, setActions] = useState<ReviewableAction[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(suggestion.suggested_content ?? '');
    const initial = Array.isArray(suggestion.suggested_state_updates)
      ? (suggestion.suggested_state_updates as StateUpdateAction[]).map(a => ({ action: a, approved: true }))
      : [];
    setActions(initial);
  }, [open, suggestion]);

  const toggle = (idx: number) => setActions(prev => prev.map((a, i) => i === idx ? { ...a, approved: !a.approved } : a));
  const remove = (idx: number) => setActions(prev => prev.filter((_, i) => i !== idx));

  const persist = async (status: 'edited' | 'approved') => {
    setBusy(true);
    try {
      const sb = supabase as any;
      const me = (await sb.auth.getUser()).data.user;
      const stateUpdates = actions.filter(a => a.approved).map(a => a.action);

      // Always store the edited content + remaining state updates on
      // the row so future reviewers see what the GM kept.
      const { error: updErr } = await sb.from('narrative_ai_suggestions').update({
        suggested_content: draft.trim(),
        suggested_state_updates: actions.map(a => a.action),
        status,
        reviewed_by: me?.id ?? null,
        reviewed_at: status === 'edited' ? null : new Date().toISOString(),
      }).eq('id', suggestion.id);
      if (updErr) throw updErr;

      if (status === 'approved' && stateUpdates.length > 0) {
        const results = await applyStateUpdates(campaignId, stateUpdates);
        const failed = results.filter(r => !r.ok);
        if (failed.length) toast.warning(`Applied ${results.length - failed.length} of ${results.length}.`);
      }

      toast.success(status === 'approved' ? 'Approved + applied.' : 'Saved.');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error((e as Error).message ?? 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[75] flex items-end justify-center"
      style={{ background: 'hsl(218 50% 3% / 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
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
          <h2 className="text-[14px] font-extrabold tracking-tight">Edit AI suggestion</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg bg-muted/40 active:scale-90 flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Draft (edit freely)</p>
            <Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={6} className="text-[12.5px]" />
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
              State updates ({actions.filter(a => a.approved).length} of {actions.length} approved)
            </p>
            {actions.length === 0 ? (
              <p className="text-[11.5px] text-muted-foreground/70 italic">No state updates were suggested.</p>
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
                        onClick={() => toggle(i)}
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
                        onClick={() => remove(i)}
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

        <div className="px-4 py-3 border-t border-border/25 flex items-center gap-2">
          <button
            type="button"
            onClick={() => persist('edited')}
            disabled={busy}
            className="flex-1 h-11 rounded-xl bg-muted/40 border border-border/40 text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save edits
          </button>
          <button
            type="button"
            onClick={() => persist('approved')}
            disabled={busy || !draft.trim()}
            className="flex-1 h-11 rounded-xl text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))', color: 'hsl(var(--primary-foreground))' }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save + approve
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
