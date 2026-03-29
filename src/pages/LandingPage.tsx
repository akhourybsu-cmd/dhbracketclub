import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Users, Shield, ArrowRight, Zap, BarChart3, MessageCircle, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import dhMonogram from '@/assets/dh-monogram.png';

export default function LandingPage() {
  const { user } = useAuth();

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[160px] pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(152, 72%, 46%, 0.07), transparent)' }} />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <img src={dhMonogram} alt="DH" className="w-7 h-7 object-contain" style={{ filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.2))' }} />
          <span className="text-[13px] font-extrabold tracking-tight text-foreground">DH</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground font-semibold text-[13px] h-9 px-3">
            Sign In
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center -mt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-lg w-full"
        >
          {/* Hero brand moment */}
          <motion.img
            src={dhMonogram}
            alt="DH"
            className="w-40 h-40 sm:w-52 sm:h-52 object-contain mx-auto mb-5"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, type: 'spring', damping: 18, stiffness: 120 }}
            style={{ filter: 'drop-shadow(0 4px 40px hsl(var(--primary) / 0.18))' }}
          />

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-bold tracking-[0.12em] uppercase mb-5" style={{ background: 'hsl(var(--primary) / 0.07)', border: '1px solid hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary) / 0.85)' }}>
            <Zap className="w-3 h-3" />
            Private Group Competitions
          </div>

          <h2 className="text-[1.85rem] sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-3.5">
            Your crew.{' '}
            <span className="gradient-text">Your competitions.</span>{' '}
            Your bragging rights.
          </h2>

          <p className="text-muted-foreground text-[14px] sm:text-base leading-relaxed mb-8 max-w-xs sm:max-w-sm mx-auto">
            Brackets, power rankings, polls, and snake drafts — all in one place. For fun, not funds.
          </p>

          <Link to="/auth">
            <Button size="lg" className="gap-2.5 px-8 h-12 text-[15px] font-bold rounded-xl btn-press">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>

        {/* Module showcase */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-16 sm:mt-20 max-w-md sm:max-w-lg w-full"
        >
          {[
            { icon: Trophy, title: 'Brackets', desc: 'March Madness & more', color: 'primary' },
            { icon: BarChart3, title: 'Rankings', desc: 'Power rankings & tiers', color: 'accent' },
            { icon: MessageCircle, title: 'Polls', desc: 'Quick group votes', color: 'warning' },
            { icon: Bookmark, title: 'Drafts', desc: 'Snake drafts & picks', color: 'gold' },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.06 }}
              className="glass-card p-4 text-center"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{
                background: `linear-gradient(135deg, hsl(var(--${f.color}) / 0.15), hsl(var(--${f.color}) / 0.04))`,
              }}>
                <f.icon className="w-4 h-4" style={{ color: `hsl(var(--${f.color}))` }} />
              </div>
              <h3 className="text-[11px] font-bold mb-0.5">{f.title}</h3>
              <p className="text-[10px] text-muted-foreground/60 leading-snug">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      <footer className="relative z-10 text-center py-6">
        <p className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-[0.15em]">
          For fun, not funds.
        </p>
      </footer>
    </div>
  );
}
