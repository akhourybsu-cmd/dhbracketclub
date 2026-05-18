// DH Club — Narrative RPG · Live session presence row
//
// Compact strip showing who's actively online in this campaign right
// now. Renders nothing when nobody else is here. Pairs naturally with
// LiveSessionControls in the campaign detail header — the GM sees it
// when starting a live session, players see it as they join.

import { Users } from 'lucide-react';
import { useNarrativePresence, type OnlineNarrativeUser } from '@/hooks/useNarrativePresence';

interface Props {
  campaignId: string;
  myDisplayName?: string;
  myCharacterId?: string | null;
  myCharacterName?: string | null;
  /** Hide the row entirely when no one else is online (default true). */
  hideWhenAlone?: boolean;
}

export function LiveSessionPresence({
  campaignId, myDisplayName, myCharacterId, myCharacterName, hideWhenAlone = true,
}: Props) {
  const { onlineUsers, onlineCount } = useNarrativePresence(campaignId, {
    myDisplayName, myCharacterId, myCharacterName,
  });

  // "Alone" = only the current user is online.
  if (hideWhenAlone && onlineCount <= 1) return null;

  // Limit avatar strip to 6 + N more.
  const visible = onlineUsers.slice(0, 6);
  const overflow = Math.max(0, onlineCount - visible.length);

  return (
    <div
      className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-success/40"
      style={{ background: 'hsl(var(--success) / 0.08)' }}
    >
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'hsl(var(--success))' }}>
        <Users className="w-3 h-3" /> {onlineCount} online
      </span>
      <div className="flex -space-x-1.5">
        {visible.map(u => <PresenceAvatar key={u.userId} user={u} />)}
        {overflow > 0 && (
          <span className="w-6 h-6 rounded-full bg-muted/60 flex items-center justify-center text-[9px] font-extrabold ring-2 ring-background tabular-nums">
            +{overflow}
          </span>
        )}
      </div>
    </div>
  );
}

function PresenceAvatar({ user }: { user: OnlineNarrativeUser }) {
  // Prefer character name initial over display name when available.
  const label = (user.characterName ?? user.displayName ?? '?').charAt(0).toUpperCase();
  return (
    <span
      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-extrabold ring-2 ring-background"
      style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--primary) / 0.1))', color: 'hsl(var(--primary))' }}
      title={user.characterName ?? user.displayName ?? 'Online'}
    >
      {label}
    </span>
  );
}
