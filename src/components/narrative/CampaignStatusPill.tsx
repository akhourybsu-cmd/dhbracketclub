// DH Club — Narrative RPG · Campaign status pill
//
// Thin wrapper around the shared StatusPill that maps every campaign
// status onto a semantic variant. Lets every list / detail / home-widget
// surface render statuses the same way.

import { StatusPill, type StatusPillVariant } from '@/components/ui/status-pill';
import type { CampaignStatus } from '@/lib/narrative/types';
import type { ComputedStatus } from '@/lib/narrative/campaignStatus';

/** Accepts either a raw DB status or a computed status. */
type StatusInput = CampaignStatus | 'live' | ComputedStatus;

interface Props {
  status: StatusInput;
  /** Force a small or extra-small render. */
  size?: 'xs' | 'sm';
  /** Animate the dot if true (used for `live` and `pending_approval`). */
  withPulse?: boolean;
}

interface StatusMeta {
  label: string;
  variant: StatusPillVariant;
  dot?: boolean;
}

const META: Record<StatusInput, StatusMeta> = {
  draft:              { label: 'Draft',              variant: 'neutral' },
  pending_approval:   { label: 'Pending Approval',   variant: 'pending', dot: true },
  needs_changes:      { label: 'Needs Changes',      variant: 'warning' },
  rejected:           { label: 'Rejected',           variant: 'danger' },
  active:             { label: 'Active',             variant: 'success', dot: true },
  paused:             { label: 'Paused',             variant: 'neutral' },
  completed:          { label: 'Completed',          variant: 'info' },
  archived:           { label: 'Archived',           variant: 'disabled' },
  live:               { label: 'Live Now',           variant: 'live',    dot: true },
  waiting_on_gm:      { label: 'Waiting on GM',      variant: 'warning', dot: true },
  waiting_on_players: { label: 'Waiting on Players', variant: 'info',    dot: true },
};

export function CampaignStatusPill({ status, size = 'xs', withPulse }: Props) {
  const meta = META[status];
  if (!meta) return null;
  return (
    <StatusPill
      variant={meta.variant}
      size={size}
      dot={meta.dot}
      pulse={withPulse && meta.dot}
    >
      {meta.label}
    </StatusPill>
  );
}
