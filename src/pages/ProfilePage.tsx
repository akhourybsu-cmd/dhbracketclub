import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { LogOut, User, Volume2, VolumeX, BarChart3, MessageCircle, CalendarDays, MessageSquareText, Trophy, Bookmark, Zap, Sun, Moon, Bell, BellOff } from 'lucide-react';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import dhMonogram from '@/assets/dh-monogram.png';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { formatDistanceToNow } from 'date-fns';
import NotificationPreferencesSection from '@/components/profile/NotificationPreferences';

export default function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { play, soundEnabled, toggleSound } = useSoundEffect();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications();
  const [stats, setStats] = useState({ polls: 0, rankings: 0, events: 0, messages: 0, drafts: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const [{ data: profile }, { data: pollVotes }, { data: rankSubs }, { data: rsvps }, { data: activity }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', user.id).single(),
        supabase.from('poll_votes').select('id').eq('user_id', user.id),
        supabase.from('ranking_submissions').select('id').eq('user_id', user.id),
        supabase.from('event_rsvps').select('id').eq('user_id', user.id).eq('status', 'going'),
        supabase.from('activity_feed').select('*, profiles:actor_user_id(display_name)').eq('actor_user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ]);
      if (profile) setDisplayName(profile.display_name);
      setStats({
        polls: pollVotes?.length || 0,
        rankings: rankSubs?.length || 0,
        events: rsvps?.length || 0,
        messages: 0,
        drafts: 0,
      });
      if (activity) setRecentActivity(activity);
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id);

    if (error) {
      toast.error(error.message);
      play('error');
    } else {
      toast.success('Profile updated!');
      play('success');
    }
    setLoading(false);
  };

  const ACTIVITY_ICONS: Record<string, { icon: any; color: string }> = {
    ranking_created: { icon: BarChart3, color: 'accent' },
    ranking_submitted: { icon: BarChart3, color: 'accent' },
    poll_created: { icon: MessageCircle, color: 'warning' },
    poll_voted: { icon: MessageCircle, color: 'warning' },
    draft_created: { icon: Bookmark, color: 'gold' },
    draft_completed: { icon: Bookmark, color: 'gold' },
    bracket_submitted: { icon: Trophy, color: 'primary' },
    event_created: { icon: CalendarDays, color: 'success' },
    post_created: { icon: MessageSquareText, color: 'primary' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 380, damping: 30 }}
      className="max-w-md mx-auto"
    >
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-icon">
          <User />
        </div>
        <div>
          <h1 className="page-header-title">Profile</h1>
          <p className="page-header-subtitle">Manage your DH account</p>
        </div>
      </div>

      {/* Identity card */}
      <div className="glass-card arena-edge p-6 mb-4">
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-primary relative" style={{
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.04))',
            border: '1px solid hsl(var(--primary) / 0.1)',
            boxShadow: '0 0 20px hsl(var(--primary) / 0.06)',
          }}>
            {displayName ? displayName[0].toUpperCase() : '?'}
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">{displayName}</p>
            <p className="text-[11px] text-muted-foreground/60 font-medium mt-0.5">{user?.email}</p>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <div>
            <label className="form-label">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="form-input" />
          </div>

          <Button onClick={handleSave} className="w-full h-11 font-bold rounded-xl btn-press text-[13px]" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="glass-card p-5 mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Your Stats</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Polls Voted', value: stats.polls, icon: MessageCircle, color: 'warning' },
            { label: 'Rankings', value: stats.rankings, icon: BarChart3, color: 'accent' },
            { label: 'Events', value: stats.events, icon: CalendarDays, color: 'success' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="w-9 h-9 rounded-xl mx-auto mb-1.5 flex items-center justify-center" style={{
                background: `linear-gradient(135deg, hsl(var(--${stat.color}) / 0.12), hsl(var(--${stat.color}) / 0.04))`,
              }}>
                <stat.icon className="w-4 h-4" style={{ color: `hsl(var(--${stat.color}))` }} />
              </div>
              <p className="text-lg font-extrabold leading-none">{stat.value}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="glass-card p-5 mb-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Recent Activity</h3>
          <div className="space-y-2.5">
            {recentActivity.map(a => {
              const config = ACTIVITY_ICONS[a.event_type] || { icon: Zap, color: 'primary' };
              const Icon = config.icon;
              const meta = typeof a.metadata === 'object' ? a.metadata : {};
              const title = meta?.title || meta?.topic || meta?.question || '';
              return (
                <div key={a.id} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                    background: `linear-gradient(135deg, hsl(var(--${config.color}) / 0.12), hsl(var(--${config.color}) / 0.04))`,
                  }}>
                    <Icon className="w-3 h-3" style={{ color: `hsl(var(--${config.color}))` }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-foreground/80 truncate">
                      {a.event_type.replace(/_/g, ' ')}
                      {title && <span className="font-semibold"> — {title}</span>}
                    </p>
                    <p className="text-[9px] text-muted-foreground/70">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="glass-card p-5 mb-4 space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Settings</h3>

        {/* Theme toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-primary" />
            ) : (
              <Sun className="w-4 h-4 text-primary" />
            )}
            <div>
              <p className="text-[13px] font-semibold">Dark Mode</p>
              <p className="text-[10px] text-muted-foreground">Switch between light and dark themes</p>
            </div>
          </div>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(checked) => {
              setTheme(checked ? 'dark' : 'light');
              play('tap');
            }}
          />
        </div>

        {/* Sound toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-primary" />
            ) : (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-[13px] font-semibold">Sound & Haptics</p>
              <p className="text-[10px] text-muted-foreground">UI sounds and vibration feedback</p>
            </div>
          </div>
          <Switch
            checked={soundEnabled}
            onCheckedChange={() => {
              toggleSound();
              play('tap');
            }}
          />
        </div>

        {/* Push notifications toggle */}
        {pushSupported && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {pushSubscribed ? (
                <Bell className="w-4 h-4 text-primary" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-[13px] font-semibold">Push Notifications</p>
                <p className="text-[10px] text-muted-foreground">Get alerts for new chat messages</p>
              </div>
            </div>
            <Switch
              checked={pushSubscribed}
              disabled={pushLoading}
              onCheckedChange={async (checked) => {
                if (checked) {
                  const ok = await pushSubscribe();
                  if (ok) {
                    toast.success('Push notifications enabled!');
                    play('success');
                  } else {
                    toast.error('Could not enable notifications. Check browser permissions.');
                    play('error');
                  }
                } else {
                  await pushUnsubscribe();
                  toast.success('Push notifications disabled');
                  play('tap');
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Notification Preferences */}
      <NotificationPreferencesSection />

      {/* DH branding */}
      <div className="flex items-center justify-center gap-2 py-4 mb-2">
        <img src={dhMonogram} alt="DH" className="w-5 h-5 object-contain opacity-30" />
        <span className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-[0.15em]">DH Member</span>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-[13px] font-medium text-muted-foreground/60 hover:text-destructive transition-colors duration-200"
      >
        <LogOut className="w-3.5 h-3.5" /> Sign Out
      </button>
    </motion.div>
  );
}
