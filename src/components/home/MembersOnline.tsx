// DH Club Home — Members online strip
//
// Compact presence module: a row of overlapping member avatars + a count.
// Uses the same Supabase realtime channel pattern that other surfaces use
// so multiple devices for a single user dedupe cleanly. Renders nothing
// when there are no other members online.
//
// Tapping the strip jumps to club chat.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { UserAvatar } from '@/components/chat/UserAvatar';

interface OnlineUser { id: string; name: string; avatar?: string }

interface Props {
  /** Display name + optional avatar URL of the current user, used for presence tracking. */
  myDisplayName: string;
  myAvatarUrl: string | null;
  accent: string;
}

export function MembersOnline({ myDisplayName, myAvatarUrl, accent }: Props) {
  const { user } = useAuth();
  const { club } = useClub();
  const [users, setUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!user || !myDisplayName || !club?.id) return;
    // Club-scoped presence channel — members only see others in their own club.
    const channel = supabase.channel(`online-presence:${club.id}`, { config: { presence: { key: user.id } } });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const flat = Object.values(state).flat().map((p: any) => ({
          id: p.user_id as string,
          name: p.display_name as string,
          avatar: p.avatar_url as string | undefined,
        }));
        // Dedupe across devices for a single user.
        const seen = new Set<string>();
        setUsers(flat.filter(u => seen.has(u.id) ? false : (seen.add(u.id), true)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, display_name: myDisplayName, avatar_url: myAvatarUrl });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [user, myDisplayName, myAvatarUrl, club?.id]);

  if (users.length <= 1) return null; // only me online (or nobody)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mb-5"
    >
      <Link
        to="/chat"
        className="block active:scale-[0.99] transition-transform"
      >
        <div
          className="rounded-2xl p-2.5 flex items-center gap-3"
          style={{
            background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.9))',
            border: `1px solid hsl(${accent} / 0.22)`,
          }}
        >
          <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: `hsl(${accent})` }} />
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] flex-shrink-0" style={{ color: `hsl(${accent})` }}>
            Online
          </p>
          <div className="flex -space-x-1.5 flex-1 min-w-0">
            {users.slice(0, 6).map(u => (
              <div key={u.id} className="ring-2 ring-background rounded-full">
                <UserAvatar userId={u.id} name={u.name} avatarUrl={u.avatar} size={22} />
              </div>
            ))}
          </div>
          <span className="text-[10.5px] font-bold text-foreground/70 flex items-center gap-1 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {users.length}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
        </div>
      </Link>
    </motion.div>
  );
}
