import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Bookmark, Plus, ArrowRight, Users, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function DraftsListPage() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('drafts')
        .select('*, competitions(title, status), profiles:created_by(display_name)')
        .order('created_at', { ascending: false });

      if (data) {
        setDrafts(data);
        const draftIds = data.map(d => d.id);

        if (draftIds.length > 0) {
          const { data: parts } = await supabase
            .from('draft_participants')
            .select('draft_id')
            .in('draft_id', draftIds);

          if (parts) {
            const counts = new Map<string, number>();
            parts.forEach(p => counts.set(p.draft_id, (counts.get(p.draft_id) || 0) + 1));
            setParticipantCounts(counts);
          }
        }
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const statusConfig: Record<string, { label: string; cls: string }> = {
    setup: { label: 'Setup', cls: 'bg-muted text-muted-foreground' },
    in_progress: { label: 'Live', cls: 'bg-success/10 text-success' },
    complete: { label: 'Done', cls: 'bg-primary/10 text-primary' },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="page-header mb-0">
          <div className="page-header-icon" style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.05))',
            boxShadow: '0 0 12px hsl(var(--gold) / 0.15)',
          }}>
            <Bookmark className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
          </div>
          <div>
            <h1 className="page-header-title">Drafts</h1>
            <p className="page-header-subtitle">Snake drafts & picks</p>
          </div>
        </div>
        <Link to="/drafts/create">
          <Button size="sm" className="gap-1.5 rounded-lg font-bold btn-press">
            <Plus className="w-4 h-4" /> Create
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map(i => (
            <div key={i} className="glass-card p-5">
              <div className="h-4 rounded-lg w-1/3 mb-2.5 skeleton-shimmer" />
              <div className="h-3 rounded-lg w-1/2 skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="empty-state">
          <div className="empty-state-icon" style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.12), hsl(var(--gold) / 0.04))',
          }}>
            <Bookmark className="w-7 h-7" style={{ color: 'hsl(var(--gold) / 0.6)' }} />
          </div>
          <p className="empty-state-title">No drafts yet</p>
          <p className="empty-state-desc mb-6">Run a snake draft on any topic with your crew.</p>
          <Link to="/drafts/create">
            <Button className="font-bold rounded-xl gap-2 btn-press">
              <Plus className="w-4 h-4" /> Create Draft
            </Button>
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {drafts.map((d, i) => {
            const count = participantCounts.get(d.id) || 0;
            const sc = statusConfig[d.status] || statusConfig.setup;
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 + i * 0.04 }}>
                <Link to={`/drafts/${d.id}`} className="block group">
                  <div className="glass-card p-4 hover-lift cursor-pointer">
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                          background: 'linear-gradient(135deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.04))',
                        }}>
                          <Bookmark className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm truncate">{d.topic}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground/50 font-medium">
                              {d.num_rounds} rounds
                            </span>
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/15" />
                            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-0.5 font-medium">
                              <Users className="w-2.5 h-2.5" /> {count}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={cn("status-pill", sc.cls)}>
                          {d.status === 'in_progress' && <Play className="w-2.5 h-2.5 mr-0.5" />}
                          {sc.label}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-all" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
