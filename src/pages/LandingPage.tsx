import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Users, Shield, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import dhLogoFull from '@/assets/dh-logo-full.png';
import dhMonogram from '@/assets/dh-monogram.png';

export default function LandingPage() {
  const { user } = useAuth();

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full blur-[140px] pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(217, 91%, 60%, 0.08), transparent)' }} />
      
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <img src={dhMonogram} alt="DH" className="w-11 h-11 object-contain" style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.2))' }} />
          <span className="text-sm font-extrabold tracking-tight">
            <span className="gradient-text">DH</span> Bracket Club
          </span>
        </div>
        <Link to="/auth">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground font-semibold">
            Sign In
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-lg"
        >
          {/* Logo hero */}
          <motion.img
            src={dhLogoFull}
            alt="DH Bracket Club"
            className="h-40 sm:h-52 object-contain mx-auto mb-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{ filter: 'drop-shadow(0 0 24px hsl(var(--primary) / 0.15))' }}
          />

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-8" style={{ background: 'hsl(var(--primary) / 0.1)', border: '1px solid hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
            <Zap className="w-3.5 h-3.5" />
            March Madness Bracket Pools
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-5">
            Your friends.{' '}
            <span className="gradient-text">Your picks.</span>{' '}
            Your bragging rights.
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-10 max-w-md mx-auto">
            Create a private pool, fill out your bracket, and see who knows college basketball best.
          </p>
          <Link to="/auth">
            <Button size="lg" className="gap-2.5 px-8 h-12 text-base font-bold rounded-xl btn-press">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-20 max-w-xl w-full"
        >
          {[
            { icon: Users, title: 'Private Pools', desc: 'Invite friends with a simple code' },
            { icon: Trophy, title: 'Live Standings', desc: 'Track your rank as results come in' },
            { icon: Shield, title: 'Locked Picks', desc: 'Fair play with automatic lock times' },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.08 }}
              className="glass-card p-5 text-center hover-lift"
            >
              <div className="icon-container w-10 h-10 mx-auto mb-3">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-bold mb-1">{f.title}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      <footer className="relative z-10 text-center py-8 text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">
        DH Bracket Club — For fun, not funds.
      </footer>
    </div>
  );
}
