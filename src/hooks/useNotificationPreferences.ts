import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface NotificationPreferences {
  chat_messages: boolean;
  polls: boolean;
  events: boolean;
  drafts: boolean;
  mentions: boolean;
  lockbox: boolean;
}

const DEFAULTS: NotificationPreferences = {
  chat_messages: true,
  polls: true,
  events: true,
  drafts: true,
  mentions: true,
  lockbox: true,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchPrefs = async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('chat_messages, polls, events, drafts, mentions')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setPrefs(data as NotificationPreferences);
      }
      setLoading(false);
    };
    fetchPrefs();
  }, [user]);

  const update = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      if (!user) return;
      const updated = { ...prefs, [key]: value };
      setPrefs(updated);

      await supabase.from('notification_preferences').upsert(
        {
          user_id: user.id,
          ...updated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    },
    [user, prefs]
  );

  return { prefs, loading, update };
}
