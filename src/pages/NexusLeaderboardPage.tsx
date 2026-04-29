import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MISSIONS } from '@/lib/nexus/missions';
import { Trophy, Clock, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDisplayedSigils } from '@/hooks/useNexusRewards';
import { NexusAvatarWithSigil } from '@/components/nexus/NexusAvatarWithSigil';

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
    let cancelled = false;
    (async () => {
      const { data: runs } = await (supabase as any)
        .from('nexus_runs')
        .select('user_id, score, base_hp_remaining, duration_seconds')
        .eq('mission_id', missionId)
        .eq('victory', true)
        .order('score', { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (!runs || runs.length === 0) { setRows([]); setLoading(false); return; }
      const best = new Map<string, any>();
      runs.forEach((r: any) => {
        const prev = best.get(r.user_id);
        if (!prev || r.score > prev.score) best.set(r.user_id, r);
      });
      const userIds = Array.from(best.keys());
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
      if (cancelled) return;
      const profMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profMap.set(p.id, p));
      const merged = Array.from(best.values())
        .sort((a: any, b: any) => b.score - a.score)
        .map((r: any) => ({
          ...r,
          display_name: profMap.get(r.user_id)?.display_name ?? null,
          avatar_url: profMap.get(r.user_id)?.avatar_url ?? null,
        }));
      setRows(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [missionId]);

  return (
    <div className="max-w-md mx-auto pb-6 px-3 pt-2">
      {/* Header */}
      <div className="mb-3 relative nx-panel nx-clip p-3">
        <span className="nx-bracket nx-bracket-tl" />
        <span className="nx-bracket nx-bracket-br" />
        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/70 font-bold">
          ▌ Tactical Records
        </div>
        <h1 className="text-2xl font-black mt-0.5 tracking-tight">Leaderboards</h1>
        <p className="text-[11px] text-cyan-100/60 mt-0.5">Best score per pilot, per mission</p>
      </div>

      {/* Mission tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-none">
        {MISSIONS.map(m => (
          <button
            key={m.id}
            onClick={() => setMissionId(m.id)}
            className={cn(
              'shrink-0 px-3 py-1.5 nx-clip text-[11px] font-bold border whitespace-nowrap uppercase tracking-wider transition-colors active:scale-95',
              missionId === m.id
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 shadow-[0_0_12px_-4px_hsl(188_92%_56%/0.6)]'
                : 'bg-white/[0.03] border-white/10 text-muted-foreground',
            )}
          >
            M{m.id} · {m.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-cyan-300/50 uppercase tracking-widest animate-pulse">
          ◌ Decrypting telemetry…
        </div>
      ) : rows.length === 0 ? (
        <div className="relative nx-panel nx-clip p-6 text-center">
          <Trophy className="w-10 h-10 mx-auto text-cyan-400/40 mb-2" />
          <div className="text-sm font-bold text-cyan-100">No clears yet</div>
          <div className="text-[11px] text-muted-foreground mt-1">Be the first pilot to hold the nexus.</div>
        </div>
      ) : (
        <LeaderboardRows rows={rows} />
      )}
    </div>
  );
}

function LeaderboardRows({ rows }: { rows: Row[] }) {
  const userIds = useMemo(() => rows.map(r => r.user_id), [rows]);
  const { data: displayedMap = {} } = useDisplayedSigils(userIds);
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => {
        const rankColor =
          i === 0 ? 'text-amber-300' :
          i === 1 ? 'text-cyan-200' :
          i === 2 ? 'text-orange-300' : 'text-muted-foreground';
        const rowGlow =
          i === 0 ? 'border-amber-400/60 bg-amber-500/[0.08] shadow-[0_0_18px_-8px_hsl(45_100%_60%/0.7)]' :
          i === 1 ? 'border-cyan-400/40 bg-cyan-500/[0.05]' :
          i === 2 ? 'border-orange-400/40 bg-orange-500/[0.05]' :
          'border-white/8 bg-white/[0.02]';
        return (
          <div key={r.user_id} className={cn('relative flex items-center gap-3 p-2.5 nx-clip border', rowGlow)}>
            {i < 3 && <span className="nx-bracket nx-bracket-tl" />}
            <div className={cn('w-7 text-center font-black text-sm tabular-nums', rankColor)}>
              {i < 3 ? <Trophy className="w-4 h-4 mx-auto" /> : `#${i + 1}`}
            </div>
            <NexusAvatarWithSigil
              userId={r.user_id}
              src={r.avatar_url}
              fallback={r.display_name?.[0]?.toUpperCase() ?? '?'}
              size={36}
              displayed={displayedMap}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate text-white">{r.display_name || 'Pilot'}</div>
              <div className="text-[10px] text-cyan-100/60 flex items-center gap-2 mt-0.5 tabular-nums">
                <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" /> {r.base_hp_remaining}</span>
                <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {Math.floor(r.duration_seconds / 60)}:{String(r.duration_seconds % 60).padStart(2, '0')}</span>
              </div>
            </div>
            <div className="text-right">
              <div className={cn('text-base font-black tabular-nums', i === 0 ? 'text-amber-300' : 'text-cyan-200')}>
                {r.score.toLocaleString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
