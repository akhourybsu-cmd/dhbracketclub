// Single source of truth for how channel types render across the app.
// Used by ChatPage header, ChannelList rows, and ChannelSettingsDialog
// so visual treatment stays consistent.

import { Hash, Megaphone, Shield, CalendarDays } from 'lucide-react';
import type { ChannelType } from './types';

export interface ChannelTypeMeta {
  label: string;
  hint: string;
  icon: typeof Hash;
  /** Token-based accent color (HSL components, no `hsl()` wrapper). */
  accent: string;
  /** Foreground class for the chip text. */
  chipTextClass: string;
}

const TOKEN_PRIMARY = 'var(--primary)';
const TOKEN_WARM    = 'var(--premium-warm)';
const TOKEN_DESTRUC = 'var(--destructive)';
const TOKEN_INFO    = 'var(--primary)';

export const CHANNEL_TYPE_META: Record<ChannelType, ChannelTypeMeta> = {
  general: {
    label: 'General',
    hint: 'Everyone can post',
    icon: Hash,
    accent: TOKEN_PRIMARY,
    chipTextClass: 'text-primary',
  },
  announcements: {
    label: 'Announcements',
    hint: 'Admins post, members read',
    icon: Megaphone,
    accent: TOKEN_WARM,
    chipTextClass: 'text-[hsl(var(--premium-warm))]',
  },
  admin_only: {
    label: 'Admin Only',
    hint: 'Only admins see or post',
    icon: Shield,
    accent: TOKEN_DESTRUC,
    chipTextClass: 'text-destructive',
  },
  event: {
    label: 'Event',
    hint: 'Tied to a club event',
    icon: CalendarDays,
    accent: TOKEN_INFO,
    chipTextClass: 'text-primary',
  },
};

export function getChannelTypeMeta(type: ChannelType | undefined | null): ChannelTypeMeta {
  return CHANNEL_TYPE_META[(type ?? 'general') as ChannelType] ?? CHANNEL_TYPE_META.general;
}

export const CHANNEL_TYPE_ORDER: ChannelType[] = ['general', 'announcements', 'admin_only', 'event'];
