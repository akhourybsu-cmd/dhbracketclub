// DH Club — Narrative RPG · Home widget
//
// Compact home-screen presence for the Narrative RPG plugin. Surfaces:
//   • Active campaigns the user is in (top item)
//   • A small admin nudge if there are pending approvals
//
// Renders nothing if plugin not installed OR there are no campaigns
// the current user can see. Strictly uses only PUBLIC campaign data —
// no GM-only notes, no hidden clocks, no AI suggestions surfaced here.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScrollText, ChevronRight } from 'lucide-react';
import { useNarrativeCampaigns } from '@/hooks/useNarrativeCampaigns';
import { useClub } from '@/contexts/ClubContext';
import { SectionHeader } from '@/components/home/SectionHeader';
import { CampaignStatusPill } from './CampaignStatusPill';

interface Props {
  enabled: boolean;
}

export function NarrativeHomeWidget({ enabled }: Props) {
  const { isClubAdmin } = useClub();
  const { campaigns, loading } = useNarrativeCampaigns();

  if (!enabled || loading) return null;
  const active = campaigns.filter(c => c.status === 'active');
  const pending = campaigns.filter(c => c.status === 'pending_approval');

  if (active.length === 0 && (!isClubAdmin || pending.length === 0)) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mb-4"
    >
      <SectionHeader
        label="Narrative RPG"
        icon={ScrollText}
        to="/narrative"
        linkLabel="All"
        count={active.length || undefined}
      />
      <div className="space-y-2">
        {/* Active campaigns first */}
        {active.slice(0, 2).map(c => (
          <Link
            key={c.id}
            to={`/narrative/${c.id}`}
            className="block rounded-2xl bg-card border border-border/40 p-3 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.16), hsl(var(--primary) / 0.04))', color: 'hsl(var(--primary))' }}>
                <ScrollText className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[13px] font-extrabold tracking-tight truncate">{c.title}</p>
                  <CampaignStatusPill status={c.status} withPulse />
                </div>
                {c.pitch && <p className="text-[11px] text-muted-foreground/75 leading-snug mt-0.5 line-clamp-1">{c.pitch}</p>}
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/55 mt-1 flex-shrink-0" />
            </div>
          </Link>
        ))}

        {/* Admin nudge */}
        {isClubAdmin && pending.length > 0 && (
          <Link
            to="/club/settings"
            className="block rounded-xl border p-2.5 active:scale-[0.99] transition-transform"
            style={{ borderColor: 'hsl(38 95% 50% / 0.45)', background: 'hsl(38 95% 50% / 0.06)' }}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(38 90% 50%)' }}>Action needed</p>
            <p className="text-[12px] text-foreground/85 mt-0.5">
              {pending.length} campaign{pending.length === 1 ? '' : 's'} waiting for your approval.
            </p>
          </Link>
        )}
      </div>
    </motion.section>
  );
}
