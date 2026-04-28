import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MISSIONS } from '@/lib/nexus/missions';
import { Trophy, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Row {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  score: number;
  base_hp_remaining: number;
  duration_seconds: number;
}

export default function NexusLeaderboardPage() {
  const [missionId, setMissionId] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data: runs } = await (supabase as any)
        .from('nexus_runs')
        .select('user_id, score, base_hp_remaining, duration_seconds')
        .eq('mission_id', missionId)
        .eq('victory', true)
        .order('score', { ascending: false })
        .limit(50);
      if (!runs) { setRows([]); setLoading(false); return; }
      // best per user
      const best = new Map<string, any>();
      runs.forEach((r: any) => { if (!best.has(r.user_id)) best.set(r.user_id, r); });
      const userIds = Array.from(best.keys());
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
      const profMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profMap.set(p.id, p));
      const merged = Array.from(best.values()).map((r: any) => ({
        ...r,
        display_name: profMap.get(r.user_id)?.display_name ?? null,
        avatar_url: profMap.get(r.user_id)?.avatar_url ?? null,
      }));
      setRows(merged);
      setLoading(false);
    })();
  }, [missionId]);

  return (
    <div className="max-w-md mx-auto pb-24 px-1">
      <div className="mb-3 mt-2">
        <Link to="/nexus" className="text-xs text-muted-foreground">← Hub</Link>
        <h1 className="text-2xl font-black mt-1">Leaderboards</h1>
        <p className="text-sm text-muted-foreground">Best score per pilot, per mission</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
        {MISSIONS.map(m => (
          <button
            key={m.id}
            onClick={() => setMissionId(m.id)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap',
              missionId === m.id
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200'
                : 'bg-card border-border text-muted-foreground',
            )}
          >
            M{m.id} · {m.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No clears yet. Be the first.</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.user_id} className={cn(
              'flex items-center gap-3 p-2.5 rounded-lg border bg-card',
              i === 0 && 'border-amber-400 bg-amber-500/10',
              i === 1 && 'border-zinc-300/40',
              i === 2 && 'border-orange-500/40',
            )}>
              <div className={cn(
                'w-7 text-center font-black text-sm',
                i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-orange-400' : 'text-muted-foreground',
              )}>
                {i < 3 ? <Medal className="w-4 h-4 mx-auto" /> : i + 1}
              </div>
              {r.avatar_url ? (
                <img src={r.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                  {r.display_name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{r.display_name || 'Pilot'}</div>
                <div className="text-[10px] text-muted-foreground">
                  HP {r.base_hp_remaining} · {Math.floor(r.duration_seconds / 60)}:{String(r.duration_seconds % 60).padStart(2, '0')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-emerald-400 tabular-nums">{r.score.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
