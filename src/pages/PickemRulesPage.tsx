import { Link } from 'react-router-dom';
import { ChevronLeft, Info, Lock, Trophy, Star, Zap } from 'lucide-react';

export default function PickemRulesPage() {
  return (
    <div className="space-y-4 pb-6">
      <Link to="/pickem" className="text-[12px] text-muted-foreground flex items-center gap-1 btn-press">
        <ChevronLeft className="w-4 h-4" /> Pick'em
      </Link>

      <div className="page-header">
        <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))' }}>
          <Info className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="page-header-title">How It Works</h1>
          <p className="page-header-subtitle">NFL Pick'em — quick rules</p>
        </div>
      </div>

      <Section icon={<Trophy className="w-4 h-4 text-gold" />} title="Goal">
        Pick the winner of every NFL game each week. The player with the most correct picks at the end of the season wins.
      </Section>

      <Section icon={<Zap className="w-4 h-4 text-success" />} title="Scoring">
        Each correct pick = <strong>1 point</strong>. No spreads, no confidence, no wagers — just winners.
      </Section>

      <Section icon={<Lock className="w-4 h-4 text-muted-foreground" />} title="Locking">
        Each game locks at its <strong>own kickoff time</strong>. You can change your pick anytime before then. After kickoff, your pick is final.
      </Section>

      <Section icon={<Star className="w-4 h-4 text-gold" />} title="Tiebreaker">
        Each week has a featured game. Predict the <strong>total combined points</strong> of that game. Your prediction is used to break weekly ties (closest wins).
      </Section>

      <Section icon={<Trophy className="w-4 h-4 text-gold" />} title="Standings">
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Weekly:</strong> Most correct → closest tiebreaker</li>
          <li><strong>Season:</strong> Most total correct → best average weekly rank → most weekly wins</li>
        </ul>
      </Section>

      <p className="text-[10px] text-muted-foreground/60 text-center px-4 leading-relaxed">
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
        <h2 className="font-extrabold text-[14px]">{title}</h2>
      </div>
      <div className="text-[12px] text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}
