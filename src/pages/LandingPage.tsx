import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Users, Shield, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function LandingPage() {
  const { user } = useAuth();

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <h1 className="text-lg font-extrabold tracking-tight">
          <span className="gradient-text">Bracket</span> Battle
        </h1>
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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-8">
            <Zap className="w-3.5 h-3.5" />
            March Madness Bracket Pools
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-5">
            Your friends.{' '}
            <span className="gradient-text">Your picks.</span>{' '}
            Your bragging rights.
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-10 max-w-md mx-auto">
            Create a private pool, fill out your bracket, and see who knows college basketball best.
          </p>
          <Link to="/auth">
            <Button size="lg" className="gap-2.5 px-8 h-12 text-base font-bold rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-20 max-w-2xl w-full"
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
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-bold mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      <footer className="relative z-10 text-center py-8 text-xs text-muted-foreground/50 font-medium">
        Bracket Battle — For fun, not funds.
      </footer>
    </div>
  );
}
