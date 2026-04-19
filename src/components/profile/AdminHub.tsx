import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Activity, RefreshCw, Trophy, Bookmark, Bell, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { nukeAndReload } from '@/lib/forceUpdate';
import { toast } from 'sonner';

type Tool = {
  icon: typeof Shield;
  label: string;
  description: string;
  to?: string;
  onClick?: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  iconColor?: string;
};

function ToolRow({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  const inner = (
    <div className="flex items-center gap-3 w-full min-h-[44px] py-2.5 px-3 rounded-xl hover:bg-muted/40 active:bg-muted/60 transition-colors btn-press">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, hsl(var(--${tool.iconColor || 'gold'}) / 0.14), hsl(var(--${tool.iconColor || 'gold'}) / 0.04))`,
          border: `1px solid hsl(var(--${tool.iconColor || 'gold'}) / 0.18)`,
        }}
      >
        {tool.loading ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: `hsl(var(--${tool.iconColor || 'gold'}))` }} />
        ) : (
          <Icon className="w-4 h-4" style={{ color: `hsl(var(--${tool.iconColor || 'gold'}))` }} />
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[13px] font-semibold leading-tight">{tool.label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{tool.description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
    </div>
  );

  if (tool.to) {
    return <Link to={tool.to} className="block">{inner}</Link>;
  }
  return (
    <button
      type="button"
      onClick={tool.onClick}
      disabled={tool.disabled || tool.loading}
      className="block w-full disabled:opacity-60"
    >
      {inner}
    </button>
  );
}

export default function AdminHub() {
  const { user } = useAuth();
  const { isSubscribed, subscribe } = usePushNotifications();
  const { play } = useSoundEffect();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }: any) => setIsAdmin(!!data));
  }, [user]);

  if (!isAdmin) return null;

  const handleForceRefresh = async () => {
    setRefreshing(true);
    play('tap');
    toast.loading('Clearing cache and reloading…');
    await nukeAndReload();
  };

  const handleTestPush = async () => {
    if (!user) return;
    setTesting(true);
    try {
      if (!isSubscribed) {
        const ok = await subscribe();
        if (!ok) {
          toast.error('Allow notification permissions first');
          setTesting(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: { test: true, user_id: user.id },
      });
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success('Test notification sent!');
        play('success');
      } else {
        toast.error(data?.error || 'No test notification was delivered.');
        play('error');
      }
    } catch (err) {
      console.error('Test push error:', err);
      toast.error('Failed to send test notification');
      play('error');
    }
    setTesting(false);
  };

  const appManagement: Tool[] = [
    { icon: Activity, label: 'Sync Runs & Logs', description: 'Bracket sync, game updates, audit trail', to: '/admin', iconColor: 'gold' },
    { icon: RefreshCw, label: 'Force Refresh App', description: 'Clear cache & pull latest build', onClick: handleForceRefresh, loading: refreshing, iconColor: 'primary' },
  ];

  const competitions: Tool[] = [
    { icon: Trophy, label: "NFL Pick'em Admin", description: 'Seasons, weeks, games, scoring', to: '/pickem/admin', iconColor: 'gold' },
    { icon: Bookmark, label: 'Drafts Hub', description: 'Manage drafts & league seasons', to: '/drafts', iconColor: 'accent' },
  ];

  const diagnostics: Tool[] = [
    { icon: Bell, label: 'Send Test Notification', description: 'Verify push delivery to this device', onClick: handleTestPush, loading: testing, iconColor: 'warning' },
  ];

  return (
    <div
      className="relative glass-card arena-edge p-5 mb-4 overflow-hidden"
      style={{
        borderColor: 'hsl(var(--gold) / 0.28)',
        boxShadow: '0 0 32px hsl(var(--gold) / 0.08)',
      }}
    >
      {/* Gold radial glow */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(var(--gold) / 0.18), transparent 70%)' }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 mb-5">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.06))',
            border: '1px solid hsl(var(--gold) / 0.3)',
            boxShadow: '0 0 20px hsl(var(--gold) / 0.15)',
          }}
        >
          <Shield className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(var(--gold))' }}>
            Admin Tools
          </p>
          <p className="text-[15px] font-extrabold leading-tight">Commissioner Hub</p>
        </div>
      </div>

      {/* App Management */}
      <div className="relative z-10 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 mb-1.5 px-1">
          App Management
        </p>
        <div className="space-y-0.5">
          {appManagement.map((t) => <ToolRow key={t.label} tool={t} />)}
        </div>
      </div>

      {/* Competitions */}
      <div className="relative z-10 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 mb-1.5 px-1">
          Competitions
        </p>
        <div className="space-y-0.5">
          {competitions.map((t) => <ToolRow key={t.label} tool={t} />)}
        </div>
      </div>

      {/* Diagnostics */}
      <div className="relative z-10 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 mb-1.5 px-1">
          Diagnostics
        </p>
        <div className="space-y-0.5">
          {diagnostics.map((t) => <ToolRow key={t.label} tool={t} />)}
        </div>
      </div>

      {/* Build info */}
      <div className="relative z-10 pt-3 border-t border-border/40 flex items-center justify-between text-[9px] font-mono text-muted-foreground/60">
        <span>build {String(buildId).slice(0, 12)}</span>
        <span className="truncate max-w-[160px]">uid {user?.id.slice(0, 8)}…</span>
      </div>
    </div>
  );
}
