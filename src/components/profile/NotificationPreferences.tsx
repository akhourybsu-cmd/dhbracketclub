import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { MessageCircle, BarChart3, CalendarDays, Bookmark, Bell, AtSign, Lock } from 'lucide-react';
import { useNotificationPreferences, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const PREF_ITEMS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: typeof MessageCircle;
}[] = [
  { key: 'chat_messages', label: 'Chat Messages', description: 'New messages in chat channels', icon: MessageCircle },
  { key: 'mentions', label: 'Mentions', description: '@mentions always break through (even when chat is off)', icon: AtSign },
  { key: 'polls', label: 'Polls', description: 'New polls and voting updates', icon: BarChart3 },
  { key: 'events', label: 'Events', description: 'New events and RSVPs', icon: CalendarDays },
  { key: 'drafts', label: 'Drafts', description: 'Draft picks and turn alerts', icon: Bookmark },
];

export default function NotificationPreferencesSection() {
  const { prefs, loading, update } = useNotificationPreferences();
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();
  const { play } = useSoundEffect();
  const { user } = useAuth();
  const [testingSend, setTestingSend] = useState(false);

  if (loading) return null;

  const handleTestPush = async () => {
    if (!user) return;
    setTestingSend(true);
    try {
      if (!isSubscribed) {
        const ok = await subscribe();
        if (!ok) {
          toast.error('Please allow notification permissions first');
          setTestingSend(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: { test: true, user_id: user.id },
      });
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success('Test notification sent! Check your notifications.');
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.error('No test notification was delivered. Turn Push Notifications off and on, then try again.');
      }
    } catch (err: any) {
      console.error('Test push error:', err);
      toast.error('Failed to send test notification');
    }
    setTestingSend(false);
  };

  return (
    <div className="glass-card p-5 mb-4 space-y-4">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">
        Notification Preferences
      </h3>
      {PREF_ITEMS.map(({ key, label, description, icon: Icon }) => (
        <div key={key} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="w-4 h-4 text-primary" />
            <div>
              <p className="text-[13px] font-semibold">{label}</p>
              <p className="text-[10px] text-muted-foreground">{description}</p>
            </div>
          </div>
          <Switch
            checked={prefs[key]}
            onCheckedChange={async (checked) => {
              await update(key, checked);
              play('tap');
              toast.success(`${label} notifications ${checked ? 'enabled' : 'disabled'}`);
            }}
          />
        </div>
      ))}

      {isSupported && (
        <div className="pt-2 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={handleTestPush}
            disabled={testingSend}
          >
            <Bell className="w-3.5 h-3.5" />
            {testingSend ? 'Sending…' : 'Send Test Notification'}
          </Button>
        </div>
      )}
    </div>
  );
}
