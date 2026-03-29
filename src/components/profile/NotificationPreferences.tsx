import { Switch } from '@/components/ui/switch';
import { MessageCircle, BarChart3, CalendarDays, Bookmark } from 'lucide-react';
import { useNotificationPreferences, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { toast } from 'sonner';

const PREF_ITEMS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: typeof MessageCircle;
}[] = [
  { key: 'chat_messages', label: 'Chat Messages', description: 'New messages in chat channels', icon: MessageCircle },
  { key: 'polls', label: 'Polls', description: 'New polls and voting updates', icon: BarChart3 },
  { key: 'events', label: 'Events', description: 'Event reminders and RSVPs', icon: CalendarDays },
  { key: 'drafts', label: 'Drafts', description: 'Draft picks and turn alerts', icon: Bookmark },
];

export default function NotificationPreferencesSection() {
  const { prefs, loading, update } = useNotificationPreferences();
  const { play } = useSoundEffect();

  if (loading) return null;

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
    </div>
  );
}
