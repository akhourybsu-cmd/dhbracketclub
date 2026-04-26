import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, Users2, Swords, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  createSeason,
  setSeasonCommissioner,
  type DraftSeason,
} from '@/hooks/useDraftSeasons';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previousSeason: DraftSeason;
  onCreated: () => void;
}

function suggestedDefaults(prev: DraftSeason) {
  // Increment the trailing number in the previous season name if present
  const m = prev.name.match(/^(.*?)(\d+)\s*$/);
  const nextName = m ? `${m[1]}${parseInt(m[2], 10) + 1}` : `${prev.name} · Next`;

  return {
    name: nextName.trim(),
    regularSeasonDrafts: prev.regular_season_drafts || 12,
    bestOf: prev.best_of || 10,
  };
}

export function StartNextSeasonSheet({ open, onOpenChange, previousSeason, onCreated }: Props) {
  const { user } = useAuth();
  const defaults = useMemo(() => suggestedDefaults(previousSeason), [previousSeason]);

  const [name, setName] = useState(defaults.name);
  const [year, setYear] = useState<number>(defaults.year);
  const [seasonLabel, setSeasonLabel] = useState<typeof defaults.seasonLabel>(defaults.seasonLabel);
  const [startsAt, setStartsAt] = useState(defaults.startsAt);
  const [endsAt, setEndsAt] = useState(defaults.endsAt);
  const [regularSeasonDrafts, setRegularSeasonDrafts] = useState<number>(defaults.regularSeasonDrafts);
  const [bestOf, setBestOf] = useState<number>(defaults.bestOf);
  const [busy, setBusy] = useState(false);

  // Reset form when re-opened with potentially new previous season
  useEffect(() => {
    if (open) {
      setName(defaults.name);
      setYear(defaults.year);
      setSeasonLabel(defaults.seasonLabel);
      setStartsAt(defaults.startsAt);
      setEndsAt(defaults.endsAt);
      setRegularSeasonDrafts(defaults.regularSeasonDrafts);
      setBestOf(defaults.bestOf);
    }
  }, [open, defaults]);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Season name required'); return; }
    if (!startsAt || !endsAt) { toast.error('Start and end dates required'); return; }
    if (new Date(endsAt) <= new Date(startsAt)) { toast.error('End date must be after start date'); return; }
    if (regularSeasonDrafts < 1 || regularSeasonDrafts > 50) { toast.error('Drafts must be between 1 and 50'); return; }

    setBusy(true);
    try {
      const created: any = await createSeason({
        name: name.trim(),
        year,
        seasonLabel,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        regularSeasonDrafts,
        bestOf,
      });

      // Carry the commissioner forward (or claim it if previous season had none)
      const commissionerId = previousSeason.commissioner_user_id || user?.id;
      if (commissionerId && created?.id) {
        try { await setSeasonCommissioner(created.id, commissionerId); }
        catch (e) { console.warn('Could not set commissioner; continuing.', e); }
      }

      toast.success(`${name.trim()} is live! 🏆`);
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start season');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 max-h-[92vh] overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.05))',
                border: '1px solid hsl(var(--gold) / 0.3)',
              }}
            >
              <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
            </div>
            <div className="text-left">
              <SheetTitle className="text-[16px] font-extrabold leading-tight">Start a New Season</SheetTitle>
              <p className="text-[11px] text-muted-foreground/70 font-medium mt-0.5">
                Wraps {previousSeason.name} into the archive and opens fresh standings.
              </p>
            </div>
          </div>
        </SheetHeader>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-5 py-4 space-y-4"
        >
          {/* Carry-over banner */}
          <div
            className="rounded-xl p-3 flex items-center gap-2.5"
            style={{ background: 'hsl(var(--gold) / 0.06)', border: '1px solid hsl(var(--gold) / 0.18)' }}
          >
            <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
            <p className="text-[11px] font-semibold leading-snug">
              {previousSeason.name} stays archived with its podium, standings, and full bracket.
            </p>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/70">
              Season Name
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Season 2"
              className="h-11 text-[14px] font-bold"
            />
          </div>

          {/* Season label + year */}
          <div className="grid grid-cols-[1fr_92px] gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/70">
                Season
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {LABELS.map(l => (
                  <button
                    key={l.key}
                    onClick={() => setSeasonLabel(l.key)}
                    className={cn(
                      'h-11 rounded-xl text-[10px] font-extrabold transition-all flex flex-col items-center justify-center gap-0.5 btn-press',
                      seasonLabel === l.key
                        ? 'bg-gold/15 border border-gold/40 text-gold'
                        : 'bg-muted/40 border border-transparent text-muted-foreground hover:bg-muted/60'
                    )}
                    style={seasonLabel === l.key ? { color: 'hsl(var(--gold))' } : undefined}
                  >
                    <span className="text-[14px] leading-none">{l.emoji}</span>
                    <span>{l.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/70">
                Year
              </Label>
              <Input
                type="number"
                value={year}
                onChange={e => setYear(parseInt(e.target.value, 10) || year)}
                className="h-11 text-[14px] font-bold tabular-nums text-center"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Starts
              </Label>
              <Input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} className="h-11 text-[13px] font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Ends
              </Label>
              <Input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="h-11 text-[13px] font-bold" />
            </div>
          </div>

          {/* Drafts + best-of */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                <Users2 className="w-3 h-3" /> Reg. Drafts
              </Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={regularSeasonDrafts}
                onChange={e => setRegularSeasonDrafts(parseInt(e.target.value, 10) || 12)}
                className="h-11 text-[14px] font-bold tabular-nums text-center"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                <Swords className="w-3 h-3" /> Best of N (scoring)
              </Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={bestOf}
                onChange={e => setBestOf(parseInt(e.target.value, 10) || 10)}
                className="h-11 text-[14px] font-bold tabular-nums text-center"
              />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            Standings count each player's best <strong>{bestOf}</strong> finishes from their {regularSeasonDrafts} regular-season drafts.
            Top 5 seeds advance to the playoffs.
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-1 pb-2">
            <button
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="flex-1 h-11 rounded-xl bg-muted/50 text-[12px] font-bold btn-press"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy}
              className="flex-[1.4] h-11 rounded-xl text-[12px] font-extrabold btn-press flex items-center justify-center gap-1.5 disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold) / 0.95), hsl(var(--gold) / 0.7))',
                color: 'hsl(0 0% 8%)',
                boxShadow: '0 6px 18px -6px hsl(var(--gold) / 0.5)',
              }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? 'Starting…' : 'Launch Season'}
            </button>
          </div>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
