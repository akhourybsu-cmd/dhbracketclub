import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Info, Lock, Trophy, Star, Zap } from 'lucide-react';

export default function PickemRulesPage() {
  return (
    <div className="space-y-4 pb-6">
      <Link to="/pickem" className="text-[12px] text-muted-foreground flex items-center gap-1 btn-press">
        <ChevronLeft className="w-4 h-4" /> Pick'em
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden p-5"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary) / 0.10), transparent 60%), hsl(var(--card))',
          border: '1px solid hsl(var(--border) / 0.4)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.22), hsl(var(--primary) / 0.05))', boxShadow: 'var(--shadow-glow-sm)' }}>
            <Info className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-primary/90">Quick Read</p>
            <h1 className="text-[22px] font-extrabold tracking-tight leading-tight">How It Works</h1>
          </div>
        </div>
      </motion.div>

      {[
        { icon: <Trophy className="w-4 h-4 text-gold" />, title: 'Goal',
          body: <>Pick the winner of every NFL game each week. The player with the most correct picks at the end of the season wins.</> },
        { icon: <Zap className="w-4 h-4 text-success" />, title: 'Scoring',
          body: <>Each correct pick = <strong>1 point</strong>. No spreads, no confidence, no wagers — just winners.</> },
        { icon: <Lock className="w-4 h-4 text-muted-foreground" />, title: 'Locking',
          body: <>Each game locks at its <strong>own kickoff time</strong>. You can change your pick anytime before then. After kickoff, your pick is final.</> },
        { icon: <Star className="w-4 h-4 text-gold" />, title: 'Tiebreaker',
          body: <>Each week has a featured game. Predict the <strong>total combined points</strong> of that game. Your prediction is used to break weekly ties (closest wins).</> },
        { icon: <Trophy className="w-4 h-4 text-gold" />, title: 'Standings',
          body: <ul className="list-disc list-inside space-y-1">
            <li><strong>Weekly:</strong> Most correct → closest tiebreaker</li>
            <li><strong>Season:</strong> Most total correct → best average weekly rank → most weekly wins</li>
          </ul> },
      ].map((s, i) => (
        <motion.div key={s.title}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}>
          <Section icon={s.icon} title={s.title}>{s.body}</Section>
        </motion.div>
      ))}

      <p className="text-[10px] text-muted-foreground/60 text-center px-4 leading-relaxed pt-2">
        For fun, not funds. No money, no gambling — just bragging rights with your crew.
      </p>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h2 className="font-extrabold text-[14px] tracking-tight">{title}</h2>
      </div>
      <div className="text-[12px] text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}
