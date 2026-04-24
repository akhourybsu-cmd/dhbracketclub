import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Sparkles, LogIn } from 'lucide-react';
import dhMonogram from '@/assets/dh-monogram.png';
import { getAndClearIntendedDestination } from '@/lib/share';

type Mode = 'signin' | 'join' | 'request';

export default function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [clubPassword, setClubPassword] = useState('');
  const [proposedClubName, setProposedClubName] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    const redirect = getAndClearIntendedDestination();
    return <Navigate to={redirect || '/dashboard'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const redirect = getAndClearIntendedDestination();
        navigate(redirect || '/dashboard');
        return;
      }

      if (mode === 'join') {
        if (!clubPassword.trim()) {
          toast.error('Club password required');
          setLoading(false);
          return;
        }
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split('@')[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        const newUserId = signUpData.user?.id;
        if (!newUserId) {
          toast.success('Check your email to verify, then sign in to finish joining.');
          sessionStorage.setItem('pending_club_password', clubPassword.trim());
          return;
        }
        // Try to enroll now (works when auto-confirm is on / session exists)
        const { error: joinErr } = await (supabase as any).rpc('join_club_with_password', {
          _password: clubPassword.trim(),
          _user_id: newUserId,
        });
        if (joinErr) {
          // If session isn't ready, stash for first sign-in
          sessionStorage.setItem('pending_club_password', clubPassword.trim());
          toast.success('Account created. Verify your email and sign in to join your club.');
        } else {
          toast.success("You're in. Check your email to verify.");
        }
        return;
      }

      // mode === 'request' — sign up + create a club_request, no invite code needed
      if (!proposedClubName.trim()) {
        toast.error('Please name your club');
        setLoading(false);
        return;
      }
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split('@')[0] },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      // If a session was returned (auto-confirm on), submit the club_request now.
      // Otherwise, stash it so RequestClubPage can submit it after the user verifies email + signs in.
      if (signUpData.session?.user?.id) {
        const { error: reqErr } = await (supabase as any).from('club_requests').insert({
          requested_by: signUpData.session.user.id,
          proposed_name: proposedClubName.trim(),
          reason: reason.trim() || null,
        });
        if (reqErr) {
          toast.error(`Account created, but request failed: ${reqErr.message}`);
        } else {
          toast.success('Account created! Your club request is awaiting review.');
        }
      } else {
        sessionStorage.setItem(
          'pending_club_request',
          JSON.stringify({ proposed_name: proposedClubName.trim(), reason: reason.trim() || null }),
        );
        toast.success('Check your email to verify, then sign in — your club request will be submitted automatically.');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}
    >
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(152, 72%, 46%, 0.06), transparent)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-6">
          <motion.img
            src={dhMonogram}
            alt="DH"
            className="w-20 h-20 object-contain mx-auto mb-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, type: 'spring', damping: 18 }}
            style={{ filter: 'drop-shadow(0 0 16px hsl(var(--primary) / 0.2))' }}
          />
          <p className="text-xs text-muted-foreground font-semibold">
            {mode === 'signin' && 'Welcome back'}
            {mode === 'join' && 'Join an existing club'}
            {mode === 'request' && 'Start your own club'}
          </p>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-1.5 mb-4 p-1 rounded-xl bg-muted/30 border border-border/30">
          {([
            { key: 'signin' as Mode, icon: LogIn, label: 'Sign In' },
            { key: 'join' as Mode, icon: KeyRound, label: 'Join Club' },
            { key: 'request' as Mode, icon: Sparkles, label: 'Request' },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className="relative flex flex-col items-center gap-1 py-2 rounded-lg btn-press transition-colors"
              style={{
                background: mode === key ? 'hsl(var(--primary) / 0.14)' : 'transparent',
                color: mode === key ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          <AnimatePresence mode="wait" initial={false}>
            {mode === 'join' && (
              <motion.div
                key="join-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-4 overflow-hidden"
              >
                <div>
                  <label className="form-label">Club Password</label>
                  <Input
                    required
                    value={clubPassword}
                    onChange={(e) => setClubPassword(e.target.value)}
                    placeholder="The password your club admin gave you"
                    className="form-input"
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-muted-foreground/80 mt-1.5 px-0.5">
                    Ask your club admin for the club password.
                  </p>
                </div>
              </motion.div>
            )}

            {mode === 'request' && (
              <motion.div
                key="request-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-4 overflow-hidden"
              >
                <div>
                  <label className="form-label">Proposed Club Name</label>
                  <Input
                    required
                    value={proposedClubName}
                    onChange={(e) => setProposedClubName(e.target.value)}
                    placeholder="e.g. Smith Family"
                    maxLength={48}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Why this club? (optional)</label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Tell Alex who's joining and what you'll use it for."
                    maxLength={500}
                    rows={3}
                    className="form-input resize-none"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/80 px-0.5 leading-relaxed">
                  Your account is created right away. Alex reviews each club request manually.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {mode !== 'signin' && (
            <div>
              <label className="form-label">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="form-input"
              />
            </div>
          )}

          <div>
            <label className="form-label">Email</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="form-input"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          <Button type="submit" className="w-full h-11 font-bold rounded-xl btn-press" disabled={loading}>
            {loading
              ? 'Loading…'
              : mode === 'signin'
                ? 'Sign In'
                : mode === 'invite'
                  ? 'Join Club'
                  : 'Submit Request'}
          </Button>
        </form>

        {mode === 'signin' && (
          <p className="text-center text-[11px] text-muted-foreground/70 mt-3">
            <button
              onClick={async () => {
                if (!email) {
                  toast.error('Enter your email first');
                  return;
                }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error(error.message);
                else toast.success('Password reset link sent! Check your email.');
              }}
              className="text-primary/85 hover:text-primary hover:underline font-semibold transition-colors"
            >
              Forgot password?
            </button>
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground mt-5">
          {mode === 'signin' ? (
            <>
              New here?{' '}
              <button onClick={() => setMode('invite')} className="text-primary hover:underline font-bold">
                Use an invite code
              </button>{' '}
              or{' '}
              <button onClick={() => setMode('request')} className="text-primary hover:underline font-bold">
                start a club
              </button>
              .
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('signin')} className="text-primary hover:underline font-bold">
                Sign In
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
