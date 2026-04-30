import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link2, Loader2, Mail, Check, X } from 'lucide-react';
import { useSoundEffect } from '@/hooks/useSoundEffect';

type Identity = {
  id: string;
  provider: string;
  identity_data?: Record<string, any> | null;
  created_at?: string;
};

const PROVIDER_META: Record<string, { label: string; icon: JSX.Element }> = {
  email: {
    label: 'Email & Password',
    icon: <Mail className="w-4 h-4" />,
  },
  google: {
    label: 'Google',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" fill="#34A853"/>
        <path d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
      </svg>
    ),
  },
  apple: {
    label: 'Apple',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
        <path d="M16.365 1.43c0 1.14-.42 2.21-1.18 3.02-.92.99-2.03 1.55-3.07 1.46-.13-1.07.42-2.2 1.16-3 .82-.88 2.2-1.55 3.09-1.48zm3.86 16.9c-.55 1.27-.82 1.84-1.53 2.97-1 1.56-2.4 3.51-4.14 3.52-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.09 1-1.74-.02-3.07-1.78-4.07-3.34C-.6 15.04-.95 8.91 1.69 5.66 3.5 3.39 6.41 2.13 9.13 2.13c2.69 0 4.39 1.35 6.62 1.35 2.16 0 3.48-1.36 6.59-1.36 2.36 0 4.86 1.29 6.65 3.51-5.84 3.21-4.89 11.55-.16 14.7z"/>
      </svg>
    ),
  },
};

export default function LinkedAccounts() {
  const [identities, setIdentities] = useState<Identity[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { play } = useSoundEffect();

  const refresh = async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      toast.error('Could not load linked accounts');
      setIdentities([]);
      return;
    }
    setIdentities((data?.identities as Identity[]) || []);
  };

  useEffect(() => {
    refresh();
  }, []);

  const linked = (provider: string) =>
    !!identities?.some((i) => i.provider === provider);

  const handleLink = async (provider: 'google' | 'apple') => {
    setBusy(provider);
    play('tap');
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo: window.location.origin + '/profile' },
      });
      if (error) {
        toast.error(error.message || `Could not link ${provider}`);
        play('error');
      }
      // On success the browser redirects to the provider — no further action.
    } catch (e: any) {
      toast.error(e?.message || 'Unexpected error');
      play('error');
    } finally {
      setBusy(null);
    }
  };

  const handleUnlink = async (identity: Identity) => {
    if (!identities) return;
    if (identities.length <= 1) {
      toast.error('You must keep at least one sign-in method.');
      return;
    }
    if (
      !confirm(
        `Unlink ${PROVIDER_META[identity.provider]?.label || identity.provider}? You won't be able to sign in with it anymore.`,
      )
    )
      return;

    setBusy(identity.provider);
    play('tap');
    const { error } = await supabase.auth.unlinkIdentity(identity as any);
    if (error) {
      toast.error(error.message || 'Could not unlink');
      play('error');
    } else {
      toast.success('Account unlinked');
      play('success');
      await refresh();
    }
    setBusy(null);
  };

  const providers: Array<'email' | 'google' | 'apple'> = ['email', 'google', 'apple'];

  return (
    <div className="glass-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-3.5 h-3.5 text-primary" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Linked Accounts
        </h3>
      </div>
      <p className="text-[11px] text-muted-foreground/80 mb-4">
        Link Google or Apple to sign in faster. Email/password remains available.
      </p>

      {identities === null ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => {
            const meta = PROVIDER_META[p];
            const isLinked = linked(p);
            const identity = identities.find((i) => i.provider === p);
            const isBusy = busy === p;
            const canUnlink = isLinked && identities.length > 1 && p !== 'email';

            return (
              <div
                key={p}
                className="flex items-center justify-between rounded-xl px-3 py-2.5"
                style={{
                  background: 'hsl(var(--muted) / 0.25)',
                  border: '1px solid hsl(var(--border) / 0.4)',
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(var(--background) / 0.5)' }}
                  >
                    {meta.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold leading-tight truncate">
                      {meta.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 truncate">
                      {isLinked
                        ? identity?.identity_data?.email || 'Linked'
                        : 'Not linked'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isLinked ? (
                    <>
                      <span
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: 'hsl(var(--success))' }}
                      >
                        <Check className="w-3 h-3" /> Linked
                      </span>
                      {canUnlink && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => handleUnlink(identity!)}
                          className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-destructive"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <X className="w-3 h-3 mr-0.5" /> Unlink
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  ) : p === 'email' ? (
                    <span className="text-[10px] text-muted-foreground/60 font-semibold">
                      —
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => handleLink(p as 'google' | 'apple')}
                      className="h-8 px-3 text-[11px] font-bold rounded-lg btn-press"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Link'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
