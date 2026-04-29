import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Users, Zap, ChevronRight, Crown, Flame, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveOperation, useIsAppAdmin, startNewOperation, endOperation } from '@/hooks/useNexusOperation';
import { useDisplayedSigils, awardOperationRewards } from '@/hooks/useNexusRewards';
import { NexusAvatarWithSigil } from '@/components/nexus/NexusAvatarWithSigil';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';
import { toast } from 'sonner';

const PHASE_META = [
  { idx: 1, label: 'Repel the Swarm', metric: 'Enemies neutralized', unit: '' },
  { idx: 2, label: 'Hold the Sector', metric: 'Score earned', unit: '' },
  { idx: 3, label: 'Crack the Siege Core', metric: 'Damage to Siege Core', unit: '' },
] as const;

function fmt(n: number) { return n.toLocaleString(); }

export default function NexusOperationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = useIsAppAdmin();
  const { operation, leaderboard, recentRuns, loading } = useActiveOperation();
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="p-6 text-center text-cyan-200/70">Loading Operation…</div>;

  if (!operation) {
    return (
      <div className="max-w-md mx-auto px-2 pt-4 pb-10">
        <div className="text-center py-10">
          <div className="mx-auto w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center mb-3">
            <Users className="w-7 h-7 text-cyan-300" />
          </div>
          <h1 className="text-xl font-black mb-1">No Operation active</h1>
          <p className="text-xs text-foreground/60 max-w-[280px] mx-auto">
            The next club-wide defense effort hasn't started yet. Check back soon.
          </p>
        </div>
        {isAdmin && user && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await startNewOperation({
                name: 'Defense of Sector I',
                flavor: 'Hostiles are massing on the edge of the Outer Rim. Defend the sector together.',
                userId: user.id,
              });
              setBusy(false);
              if (!res.ok) toast.error(res.error ?? 'Failed to start');
              else toast.success('Operation started');
            }}
            className="w-full py-3 nx-clip-sm bg-emerald-500 text-emerald-950 font-black active:scale-95"
          >
            ▶ START NEW OPERATION
          </button>
        )}
      </div>
    );
  }

  const phaseMeta = PHASE_META[operation.current_phase - 1];
  const progress = operation.current_phase === 1 ? operation.phase1_progress
    : operation.current_phase === 2 ? operation.phase2_progress
    : operation.phase3_progress;
  const target = operation.current_phase === 1 ? operation.phase1_target
    : operation.current_phase === 2 ? operation.phase2_target
    : operation.phase3_target;
  const pct = Math.min(100, Math.round((progress / target) * 100));
  const myContrib = leaderboard.find(c => c.user_id === user?.id);
  const isComplete = operation.status === 'complete';
  const mvpUserId = leaderboard[0]?.user_id ?? null;

  // Auto-trigger reward distribution once when the op completes. RPC is idempotent
  // (server-side `rewards_distributed_at` flag), so multiple contributors hitting
  // this page won't double-award.
  const distributedRef = useRef(false);
  useEffect(() => {
    if (!isComplete || !user || distributedRef.current) return;
    if (!myContrib) return; // only contributors should trigger
    distributedRef.current = true;
    awardOperationRewards(operation.id);
  }, [isComplete, operation.id, user, myContrib]);

  // Pre-fetch displayed sigils for the contributor list (one query, no N+1).
  const contributorIds = useMemo(() => leaderboard.map(c => c.user_id), [leaderboard]);
  const { data: displayedMap = {} } = useDisplayedSigils(contributorIds);

  return (
    <div className="max-w-md mx-auto px-2 pt-3 pb-10">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative nx-clip nx-bracket overflow-hidden mb-3 p-4"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 25% 15%, hsl(150 70% 22% / 0.5), transparent 60%), linear-gradient(160deg, hsl(218 50% 10%), hsl(220 60% 5%))',
          border: '1px solid hsl(150 80% 60% / 0.45)',
          boxShadow: '0 0 20px -8px hsl(150 80% 60% / 0.5)',
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="nx-pulse-dot inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(150 80% 60%)', boxShadow: '0 0 6px hsl(150 80% 60%)' }} />
          <p className="nx-title text-[9px]" style={{ color: 'hsl(150 80% 70%)' }}>
            {isComplete ? 'OPERATION · COMPLETE' : `OPERATION · PHASE ${operation.current_phase} OF 3`}
          </p>
        </div>
        <h1 className="text-2xl font-black tracking-tight">{operation.name}</h1>
        {operation.flavor && (
          <p className="text-xs text-foreground/65 mt-1.5 leading-relaxed">{operation.flavor}</p>
        )}

        {/* Phase progress */}
        {!isComplete && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[11px] font-bold" style={{ color: 'hsl(150 80% 75%)' }}>
                {phaseMeta.label}
              </span>
              <span className="text-[10px] tabular-nums text-foreground/70">
                {fmt(progress)} / {fmt(target)}
              </span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden bg-black/40 border border-white/10">
              <motion.div
                className="absolute inset-y-0 left-0"
                style={{ background: 'linear-gradient(90deg, hsl(150 80% 50%), hsl(180 90% 60%))', boxShadow: '0 0 12px hsl(150 80% 60%)' }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <div className="text-[10px] text-foreground/55 mt-1">{phaseMeta.metric}</div>
          </div>
        )}

        {isComplete && (
          <div className="mt-3 p-2.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-center">
            <div className="text-[10px] uppercase tracking-widest text-emerald-200/80">Sector held</div>
            <div className="text-base font-black text-emerald-200">All 3 phases complete</div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 mt-3 text-center">
          <Stat icon={<Users className="w-3 h-3" />} label="Crew" value={operation.total_contributors} />
          <Stat icon={<Zap className="w-3 h-3" />} label="Runs" value={operation.total_runs} />
          <Stat icon={<Trophy className="w-3 h-3" />} label="Phase" value={`${isComplete ? 3 : operation.current_phase}/3`} />
        </div>
      </motion.div>

      {/* Rewards distributed banner — appears once op completes */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 p-3 nx-clip-sm relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, hsl(45 50% 16%), hsl(45 60% 8%))',
            border: '1px solid hsl(45 100% 60% / 0.5)',
            boxShadow: '0 0 18px -4px hsl(45 100% 60% / 0.5)',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-4 h-4" style={{ color: 'hsl(45 100% 75%)' }} />
            <span className="nx-title text-[10px]" style={{ color: 'hsl(45 100% 80%)', letterSpacing: '0.22em' }}>
              REWARDS DISTRIBUTED
            </span>
          </div>
          <div className="text-[12px] leading-relaxed text-foreground/85">
            All contributors received <span className="font-black" style={{ color: 'hsl(195 95% 80%)' }}>⬢ Salvage Tokens</span> + the <span className="font-black" style={{ color: 'hsl(150 90% 78%)' }}>Operative</span> sigil.
            Top 3 earned <span className="font-black" style={{ color: 'hsl(195 95% 80%)' }}>Tactician</span>/<span className="font-black" style={{ color: 'hsl(280 95% 85%)' }}>Strategist</span> sigils.
            The MVP was crowned with the <span className="font-black" style={{ color: 'hsl(45 100% 78%)' }}>Siege Core</span> legendary.
          </div>
        </motion.div>
      )}

      {/* Phase strip */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {PHASE_META.map(p => {
          const done = operation.current_phase > p.idx || isComplete;
          const cur = !isComplete && operation.current_phase === p.idx;
          const pProg = p.idx === 1 ? operation.phase1_progress : p.idx === 2 ? operation.phase2_progress : operation.phase3_progress;
          const pTarget = p.idx === 1 ? operation.phase1_target : p.idx === 2 ? operation.phase2_target : operation.phase3_target;
          const pPct = Math.min(100, Math.round((pProg / pTarget) * 100));
          return (
            <div
              key={p.idx}
              className="p-2 nx-clip-sm border text-center"
              style={{
                background: done ? 'hsl(150 60% 14%)' : cur ? 'hsl(188 60% 10%)' : 'hsl(218 35% 8%)',
                borderColor: done ? 'hsl(150 80% 50%)' : cur ? 'hsl(var(--nx-cyan))' : 'hsl(0 0% 100% / 0.1)',
              }}
            >
              <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: done ? 'hsl(150 80% 75%)' : cur ? 'hsl(var(--nx-cyan))' : 'hsl(0 0% 100% / 0.4)' }}>
                P{p.idx}
              </div>
              <div className="text-[10px] font-bold mt-0.5 leading-tight">{p.label}</div>
              <div className="text-[9px] tabular-nums text-foreground/60 mt-0.5">{pPct}%</div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      {!isComplete && (
        <>
          <div className="text-center text-[10px] mb-1.5 text-foreground/65">
            Next run contributes: <span className="font-bold text-cyan-200">{phaseMeta.metric}</span>
          </div>
          <button
            onClick={() => navigate(`/nexus/loadout/${ENDLESS_MISSION_ID}?op=${operation.id}`)}
            className="w-full py-3.5 nx-clip-sm font-black text-sm active:scale-95 nx-title relative overflow-hidden mb-4"
            style={{
              background: 'linear-gradient(180deg, hsl(150 80% 55%), hsl(150 80% 42%))',
              color: 'hsl(150 30% 8%)',
              boxShadow: '0 0 18px hsl(150 80% 55% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.35)',
            }}
          >
            ▶ DEPLOY · CONTRIBUTE A RUN
          </button>
        </>
      )}

      {/* My contribution */}
      {myContrib && (
        <div className="mb-3 p-2.5 nx-clip-sm border border-cyan-400/30 bg-cyan-500/5">
          <div className="text-[9px] uppercase tracking-widest text-cyan-200/70 mb-1.5">Your contribution</div>
          <div className="grid grid-cols-4 gap-1 text-center">
            <MiniStat label="Pts" value={fmt(myContrib.contribution_points)} />
            <MiniStat label="Kills" value={fmt(myContrib.total_kills)} />
            <MiniStat label="Score" value={fmt(myContrib.total_score)} />
            <MiniStat label="Runs" value={myContrib.runs_submitted} />
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <h2 className="nx-title text-[9px] mb-1.5 text-foreground/55">◢ TOP CONTRIBUTORS</h2>
      <div className="space-y-1 mb-4">
        {leaderboard.length === 0 && (
          <div className="text-center text-xs text-foreground/50 py-4">Be the first to contribute.</div>
        )}
        {leaderboard.slice(0, 10).map((c, i) => {
          const isMvp = i === 0;
          return (
            <div
              key={c.user_id}
              className={`flex items-center gap-2 px-2.5 py-2 nx-clip-sm border ${
                c.user_id === user?.id ? 'bg-cyan-500/10 border-cyan-400/40' : 'bg-white/[0.02] border-white/5'
              }`}
              style={isMvp ? { borderColor: 'hsl(45 100% 60% / 0.55)', background: 'hsl(45 100% 60% / 0.06)' } : undefined}
            >
              <div className="w-6 text-center text-xs font-black tabular-nums" style={{ color: isMvp ? 'hsl(45 100% 70%)' : 'hsl(0 0% 100% / 0.5)' }}>
                {isMvp ? <Crown className="w-3.5 h-3.5 inline" /> : `#${i + 1}`}
              </div>
              <NexusAvatarWithSigil
                userId={c.user_id}
                src={c.avatar_url}
                fallback={c.display_name?.[0]?.toUpperCase() ?? '?'}
                size={32}
                displayed={displayedMap}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{c.display_name ?? 'Pilot'}</div>
                <div className="text-[10px] text-foreground/55 tabular-nums">
                  {fmt(c.total_kills)} kills · best W{c.best_waves}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black tabular-nums" style={{ color: isMvp ? 'hsl(45 100% 78%)' : 'hsl(195 95% 80%)' }}>
                  {fmt(c.contribution_points)}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-foreground/40">pts</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent runs */}
      {recentRuns.length > 0 && (
        <>
          <h2 className="nx-title text-[9px] mb-1.5 text-foreground/55">◢ RECENT ACTIVITY</h2>
          <div className="space-y-1 mb-4">
            {recentRuns.slice(0, 8).map(r => {
              const name = r.display_name ?? 'Pilot';
              // Pick the dominant verb based on what the run contributed most.
              let verb = `added ${fmt(r.contribution_points)} pts`;
              if ((r.boss_damage ?? 0) >= 1000) verb = `damaged the Siege Core (+${fmt(r.contribution_points)})`;
              else if ((r.score ?? 0) >= 50000) verb = `pushed Phase 2 (+${fmt(r.contribution_points)})`;
              else if ((r.kills ?? 0) >= 100) verb = `repelled ${fmt(r.kills)} enemies (+${fmt(r.contribution_points)})`;
              return (
                <div key={r.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] border border-white/5 bg-white/[0.02] nx-clip-sm">
                  <Flame className="w-3 h-3 text-amber-300 shrink-0" />
                  <div className="truncate flex-1 min-w-0">
                    <span className="font-bold">{name}</span>
                    <span className="text-foreground/65"> {verb}</span>
                  </div>
                  <div className="text-[10px] text-foreground/45 tabular-nums shrink-0">{timeAgo(r.created_at)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Admin */}
      {isAdmin && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="text-[9px] uppercase tracking-widest text-foreground/50 mb-2">Admin controls</div>
          <button
            disabled={busy}
            onClick={async () => {
              if (!confirm('End the current operation now?')) return;
              setBusy(true);
              const res = await endOperation(operation.id);
              setBusy(false);
              if (!res.ok) toast.error(res.error ?? 'Failed'); else toast.success('Operation ended');
            }}
            className="w-full py-2 text-xs font-bold border border-rose-400/40 bg-rose-500/10 text-rose-200 nx-clip-sm active:scale-95"
          >
            End Operation
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="px-2 py-1.5 nx-clip-sm bg-black/30 border border-white/10">
      <div className="text-[8px] uppercase tracking-widest text-foreground/55 flex items-center justify-center gap-1">
        {icon}{label}
      </div>
      <div className="text-sm font-black tabular-nums">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-cyan-200/60">{label}</div>
      <div className="text-sm font-black tabular-nums">{value}</div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
