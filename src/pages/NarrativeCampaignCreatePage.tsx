// DH Club — Narrative RPG · Campaign proposal page (/narrative/new)
//
// One mobile-friendly form. Anyone in the club can propose; submission
// flips the campaign to `pending_approval` so a club owner/admin must
// approve before it goes active. "Save as draft" keeps it editable.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScrollText, ChevronLeft, Sparkles, Send, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNarrativeCampaigns } from '@/hooks/useNarrativeCampaigns';
import { TEMPLATE_LIST, getTemplate, type TemplateKey } from '@/lib/narrative/templates';
import type { CampaignPlayMode, CampaignVisibility } from '@/lib/narrative/types';

const PLAY_MODES: { id: CampaignPlayMode; label: string; blurb: string }[] = [
  { id: 'async', label: 'Async',  blurb: 'Players post when they can.' },
  { id: 'live',  label: 'Live',   blurb: 'Real-time sessions only.' },
  { id: 'both',  label: 'Both',   blurb: 'Async by default, with live sessions when scheduled.' },
];

const VISIBILITY_OPTIONS: { id: CampaignVisibility; label: string; blurb: string }[] = [
  { id: 'invite_only', label: 'Invite-only',  blurb: 'Only invited players see this campaign.' },
  { id: 'club_visible', label: 'Club-visible', blurb: 'Anyone in the club can see + ask to join.' },
  { id: 'club_public',  label: 'Public to club', blurb: 'Everyone in the club can spectate (no posting).' },
];

export default function NarrativeCampaignCreatePage() {
  const { createCampaign } = useNarrativeCampaigns();
  const navigate = useNavigate();

  const [templateKey, setTemplateKey] = useState<TemplateKey>('blank');
  const [title, setTitle] = useState('');
  const [pitch, setPitch] = useState('');
  const [tone, setTone] = useState('');
  const [premise, setPremise] = useState('');
  const [contentNotes, setContentNotes] = useState('');
  const [playMode, setPlayMode] = useState<CampaignPlayMode>('both');
  const [visibility, setVisibility] = useState<CampaignVisibility>('club_visible');
  const [spectatorsAllowed, setSpectatorsAllowed] = useState(false);
  const [playerLimit, setPlayerLimit] = useState<number | ''>('');
  const [scheduleNote, setScheduleNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill premise + tone when the template changes.
  useEffect(() => {
    const t = getTemplate(templateKey);
    setTone(prev => prev.trim() ? prev : t.toneProfile);
    setPremise(prev => prev.trim() ? prev : t.openingPremise);
  }, [templateKey]);

  const valid = useMemo(() => title.trim().length >= 3 && pitch.trim().length >= 10, [title, pitch]);

  const submit = async (asDraft: boolean) => {
    if (!valid && !asDraft) {
      toast.error('Add a title and a short pitch first.');
      return;
    }
    setSubmitting(true);
    const result = await createCampaign({
      title,
      pitch,
      tone_profile: tone,
      opening_premise: premise,
      content_notes: contentNotes,
      template_key: templateKey,
      play_mode: playMode,
      visibility,
      spectators_allowed: spectatorsAllowed,
      player_limit: typeof playerLimit === 'number' ? playerLimit : null,
      schedule_note: scheduleNote,
      submit: !asDraft,
    });
    setSubmitting(false);
    if (!result) {
      toast.error('Couldn\'t create campaign.');
      return;
    }
    toast.success(asDraft ? 'Saved as draft.' : 'Submitted for approval.');
    navigate(`/narrative/${result.id}`);
  };

  const template = getTemplate(templateKey);

  return (
    <div
      className="px-4 pt-3 pb-6"
      style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/narrative')} aria-label="Back" className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/30 active:scale-95 transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65 inline-flex items-center gap-1.5">
            <ScrollText className="w-3 h-3" /> Narrative RPG
          </p>
          <h1 className="text-[17px] font-extrabold tracking-tight">Propose a campaign</h1>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-5"
      >
        {/* Template */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Template</p>
          <div className="grid grid-cols-1 gap-2">
            {TEMPLATE_LIST.map(t => {
              const selected = t.key === templateKey;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTemplateKey(t.key)}
                  className={`text-left rounded-2xl p-3.5 border bg-card transition ${selected ? 'border-primary ring-1 ring-primary/30' : 'border-border/40 hover:border-border/60'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[13px] font-extrabold">{t.name}</span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground/80 leading-snug">{t.tagline}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Title + pitch */}
        <section>
          <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Campaign name</Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={template.key === 'flamingo_protocol' ? 'e.g. The Velvetaine Heist' : 'e.g. Hollow Crown'}
            className="mt-1.5 h-11 text-[14px]"
          />
        </section>

        <section>
          <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Short pitch</Label>
          <Textarea
            value={pitch}
            onChange={e => setPitch(e.target.value)}
            placeholder="One or two sentences that hook the table."
            rows={3}
            className="mt-1.5 text-[13px]"
          />
        </section>

        <section>
          <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Tone keywords</Label>
          <Input
            value={tone}
            onChange={e => setTone(e.target.value)}
            placeholder="e.g. cinematic-crime · funny · faction-driven"
            className="mt-1.5 h-11 text-[13px]"
          />
          <p className="text-[10.5px] text-muted-foreground/65 mt-1">Used by the GM Console + AI tools to keep the campaign on tone.</p>
        </section>

        <section>
          <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Opening premise</Label>
          <Textarea
            value={premise}
            onChange={e => setPremise(e.target.value)}
            placeholder="What's happening when the campaign opens?"
            rows={4}
            className="mt-1.5 text-[13px]"
          />
          {templateKey === 'flamingo_protocol' && (
            <p className="text-[10.5px] text-muted-foreground/65 mt-1">Pre-filled from The Flamingo Protocol template — edit freely.</p>
          )}
        </section>

        {/* Play mode */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Play mode</p>
          <div className="grid grid-cols-3 gap-2">
            {PLAY_MODES.map(m => {
              const selected = m.id === playMode;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPlayMode(m.id)}
                  className={`rounded-xl p-2.5 border text-left bg-card transition ${selected ? 'border-primary ring-1 ring-primary/30' : 'border-border/40'}`}
                >
                  <p className="text-[11.5px] font-extrabold">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5">{m.blurb}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Visibility */}
        <section>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Visibility</p>
          <div className="grid grid-cols-1 gap-2">
            {VISIBILITY_OPTIONS.map(v => {
              const selected = v.id === visibility;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVisibility(v.id)}
                  className={`rounded-xl p-2.5 border text-left bg-card transition ${selected ? 'border-primary ring-1 ring-primary/30' : 'border-border/40'}`}
                >
                  <p className="text-[12px] font-extrabold">{v.label}</p>
                  <p className="text-[10.5px] text-muted-foreground/70 leading-snug">{v.blurb}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Numbers + spectators */}
        <section className="rounded-2xl bg-card border border-border/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-[12px] font-bold">Spectators allowed</Label>
              <p className="text-[10.5px] text-muted-foreground/70">Spectators can read but can't post or roll.</p>
            </div>
            <Switch checked={spectatorsAllowed} onCheckedChange={setSpectatorsAllowed} />
          </div>
          <div>
            <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Player limit (optional)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={playerLimit}
              onChange={e => setPlayerLimit(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 0))}
              placeholder="No limit"
              className="mt-1.5 h-10"
            />
          </div>
        </section>

        <section>
          <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Content notes / table expectations</Label>
          <Textarea
            value={contentNotes}
            onChange={e => setContentNotes(e.target.value)}
            placeholder="Topics to avoid, content warnings, table tone — anything the GM should know."
            rows={3}
            className="mt-1.5 text-[12.5px]"
          />
        </section>

        <section>
          <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Schedule (optional)</Label>
          <Input
            value={scheduleNote}
            onChange={e => setScheduleNote(e.target.value)}
            placeholder="e.g. Live every Sunday 8pm ET"
            className="mt-1.5 h-10"
          />
        </section>

        {/* Submit row */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={submitting}
            className="flex-1 h-12 rounded-xl text-[12.5px] font-extrabold inline-flex items-center justify-center gap-1.5 bg-muted/40 border border-border/40 text-foreground/85 active:scale-[0.98] transition"
          >
            <Save className="w-3.5 h-3.5" /> Save draft
          </button>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={submitting || !valid}
            className="flex-1 h-12 rounded-xl text-[12.5px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
            style={{
              background: valid ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))' : 'hsl(var(--muted))',
              color: 'hsl(var(--primary-foreground))',
              boxShadow: valid ? '0 4px 14px hsl(var(--primary) / 0.4)' : 'none',
            }}
          >
            <Send className="w-3.5 h-3.5" /> Submit for approval
          </button>
        </div>
      </motion.div>
    </div>
  );
}
