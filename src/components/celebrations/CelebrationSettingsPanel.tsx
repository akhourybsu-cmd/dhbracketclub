// Birthdays & Milestones — Club Settings panel
//
// Admin-only panel inside the Club Settings page when the plugin is
// installed. Lets admins enable/disable surfaces, control member
// permissions, and tune reminder timing. RLS gates writes server-side.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PartyPopper, ChevronRight, Loader2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useCelebrationSettings } from '@/hooks/useCelebrations';

const ACCENT = '14 90% 60%';

interface Props {
  /** Set false if the asset isn't installed — panel renders nothing. */
  installed: boolean;
  /** Only admins should see this — parent enforces the gate; we render
   *  a tasteful read-only state if not admin for safety. */
  isAdmin: boolean;
}

export function CelebrationSettingsPanel({ installed, isAdmin }: Props) {
  const { settings, loading, saving, save } = useCelebrationSettings();
  if (!installed) return null;
  if (loading) return (
    <div className="glass-card p-4 flex items-center gap-2 text-[12px] text-muted-foreground/70">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading celebrations settings…
    </div>
  );
  if (!settings) return null;

  const togglable = (key: keyof typeof settings) => () => {
    if (!isAdmin) return;
    save({ [key]: !settings[key] } as any);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
        border: `1px solid hsl(${ACCENT} / 0.28)`,
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border/15"
        style={{ background: `radial-gradient(ellipse 80% 60% at 100% 0%, hsl(${ACCENT} / 0.14), transparent 70%)` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <PartyPopper className="w-3.5 h-3.5 flex-shrink-0" style={{ color: `hsl(${ACCENT})` }} />
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em]" style={{ color: `hsl(${ACCENT})` }}>
              Celebrations
            </p>
            <p className="text-[12px] font-bold leading-tight">Birthdays &amp; Milestones</p>
          </div>
        </div>
        <Link
          to="/celebrations"
          className="text-[10px] font-bold inline-flex items-center gap-0.5 text-muted-foreground/70 hover:text-foreground transition"
        >
          Open <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-border/15">
        <Row
          label="Show Celebrations on Home"
          description="Today's birthdays and upcoming celebrations surface on the Home page."
          checked={settings.show_on_home}
          onChange={togglable('show_on_home')}
          disabled={!isAdmin || saving}
        />
        <Row
          label="Show in Connect"
          description="Surface upcoming celebrations in the Connect / Feed area."
          checked={settings.show_in_connect}
          onChange={togglable('show_in_connect')}
          disabled={!isAdmin || saving}
        />
        <Row
          label="Show on member profiles"
          description="Display birthday + club milestones on profile pages (respects member privacy)."
          checked={settings.show_on_profiles}
          onChange={togglable('show_on_profiles')}
          disabled={!isAdmin || saving}
        />
        <Row
          label="Members can add their own birthday"
          description="If off, only admins can manage member birthdays."
          checked={settings.allow_members_to_add_birthdays}
          onChange={togglable('allow_members_to_add_birthdays')}
          disabled={!isAdmin || saving}
        />
        <Row
          label="Members can create milestones"
          description="If on, members can submit milestones (admins can still edit or delete them)."
          checked={settings.allow_members_to_create_milestones}
          onChange={togglable('allow_members_to_create_milestones')}
          disabled={!isAdmin || saving}
        />
        <Row
          label="Auto-generate celebration prompts"
          description="On birthday/milestone day, suggest a Connect post template to members."
          checked={settings.auto_generate_connect_prompts}
          onChange={togglable('auto_generate_connect_prompts')}
          disabled={!isAdmin || saving}
        />
        <Row
          label="Day-of reminder"
          description="Remind members on the day of a celebration."
          checked={settings.day_of_reminder}
          onChange={togglable('day_of_reminder')}
          disabled={!isAdmin || saving}
        />

        {/* Reminder window picker */}
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-bold leading-tight">Reminder window</p>
              <p className="text-[10.5px] text-muted-foreground/70 leading-snug mt-0.5">
                How many days before a celebration to send a heads-up.
              </p>
            </div>
            <select
              value={settings.reminder_days_before}
              onChange={e => save({ reminder_days_before: parseInt(e.target.value, 10) })}
              disabled={!isAdmin || saving}
              className="h-9 rounded-lg px-2.5 text-[11px] font-bold bg-muted/30 border border-border/40 text-foreground flex-shrink-0"
            >
              {[0, 1, 3, 7, 14, 30].map(n => (
                <option key={n} value={n}>{n === 0 ? 'Day-of only' : `${n}d before`}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Row({
  label, description, checked, onChange, disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold leading-tight">{label}</p>
        <p className="text-[10.5px] text-muted-foreground/70 leading-snug mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="mt-0.5" />
    </div>
  );
}
