// DH Club — Narrative RPG · Game Master onboarding sheet
//
// Shown once per (user, campaign) on the first GM open of a campaign
// detail page. Replaces the prior "auto-seed everything on creation"
// behavior with a guided choice:
//
//   1. Walks the GM through the setting/tone for the chosen template.
//   2. Lists the suggested starter content (NPCs / locations /
//      factions / clues / clocks / opening scene).
//   3. Offers an opt-in "Pre-fill these into my campaign" button that
//      runs the seeder with includeStarterAssets=true. Skip → blank
//      campaign, GM populates as they go.
//   4. Shows a quick GM Console tour (Scene / NPCs / Clues / etc.)
//      with a single "Got it" dismiss.
//
// Dismissed state is stored in localStorage so the GM never sees it
// twice on the same device. Other devices show it once, which is
// intentional — onboarding is per-device-per-campaign by design.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Sparkles, Loader2, Wand2, Users as UsersIcon, MapPin,
  KeyRound, ShieldAlert, Clock as ClockIcon, Megaphone, ChevronRight, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { FLAMINGO } from '@/lib/narrative/flamingoTheme';
import { SPRING_SOFT, TAP_PRESS, haptic } from '@/lib/narrative/motion';
import { getTemplate, type TemplateKey } from '@/lib/narrative/templates';
import { seedCampaignFromTemplate } from '@/lib/narrative/templateSeeder';
import type { Campaign } from '@/lib/narrative/types';

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  flamingo: boolean;
  /** Called after a successful starter-asset seed so the parent can
   *  refresh and surface the new rows. */
  onSeeded?: () => void;
}

type Step = 'setting' | 'starter' | 'console';

export function GmOnboardingSheet({ open, onClose, campaign, flamingo, onSeeded }: Props) {
  const [step, setStep] = useState<Step>('setting');
  const [seeding, setSeeding] = useState(false);
  const template = getTemplate(campaign.template_key as TemplateKey);

  useEffect(() => {
    if (open) setStep('setting');
  }, [open]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKeyFor(campaign.id), '1');
    } catch {
      // Storage may be blocked (private mode). The sheet will reopen
      // on next visit; acceptable.
    }
    onClose();
  };

  const seedNow = async () => {
    setSeeding(true);
    haptic('medium');
    const report = await seedCampaignFromTemplate(campaign.id, campaign.template_key, {
      includeStarterAssets: true,
    });
    setSeeding(false);
    const total =
      report.inserted.locations + report.inserted.npcs + report.inserted.factions
      + report.inserted.clues + report.inserted.clocks + report.inserted.scenes;
    if (report.errors.length > 0) {
      toast.warning(`Seeded ${total} starter items. ${report.errors.length} failed — check the GM Console.`);
    } else if (total > 0) {
      toast.success(`Seeded ${total} starter items.`);
    } else {
      toast.message('Starter items are already in place.');
    }
    onSeeded?.();
    setStep('console');
  };

  if (!open || typeof document === 'undefined') return null;
  const accent = flamingo ? FLAMINGO.pink : 'var(--primary)';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[78] flex items-end sm:items-center justify-center"
          style={{
            background: flamingo ? `hsl(${FLAMINGO.midnight} / 0.78)` : 'hsl(218 50% 3% / 0.62)',
            backdropFilter: 'blur(10px)',
          }}
          onClick={dismiss}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0, transition: { duration: 0.18 } }}
            transition={SPRING_SOFT}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[92dvh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
            style={{
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
              background: flamingo
                ? `linear-gradient(180deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`
                : 'hsl(var(--card))',
              border: flamingo ? `1px solid hsl(${accent} / 0.45)` : '1px solid hsl(var(--border) / 0.5)',
              color: flamingo ? `hsl(${FLAMINGO.paper})` : undefined,
              boxShadow: flamingo ? `0 -10px 40px -10px hsl(${accent} / 0.6)` : '0 -10px 40px -10px hsl(0 0% 0% / 0.5)',
            }}
          >
            <div aria-hidden className="flex items-center justify-center pt-2 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: flamingo ? `hsl(${FLAMINGO.paper} / 0.25)` : 'hsl(var(--border))' }} />
            </div>

            {/* Header */}
            <div className="px-4 pt-2 pb-3 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.24em] inline-flex items-center gap-1"
                  style={{ color: `hsl(${accent})` }}
                >
                  <Sparkles className="w-3 h-3" /> Game Master onboarding
                </p>
                <h2
                  className="font-display text-[20px] sm:text-[24px] font-extrabold tracking-tight leading-[1.05] mt-1"
                  style={flamingo ? {
                    backgroundImage: `linear-gradient(90deg, hsl(${FLAMINGO.paper}), hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.cyan}))`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                  } : undefined}
                >
                  {step === 'setting' && (flamingo ? 'Welcome to Velvetaine' : `Welcome — ${template.name}`)}
                  {step === 'starter' && 'Start blank or pre-fill?'}
                  {step === 'console' && "Your GM Console at a glance"}
                </h2>
              </div>
              <motion.button
                type="button"
                whileTap={TAP_PRESS}
                onClick={dismiss}
                aria-label="Close"
                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                style={flamingo ? {
                  background: `hsl(${FLAMINGO.ink})`,
                  border: `1px solid hsl(${accent} / 0.4)`,
                  color: `hsl(${FLAMINGO.paper})`,
                } : { background: 'hsl(var(--muted) / 0.4)', border: '1px solid hsl(var(--border) / 0.4)' }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Step body */}
            <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-4">
              {step === 'setting' && <SettingStep template={template} flamingo={flamingo} accent={accent} />}
              {step === 'starter' && <StarterStep template={template} flamingo={flamingo} accent={accent} />}
              {step === 'console' && <ConsoleStep flamingo={flamingo} accent={accent} />}
            </div>

            {/* Footer nav */}
            <div
              className="px-4 pt-3 border-t flex items-center justify-between gap-2"
              style={{ borderColor: flamingo ? `hsl(${FLAMINGO.paper} / 0.12)` : 'hsl(var(--border) / 0.4)' }}
            >
              <StepDots step={step} flamingo={flamingo} />
              <div className="flex items-center gap-2">
                {step === 'setting' && (
                  <motion.button
                    type="button"
                    whileTap={TAP_PRESS}
                    onClick={() => setStep('starter')}
                    className="h-10 px-4 rounded-xl text-[12px] font-extrabold inline-flex items-center gap-1.5 active:scale-[0.98]"
                    style={primaryBtnStyle(flamingo)}
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </motion.button>
                )}
                {step === 'starter' && (
                  <>
                    <motion.button
                      type="button"
                      whileTap={TAP_PRESS}
                      onClick={() => setStep('console')}
                      disabled={seeding}
                      className="h-10 px-3 rounded-xl text-[11.5px] font-bold inline-flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
                      style={{
                        background: flamingo ? `hsl(${FLAMINGO.ink})` : 'hsl(var(--muted) / 0.4)',
                        border: flamingo ? `1px solid hsl(${FLAMINGO.paper} / 0.18)` : '1px solid hsl(var(--border) / 0.5)',
                        color: flamingo ? `hsl(${FLAMINGO.paper})` : undefined,
                      }}
                    >
                      Start blank
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={TAP_PRESS}
                      onClick={seedNow}
                      disabled={seeding}
                      className="h-10 px-3 rounded-xl text-[11.5px] font-extrabold inline-flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-55"
                      style={primaryBtnStyle(flamingo)}
                    >
                      {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Pre-fill starters
                    </motion.button>
                  </>
                )}
                {step === 'console' && (
                  <motion.button
                    type="button"
                    whileTap={TAP_PRESS}
                    onClick={dismiss}
                    className="h-10 px-4 rounded-xl text-[12px] font-extrabold inline-flex items-center gap-1.5 active:scale-[0.98]"
                    style={primaryBtnStyle(flamingo)}
                  >
                    <Check className="w-3.5 h-3.5" /> Got it
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ──────────────────────────────────────────────────────────────────────
// Steps
// ──────────────────────────────────────────────────────────────────────

function SettingStep({ template, flamingo, accent }: { template: ReturnType<typeof getTemplate>; flamingo: boolean; accent: string }) {
  return (
    <>
      <p className="text-[13px] leading-relaxed" style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.92)` : undefined }}>
        {template.setting || 'A blank canvas — define your own setting and tone in the GM Console.'}
      </p>
      {template.canonLocks && template.canonLocks.length > 0 && (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] mb-1.5" style={{ color: `hsl(${accent})` }}>
            Canon locks
          </p>
          <ul className="space-y-1.5 text-[12px] leading-snug">
            {template.canonLocks.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[14px] leading-none mt-0.5 flex-shrink-0" style={{ color: `hsl(${accent})` }}>•</span>
                <span style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.88)` : undefined }}>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {template.toneGuide && (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] mb-1.5" style={{ color: `hsl(${accent})` }}>
            Tone
          </p>
          <p className="text-[12px] italic leading-snug" style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.78)` : 'hsl(var(--muted-foreground) / 0.85)' }}>
            {template.toneGuide}
          </p>
        </div>
      )}
    </>
  );
}

function StarterStep({ template, flamingo, accent }: { template: ReturnType<typeof getTemplate>; flamingo: boolean; accent: string }) {
  const counts = {
    npcs: template.starterNpcs?.length ?? 0,
    locations: template.starterLocations?.length ?? 0,
    factions: template.starterFactions?.length ?? 0,
    clues: template.starterClues?.length ?? 0,
    clocks: template.starterClocks?.length ?? 0,
    scene: template.starterScene ? 1 : 0,
  };
  const total = counts.npcs + counts.locations + counts.factions + counts.clues + counts.clocks + counts.scene;
  return (
    <>
      <p className="text-[13px] leading-relaxed" style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.92)` : undefined }}>
        Your campaign starts as a blank canvas. You can either pre-fill the suggested starter content for {template.name} — useful for jumping straight in — or skip and add only what you need.
      </p>
      {total > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <CountTile flamingo={flamingo} icon={<UsersIcon className="w-3.5 h-3.5" />} count={counts.npcs} label="NPCs" />
          <CountTile flamingo={flamingo} icon={<MapPin className="w-3.5 h-3.5" />} count={counts.locations} label="Locations" />
          <CountTile flamingo={flamingo} icon={<ShieldAlert className="w-3.5 h-3.5" />} count={counts.factions} label="Factions" />
          <CountTile flamingo={flamingo} icon={<KeyRound className="w-3.5 h-3.5" />} count={counts.clues} label="Clues" />
          <CountTile flamingo={flamingo} icon={<ClockIcon className="w-3.5 h-3.5" />} count={counts.clocks} label="Clocks" />
          <CountTile flamingo={flamingo} icon={<Megaphone className="w-3.5 h-3.5" />} count={counts.scene} label="Opening scene" />
        </div>
      )}
      <p className="text-[11px] leading-snug" style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.62)` : 'hsl(var(--muted-foreground) / 0.7)' }}>
        Whichever you pick, you can always add or remove these later from the GM Console.
      </p>
    </>
  );
}

function ConsoleStep({ flamingo, accent }: { flamingo: boolean; accent: string }) {
  const tips = [
    { icon: <Megaphone className="w-3.5 h-3.5" />, label: 'Scene', body: 'Open a scene to set the stage. Players post against the active scene.' },
    { icon: <UsersIcon className="w-3.5 h-3.5" />, label: 'NPCs / Cast', body: 'Add the people the crew will meet. Public NPCs show in the City tab.' },
    { icon: <KeyRound className="w-3.5 h-3.5" />, label: 'Evidence', body: 'Drop clues for the players to find. Status = discovered / partial / solved / false lead.' },
    { icon: <ClockIcon className="w-3.5 h-3.5" />, label: 'Clocks', body: 'Build tension with countdown clocks. Public ones show to everyone.' },
    { icon: <Wand2 className="w-3.5 h-3.5" />, label: "Writer's Room", body: 'AI can draft narration, dialogue, consequences, and roll resolutions — you stay in control.' },
  ];
  return (
    <>
      <p className="text-[13px] leading-relaxed" style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.92)` : undefined }}>
        Tap the <span className="font-extrabold">GM</span> button in the header to open your console. The most-used tabs:
      </p>
      <div className="space-y-1.5">
        {tips.map(t => (
          <div
            key={t.label}
            className="rounded-xl p-2.5 flex items-start gap-2.5"
            style={{
              background: flamingo ? `hsl(${FLAMINGO.ink} / 0.7)` : 'hsl(var(--muted) / 0.25)',
              border: flamingo ? `1px solid hsl(${FLAMINGO.paper} / 0.12)` : '1px solid hsl(var(--border) / 0.4)',
            }}
          >
            <span className="flex-shrink-0 mt-0.5" style={{ color: `hsl(${accent})` }}>{t.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-extrabold">{t.label}</p>
              <p
                className="text-[11px] leading-snug mt-0.5"
                style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.7)` : 'hsl(var(--muted-foreground) / 0.78)' }}
              >
                {t.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function CountTile({ flamingo, icon, count, label }: { flamingo: boolean; icon: React.ReactNode; count: number; label: string }) {
  return (
    <div
      className="rounded-lg p-2.5 flex items-center gap-2"
      style={{
        background: flamingo ? `hsl(${FLAMINGO.ink} / 0.65)` : 'hsl(var(--muted) / 0.25)',
        border: flamingo ? `1px solid hsl(${FLAMINGO.paper} / 0.12)` : '1px solid hsl(var(--border) / 0.4)',
        opacity: count > 0 ? 1 : 0.45,
      }}
    >
      <span className="flex-shrink-0" style={{ color: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--primary))' }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold tabular-nums leading-none">{count}</p>
        <p className="text-[9.5px] font-bold uppercase tracking-wider mt-0.5"
           style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.6)` : 'hsl(var(--muted-foreground) / 0.75)' }}>
          {label}
        </p>
      </div>
    </div>
  );
}

function StepDots({ step, flamingo }: { step: Step; flamingo: boolean }) {
  const steps: Step[] = ['setting', 'starter', 'console'];
  return (
    <div className="flex items-center gap-1.5">
      {steps.map(s => (
        <span
          key={s}
          className="rounded-full transition-all"
          style={{
            width: s === step ? 20 : 6,
            height: 6,
            background: s === step
              ? (flamingo ? `hsl(${FLAMINGO.pink})` : 'hsl(var(--primary))')
              : (flamingo ? `hsl(${FLAMINGO.paper} / 0.25)` : 'hsl(var(--border))'),
          }}
        />
      ))}
    </div>
  );
}

function primaryBtnStyle(flamingo: boolean): React.CSSProperties {
  return flamingo
    ? {
        background: `linear-gradient(135deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.violet}))`,
        color: `hsl(${FLAMINGO.paper})`,
        boxShadow: `0 0 14px -3px hsl(${FLAMINGO.pink} / 0.6)`,
        border: `1px solid hsl(${FLAMINGO.pink})`,
      }
    : {
        background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
        color: 'hsl(var(--primary-foreground))',
      };
}

function storageKeyFor(campaignId: string) {
  return `dh_narrative_gm_onboarding_v1:${campaignId}`;
}

/** Returns true if the GM has not seen onboarding for this campaign on
 *  this device. Cheap helper so the caller can decide whether to mount
 *  the sheet without doing an effect dance. */
export function gmOnboardingNeeded(campaignId: string): boolean {
  try {
    return localStorage.getItem(storageKeyFor(campaignId)) !== '1';
  } catch {
    return true;
  }
}
