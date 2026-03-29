import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import dhMonogram from '@/assets/dh-monogram.png';

export default function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const validateInviteCode = async (code: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('invite_codes')
      .select('id, is_active, used_by')
      .eq('code', code.trim().toUpperCase())
      .maybeSingle();

    if (error || !data) return false;
    if (!data.is_active) return false;
    // Allow reusable codes (used_by is null means unclaimed, but we allow reuse)
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Validate invite code first
        if (!inviteCode.trim()) {
          toast.error('Invite code required');
          setLoading(false);
          return;
        }

        const validCode = await validateInviteCode(inviteCode);
        if (!validCode) {
          toast.error('Invalid or expired invite code');
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split('@')[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success('You\'re in. Check your email to verify.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(152, 72%, 46%, 0.06), transparent)' }} />
      
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-8">
          <motion.img
            src={dhMonogram}
            alt="DH"
            className="w-20 h-20 object-contain mx-auto mb-5"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, type: 'spring', damping: 18 }}
            style={{ filter: 'drop-shadow(0 0 16px hsl(var(--primary) / 0.2))' }}
          />
          <p className="text-xs text-muted-foreground mt-2 font-semibold">
            {isSignUp ? 'Request access' : 'Welcome back'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="form-label">Invite Code</label>
                <Input
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter your code"
                  className="form-input font-mono tracking-widest text-center"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="form-label">Display Name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="form-input"
                />
              </div>
            </>
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
            />
          </div>
          <Button type="submit" className="w-full h-11 font-bold rounded-xl btn-press" disabled={loading}>
            {loading ? 'Loading...' : isSignUp ? 'Request Access' : 'Sign In'}
          </Button>
        </form>

        {!isSignUp && (
          <p className="text-center text-[11px] text-muted-foreground/70 mt-3">
            <button
              onClick={async () => {
                if (!email) { toast.error('Enter your email first'); return; }
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

        <p className="text-center text-xs text-muted-foreground mt-4">
          {isSignUp ? 'Already have an account?' : 'Got an invite code?'}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary hover:underline font-bold"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
