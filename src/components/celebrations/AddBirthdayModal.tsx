// Birthdays & Milestones — Add/Edit Birthday Modal
//
// Bottom-sheet modal for setting the caller's birthday. Privacy-respecting:
// birth year is optional and `show_age` is off by default. Visibility
// defaults to 'club'. Portaled to escape any transform ancestors.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Loader2, X, Cake, EyeOff, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useMyBirthday, type CelebrationVisibility } from '@/hooks/useCelebrations';
import { formatMonthDay } from '@/lib/celebrations/dates';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function daysInMonth(month1Based: number, year?: number): number {
  // Use a non-leap year by default so Feb shows 29 only when year is set
  // and actually leap.
  return new Date(year ?? 2001, month1Based, 0).getDate();
}

interface Props {
  open: boolean;
  onClose: () => void;
  accent?: string;
}

export function AddBirthdayModal({ open, onClose, accent = '14 90% 60%' }: Props) {
  const { birthday, save, remove, saving } = useMyBirthday();
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [year, setYear] = useState<string>('');
  const [showAge, setShowAge] = useState(false);
  const [visibility, setVisibility] = useState<CelebrationVisibility>('club');
  const [reminderOptIn, setReminderOptIn] = useState(true);

  useEffect(() => {
    if (birthday) {
      setMonth(birthday.birth_month);
      setDay(birthday.birth_day);
      setYear(birthday.birth_year ? String(birthday.birth_year) : '');
      setShowAge(birthday.show_age);
      setVisibility(birthday.visibility);
      setReminderOptIn(birthday.reminder_opt_in);
    }
  }, [birthday, open]);

  if (!open || typeof document === 'undefined') return null;

  const yearNum = year.trim() ? parseInt(year, 10) : null;
  const maxDay = daysInMonth(month, yearNum ?? undefined);
  const safeDay = Math.min(day, maxDay);

  const handleSave = async () => {
    if (yearNum !== null && (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear())) {
      toast.error('Please enter a valid year (or leave blank).');
      return;
    }
    const ok = await save({
      birth_month: month,
      birth_day: safeDay,
      birth_year: yearNum,
      show_age: showAge && yearNum !== null,
      visibility,
      reminder_opt_in: reminderOptIn,
    });
    if (ok) {
      toast.success(birthday ? 'Birthday updated' : 'Birthday saved', {
        description: `Members will see ${formatMonthDay(month, safeDay)}${showAge && yearNum ? ' + your age' : ''}.`,
      });
      onClose();
    } else {
      toast.error('Couldn\'t save birthday — try again.');
    }
  };

  const handleDelete = async () => {
    await remove();
    toast.success('Birthday removed');
    onClose();
  };

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
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b"
          style={{
            background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
            borderColor: `hsl(${accent} / 0.22)`,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Cake className="w-3.5 h-3.5 flex-shrink-0" style={{ color: `hsl(${accent})` }} />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] truncate" style={{ color: `hsl(${accent})` }}>
              {birthday ? 'Edit Birthday' : 'Add Birthday'}
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
          {/* Date picker */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-2">Date</p>
            <div className="grid grid-cols-[2fr_1fr_1.2fr] gap-2">
              {/* Month select */}
              <select
                value={month}
                onChange={e => setMonth(parseInt(e.target.value, 10))}
                className="h-10 rounded-xl px-3 text-sm font-bold bg-muted/30 border border-border/40 text-foreground"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              {/* Day select */}
              <select
                value={safeDay}
                onChange={e => setDay(parseInt(e.target.value, 10))}
                className="h-10 rounded-xl px-3 text-sm font-bold bg-muted/30 border border-border/40 text-foreground tabular-nums"
              >
                {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {/* Year input (optional) */}
              <Input
                value={year}
                onChange={e => setYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                placeholder="Year (optional)"
                inputMode="numeric"
                className="h-10 text-sm font-bold bg-muted/30 border-border/40"
              />
            </div>
            <p className="text-[10.5px] text-muted-foreground/65 mt-1.5 leading-snug">
              Year is optional and stays private unless you turn on “Show my age” below.
            </p>
          </div>

          {/* Show age */}
          <ToggleRow
            label="Show my age"
            description={
              yearNum
                ? "Members will see your age alongside the date."
                : 'Add a year first to enable this.'
            }
            disabled={!yearNum}
            value={showAge}
            onChange={setShowAge}
            accent={accent}
          />

          {/* Visibility */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-2">Who can see this</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['club','admins_only','hidden'] as CelebrationVisibility[]).map(v => {
                const selected = visibility === v;
                const label = v === 'club' ? 'Club' : v === 'admins_only' ? 'Admins' : 'Hidden';
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
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
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reminders */}
          <ToggleRow
            icon={<BellRing className="w-3.5 h-3.5" />}
            label="Send me reminders"
            description="You'll get a heads-up before other members' birthdays based on club settings."
            value={reminderOptIn}
            onChange={setReminderOptIn}
            accent={accent}
          />

          {/* Actions */}
          <div className="pt-2 grid grid-cols-2 gap-2">
            {birthday ? (
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
                <EyeOff className="w-3.5 h-3.5" /> Remove
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
              disabled={saving}
              className="h-11 rounded-xl text-[13px] font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
                color: 'hsl(218 50% 6%)',
                boxShadow: `0 4px 14px -4px hsl(${accent} / 0.5)`,
              }}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {birthday ? 'Save Changes' : 'Save Birthday'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function ToggleRow({
  label, description, value, onChange, accent, disabled, icon,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  accent: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-3 py-2.5"
      style={{
        background: 'hsl(var(--muted) / 0.18)',
        border: '1px solid hsl(var(--border) / 0.28)',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold flex items-center gap-1.5">
          {icon && <span style={{ color: `hsl(${accent})` }}>{icon}</span>}
          {label}
        </p>
        <p className="text-[10.5px] text-muted-foreground/70 mt-0.5 leading-snug">{description}</p>
      </div>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
