// Birthdays & Milestones — Profile section
//
// Compact section shown on the caller's Profile page (self-only). Shows
// the user's own birthday (with privacy summary) and an "Edit" CTA that
// opens the AddBirthdayModal. Renders nothing if the plugin isn't
// installed or `show_on_profiles` is off.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cake, ChevronRight, Lock, EyeOff } from 'lucide-react';
import { useClubAssets } from '@/hooks/useClubAssets';
import { useCelebrationSettings, useMyBirthday } from '@/hooks/useCelebrations';
import { formatMonthDay, computeAge } from '@/lib/celebrations/dates';
import { AddBirthdayModal } from './AddBirthdayModal';

const ACCENT = '14 90% 60%';

export function ProfileCelebrationsSection() {
  const { isInstalled } = useClubAssets();
  const installed = isInstalled('birthdays-milestones');
  const { settings } = useCelebrationSettings();
  const { birthday, loading } = useMyBirthday();
  const [open, setOpen] = useState(false);

  if (!installed) return null;
  if (settings && !settings.show_on_profiles) return null;
  if (loading) return null;

  const visibilityLabel =
    birthday?.visibility === 'admins_only' ? 'Admins only' :
    birthday?.visibility === 'hidden'      ? 'Hidden' :
    'Visible to club';
  const VisibilityIcon =
    birthday?.visibility === 'admins_only' ? Lock :
    birthday?.visibility === 'hidden'      ? EyeOff :
    null;

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
          border: `1px solid hsl(${ACCENT} / 0.24)`,
        }}
      >
        <div
          className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/15"
          style={{ background: `radial-gradient(ellipse 80% 60% at 100% 0%, hsl(${ACCENT} / 0.12), transparent 70%)` }}
        >
          <Cake className="w-3 h-3 flex-shrink-0" style={{ color: `hsl(${ACCENT})` }} />
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: `hsl(${ACCENT})` }}>
            Celebrations
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left px-3.5 py-3 flex items-center gap-3 hover:bg-muted/15 transition-colors active:scale-[0.998]"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, hsl(${ACCENT} / 0.20), hsl(${ACCENT} / 0.04))`,
              border: `1px solid hsl(${ACCENT} / 0.28)`,
              color: `hsl(${ACCENT})`,
            }}
          >
            <Cake className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold leading-tight">
              {birthday
                ? `Birthday: ${formatMonthDay(birthday.birth_month, birthday.birth_day)}`
                : 'Add your birthday'}
            </p>
            <p className="text-[10.5px] text-muted-foreground/70 leading-snug mt-0.5 flex items-center gap-1 truncate">
              {birthday ? (
                <>
                  {birthday.show_age && birthday.birth_year && (
                    <>Age: {computeAge(birthday.birth_year, birthday.birth_month, birthday.birth_day)} · </>
                  )}
                  {VisibilityIcon && <VisibilityIcon className="w-2.5 h-2.5" />}
                  {visibilityLabel}
                </>
              ) : (
                "Let your club celebrate you. Year is optional and stays private."
              )}
            </p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/55 flex-shrink-0" />
        </button>
      </motion.section>

      <AddBirthdayModal open={open} onClose={() => setOpen(false)} accent={ACCENT} />
    </>
  );
}
