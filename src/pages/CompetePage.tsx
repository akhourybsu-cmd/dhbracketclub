import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, BarChart3, MessageCircle, Bookmark, ChevronRight, Plus } from 'lucide-react';

const modules = [
  { path: '/brackets', label: 'Brackets', description: 'March Madness pools & bracket challenges', icon: Trophy, color: 'primary', create: '/pools/create' },
  { path: '/rankings', label: 'Rankings', description: 'Rank anything — movies, food, takes', icon: BarChart3, color: 'accent', create: '/rankings/create' },
  { path: '/polls', label: 'Polls', description: 'Quick votes and group decisions', icon: MessageCircle, color: 'warning', create: '/polls/create' },
  { path: '/drafts', label: 'Drafts', description: 'Snake drafts on any topic', icon: Bookmark, color: 'gold', create: '/drafts/create' },
];

export default function CompetePage() {
  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-extrabold tracking-tight mb-6">Compete</h1>

        <div className="space-y-3">
          {modules.map((mod, i) => (
            <motion.div key={mod.path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}>
              <div className="glass-card p-4 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                      background: `linear-gradient(135deg, hsl(var(--${mod.color}) / 0.2), hsl(var(--${mod.color}) / 0.05))`,
                    }}>
                      <mod.icon className="w-5 h-5" style={{ color: `hsl(var(--${mod.color}))` }} />
                    </div>
                    <div className="flex-1">
                      <h2 className="font-bold text-[15px] tracking-tight">{mod.label}</h2>
                      <p className="text-[11px] text-muted-foreground/50">{mod.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={mod.path} className="flex-1">
                      <button className="w-full h-8 rounded-lg bg-muted/30 text-[11px] font-bold text-foreground/70 hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
                        View All <ChevronRight className="w-3 h-3" />
                      </button>
                    </Link>
                    <Link to={mod.create}>
                      <button className="h-8 px-3 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5" style={{
                        background: `hsl(var(--${mod.color}) / 0.15)`,
                        color: `hsl(var(--${mod.color}))`,
                      }}>
                        <Plus className="w-3 h-3" /> Create
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
