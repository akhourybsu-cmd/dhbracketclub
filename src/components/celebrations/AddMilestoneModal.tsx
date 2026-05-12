// Birthdays & Milestones — Add/Edit Milestone Modal
//
// Bottom-sheet modal for creating or editing a club milestone. RLS
// gates who can save (admins always; members iff settings allow);
// this UI surfaces the option list and trusts the policies.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Loader2, X, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useClubMilestones, type ClubMilestone, type MilestoneRecurrence, type MilestoneType, type CelebrationVisibility,
} from '@/hooks/useCelebrations';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Editing an existing milestone; if undefined, this is a fresh create flow. */
  editing?: ClubMilestone | null;
  /** Admin? Drives the visibility options available. */
  isAdmin: boolean;
  accent?: string;
}

export function AddMilestoneModal({ open, onClose, editing, isAdmin, accent = '14 90% 60%' }: Props) {
  const { create, update, remove } = useClubMilestones();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneDate, setMilestoneDate] = useState(''); // YYYY-MM-DD
  const [recurrence, setRecurrence] = useState<MilestoneRecurrence>('none');
  const [type, setType] = useState<MilestoneType>('custom');
  const [visibility, setVisibility] = useState<CelebrationVisibility>('club');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setMilestoneDate(editing.milestone_date);
      setRecurrence(editing.recurrence);
      setType(editing.type);
      setVisibility(editing.visibility);
    } else {
      setTitle('');
      setDescription('');
      setMilestoneDate(new Date().toISOString().slice(0, 10));
      setRecurrence('yearly');
      setType('custom');
      setVisibility('club');
    }
  }, [editing, open]);

  if (!open || typeof document === 'undefined') return null;

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Give your milestone a title.');
      return;
    }
    if (!milestoneDate) {
      toast.error('Pick a date for this milestone.');
      return;
    }
    setSaving(true);
    if (editing) {
      const r = await update(editing.id, {
        title: title.trim(),
        description: description.trim() || null,
        milestone_date: milestoneDate,
        recurrence,
        type,
        visibility,
      });
      setSaving(false);
      if (r) {
        toast.success('Milestone updated');
        onClose();
      } else {
        toast.error('Couldn\'t update milestone.');
      }
    } else {
      const r = await create({
        title: title.trim(),
        description: description.trim() || null,
        milestone_date: milestoneDate,
        recurrence,
        type,
        visibility,
        user_id: null,
      });
      setSaving(false);
      if (r) {
        toast.success('Milestone added', { description: 'Members will see it on Home and Celebrations.' });
        onClose();
      } else {
        toast.error('Couldn\'t add milestone — check your permissions.');
      }
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setSaving(true);
    await remove(editing.id);
    setSaving(false);
    toast.success('Milestone removed');
    onClose();
  };

  const visibilityOptions: { v: CelebrationVisibility; label: string; show: boolean }[] = [
    { v: 'club', label: 'Club', show: true },
    { v: 'admins_only', label: 'Admins', show: isAdmin },
    { v: 'hidden', label: 'Hidden', show: isAdmin },
  ].filter(o => o.show);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'hsl(218 50% 3% / 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-2xl"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--background)))',
          border: `1px solid hsl(${accent} / 0.32)`,
          boxShadow: `0 -10px 30px -8px hsl(${accent} / 0.32)`,
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b"
          style={{
            background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
            borderColor: `hsl(${accent} / 0.22)`,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: `hsl(${accent})` }} />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] truncate" style={{ color: `hsl(${accent})` }}>
              {editing ? 'Edit Milestone' : 'Add Milestone'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground active:scale-90 transition"
            style={{ background: 'hsl(var(--muted) / 0.4)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">Title</p>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. First annual draft night"
              className="h-10 text-sm font-bold bg-muted/30 border-border/40"
            />
          </div>

          {/* Description (optional) */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">Description (optional)</p>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add some context — what happened, who was there, why it matters."
              className="text-sm bg-muted/30 border-border/40 min-h-[72px]"
            />
          </div>

          {/* Date + recurrence */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">Date</p>
              <Input
                type="date"
                value={milestoneDate}
                onChange={e => setMilestoneDate(e.target.value)}
                className="h-10 text-sm font-bold bg-muted/30 border-border/40"
              />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">Recurrence</p>
              <select
                value={recurrence}
                onChange={e => setRecurrence(e.target.value as MilestoneRecurrence)}
                className="h-10 w-full rounded-xl px-3 text-sm font-bold bg-muted/30 border border-border/40 text-foreground"
              >
                <option value="none">One-time</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* Type */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-2">Type</p>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { id: 'custom',             label: 'Custom' },
                { id: 'club_anniversary',   label: 'Club Anniversary' },
                { id: 'member_anniversary', label: 'Member Anniversary' },
                { id: 'achievement',        label: 'Achievement' },
              ] as { id: MilestoneType; label: string }[]).map(o => {
                const selected = type === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setType(o.id)}
                    className="h-9 rounded-xl text-[11px] font-extrabold transition-all active:scale-95"
                    style={
                      selected
                        ? {
                            background: `linear-gradient(135deg, hsl(${accent} / 0.22), hsl(${accent} / 0.08))`,
                            border: `1.5px solid hsl(${accent})`,
                            color: `hsl(${accent})`,
                          }
                        : {
                            background: 'hsl(var(--muted) / 0.3)',
                            border: '1px solid hsl(var(--border) / 0.3)',
                            color: 'hsl(var(--foreground) / 0.65)',
                          }
                    }
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-2">Who can see this</p>
            <div className="grid grid-cols-3 gap-1.5">
              {visibilityOptions.map(o => {
                const selected = visibility === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setVisibility(o.v)}
                    className="h-9 rounded-xl text-[11px] font-extrabold transition-all active:scale-95"
                    style={
                      selected
                        ? {
                            background: `linear-gradient(135deg, hsl(${accent} / 0.22), hsl(${accent} / 0.08))`,
                            border: `1.5px solid hsl(${accent})`,
                            color: `hsl(${accent})`,
                          }
                        : {
                            background: 'hsl(var(--muted) / 0.3)',
                            border: '1px solid hsl(var(--border) / 0.3)',
                            color: 'hsl(var(--foreground) / 0.65)',
                          }
                    }
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 grid grid-cols-2 gap-2">
            {editing && isAdmin ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="h-11 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
                style={{
                  background: 'hsl(var(--destructive) / 0.08)',
                  border: '1px solid hsl(var(--destructive) / 0.32)',
                  color: 'hsl(var(--destructive))',
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl text-[12px] font-bold active:scale-[0.98] transition"
                style={{
                  background: 'hsl(var(--muted) / 0.4)',
                  border: '1px solid hsl(var(--border) / 0.4)',
                  color: 'hsl(var(--foreground) / 0.75)',
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim() || !milestoneDate}
              className="h-11 rounded-xl text-[13px] font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
                color: 'hsl(218 50% 6%)',
                boxShadow: `0 4px 14px -4px hsl(${accent} / 0.5)`,
              }}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? 'Save Changes' : 'Add Milestone'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
