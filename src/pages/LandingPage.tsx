import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Users, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function LandingPage() {
  const { user } = useAuth();

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-bold">
          <span className="gradient-text">Bracket</span> Battle
        </h1>
        <Link to="/auth">
          <Button variant="ghost" size="sm">Sign In</Button>
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-lg"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
            <Trophy className="w-3.5 h-3.5" />
            March Madness Bracket Pools
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-4">
            Your friends.{' '}
            <span className="gradient-text">Your picks.</span>{' '}
            Your bragging rights.
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Create a private pool, fill out your bracket, and see who knows college basketball best.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 max-w-2xl w-full"
        >
          {[
            { icon: Users, title: 'Private Pools', desc: 'Invite friends with a simple code' },
            { icon: Trophy, title: 'Live Standings', desc: 'Track your rank as results come in' },
            { icon: Shield, title: 'Locked Picks', desc: 'Fair play with automatic lock times' },
          ].map((f, i) => (
            <div key={i} className="glass-card p-4 text-center">
              <f.icon className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>

      <footer className="text-center py-6 text-xs text-muted-foreground">
        Bracket Battle — For fun, not funds.
      </footer>
    </div>
  );
}
