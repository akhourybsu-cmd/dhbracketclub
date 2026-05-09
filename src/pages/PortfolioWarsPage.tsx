import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  ChevronRight, Trophy, Crown, Sparkles, RefreshCw, ShieldCheck, Lock, Unlock,
  BarChart3, Users, Calendar, AlertTriangle, Edit3,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCurrentChallenge, useMyEntry, useChallengeLeaderboard, useChallengeAccolades,
  useAllChallenges, usePwAdminAction, type PwChallenge,
} from '@/hooks/usePortfolioWars';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MarketClock } from '@/components/portfolioWars/MarketClock';
import { StockPickCard } from '@/components/portfolioWars/StockPickCard';
import { PickStocksDialog } from '@/components/portfolioWars/PickStocksDialog';
import { LeaderboardList } from '@/components/portfolioWars/LeaderboardList';
import { Sparkline } from '@/components/portfolioWars/Sparkline';

const ACCOLADE_META: Record<string, { label: string; emoji: string; color: string; sub?: string }> = {
  winner:        { label: 'Market Master',  emoji: '👑', color: 'hsl(45 95% 60%)' },
  best_pick:     { label: 'Best Single Pick', emoji: '🚀', color: 'hsl(152 80% 65%)' },
  worst_pick:    { label: 'Bag Holder',     emoji: '🛍️', color: 'hsl(0 80% 70%)' },
  most_balanced: { label: 'Diamond Hands',  emoji: '💎', color: 'hsl(195 85% 70%)' },
  boom_or_bust:  { label: 'Boom or Bust',   emoji: '💥', color: 'hsl(280 75% 72%)' },
  bag_holder:    { label: 'Bag Holder',     emoji: '🛍️', color: 'hsl(20 75% 65%)' },
  all_green:     { label: 'All Green',      emoji: '🟢', color: 'hsl(152 80% 65%)' },
};

/* ─────────────────── Lobby ─────────────────── */
function Lobby({ challenge }: { challenge: PwChallenge | null }) {
  const { user } = useAuth();
  const { data: entry, refetch } = useMyEntry(challenge?.id);
  const { data: leaderboard } = useChallengeLeaderboard(challenge?.id);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!challenge) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: 'hsl(220 45% 6% / 0.6)', border: '1px solid hsl(220 25% 14%)' }}
      >
        <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: 'hsl(150 10% 35%)' }} />
        <h3 className="font-extrabold text-[15px] mb-1">No Active Challenge</h3>
        <p className="text-[12px] text-white/55">A new weekly challenge will open soon.</p>
      </div>
    );
  }

  const myPicks = (entry?.pw_picks || []).slice().sort((a, b) => a.position - b.position);
  const myTickers = myPicks.map((p) => p.ticker);
  const myRankIdx = leaderboard?.findIndex((e: any) => e.user_id === user?.id) ?? -1;
  const totalPlayers = leaderboard?.length || 0;

  // Identify best/worst pick by pct
  let bestId: string | undefined;
  let worstId: string | undefined;
  if (myPicks.length === 3 && myPicks.every((p) => p.pct_change != null)) {
    const sorted = [...myPicks].sort((a, b) => Number(b.pct_change) - Number(a.pct_change));
    bestId = sorted[0].id;
    worstId = sorted[sorted.length - 1].id;
  }

  // % of players you're beating
  const beatingPct = myRankIdx >= 0 && totalPlayers > 1
    ? Math.round(((totalPlayers - myRankIdx - 1) / (totalPlayers - 1)) * 100)
    : null;

  const editable = challenge.status === 'upcoming';
  const canEnter = editable;
  const myAvg = entry?.avg_pct != null ? Number(entry.avg_pct) : null;
  const inTop3 = myRankIdx >= 0 && myRankIdx < 3;

  return (
    <div className="space-y-3">
      <MarketClock challenge={challenge} />

      {/* Portfolio entry / team card */}
      {myTickers.length === 3 ? (
        <div
          className="relative overflow-hidden rounded-2xl p-4"
          style={{
            background:
              'radial-gradient(ellipse 100% 60% at 50% 0%, hsl(152 80% 30% / 0.18), transparent 65%),' +
              'linear-gradient(180deg, hsl(220 45% 8%), hsl(220 50% 5%))',
            border: '1px solid hsl(152 80% 50% / 0.28)',
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0">
              <div
                className="text-[9px] font-black uppercase tracking-[0.22em] mb-0.5"
                style={{ color: 'hsl(152 80% 65%)' }}
              >
                ◆ My Portfolio
              </div>
              <div className="text-[15px] font-extrabold truncate">
                {entry ? `Entry · ${myTickers.join(' · ')}` : 'Locked In'}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[9px] font-black uppercase tracking-wider text-white/50">Avg</div>
              <div
                className="text-[20px] font-black tabular-nums font-mono leading-none"
                style={{
                  color: myAvg == null ? 'hsl(150 10% 60%)' : myAvg >= 0 ? 'hsl(152 80% 70%)' : 'hsl(0 80% 75%)',
                  textShadow: myAvg != null
                    ? `0 0 12px ${myAvg >= 0 ? 'hsl(152 80% 50% / 0.5)' : 'hsl(0 75% 55% / 0.5)'}`
                    : undefined,
                }}
              >
                {myAvg == null ? '—' : `${myAvg >= 0 ? '+' : ''}${myAvg.toFixed(2)}%`}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {myPicks.map((p) => (
              <StockPickCard
                key={p.id}
                ticker={p.ticker}
                startPrice={p.start_price != null ? Number(p.start_price) : null}
                latestPrice={p.latest_price != null ? Number(p.latest_price) : (p.end_price != null ? Number(p.end_price) : null)}
                pct={p.pct_change != null ? Number(p.pct_change) : null}
                bestBadge={bestId === p.id}
                worstBadge={worstId === p.id}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              {myRankIdx >= 0 && (
                <span
                  className="px-2 py-1 rounded-md font-black tabular-nums font-mono text-[11px]"
                  style={{
                    background: inTop3 ? 'hsl(45 95% 55% / 0.16)' : 'hsl(220 30% 12%)',
                    color: inTop3 ? 'hsl(45 95% 65%)' : 'hsl(150 12% 75%)',
                    border: inTop3 ? '1px solid hsl(45 95% 55% / 0.4)' : '1px solid hsl(220 25% 18%)',
                  }}
                >
                  {inTop3 && <Trophy className="w-3 h-3 inline mr-1" />}
                  Rank #{myRankIdx + 1} / {totalPlayers}
                </span>
              )}
            </div>
            {editable && (
              <button
                onClick={() => setPickerOpen(true)}
                className="text-[11px] font-extrabold flex items-center gap-1 active:scale-95 transition"
                style={{ color: 'hsl(38 100% 65%)' }}
              >
                <Edit3 className="w-3 h-3" /> Edit Picks
              </button>
            )}
          </div>

          {beatingPct != null && (
            <p className="mt-2 text-center text-[10.5px] italic" style={{ color: 'hsl(150 12% 65%)' }}>
              You're currently beating {beatingPct}% of players.
            </p>
          )}

          {challenge.status === 'active' && (
            <p className="mt-1 text-center text-[9.5px] uppercase tracking-wider font-bold text-white/40">
              Prices update end-of-day · not real-time
            </p>
          )}
        </div>
      ) : (
        // Empty: enter CTA
        <div
          className="relative overflow-hidden rounded-2xl p-5 text-center"
          style={{
            background:
              'radial-gradient(ellipse 100% 60% at 50% 0%, hsl(152 80% 30% / 0.30), transparent 65%),' +
              'linear-gradient(180deg, hsl(220 45% 8%), hsl(220 50% 5%))',
            border: '1px solid hsl(152 80% 50% / 0.34)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{
              background: 'hsl(152 80% 50% / 0.16)',
              border: '1px solid hsl(152 80% 50% / 0.38)',
              boxShadow: '0 0 20px hsl(152 80% 50% / 0.4)',
            }}
          >
            <BarChart3 className="w-6 h-6" style={{ color: 'hsl(152 80% 65%)' }} />
          </div>
          <h3 className="text-[16px] font-extrabold mb-1">Pick 3. Survive the week.</h3>
          <p className="text-[11.5px] text-white/60 mb-4">
            Build your 3-stock portfolio before Monday's open. Highest average % wins.
          </p>
          {canEnter ? (
            <Button
              onClick={() => setPickerOpen(true)}
              className="w-full h-11 font-black uppercase tracking-wider text-[12px]"
              style={{
                background: 'linear-gradient(135deg, hsl(152 80% 48%), hsl(152 80% 38%))',
                color: 'hsl(220 60% 4%)',
                boxShadow: '0 6px 20px hsl(152 80% 40% / 0.45)',
              }}
            >
              <Sparkles className="w-4 h-4" /> Enter This Week
            </Button>
          ) : (
            <div
              className="text-center text-[11px] flex items-center justify-center gap-1.5 py-3 rounded-lg"
              style={{ background: 'hsl(220 30% 10%)', color: 'hsl(38 100% 65%)' }}
            >
              <Lock className="w-3.5 h-3.5" /> Picks are locked. Let the market decide.
            </div>
          )}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-xl p-3 flex items-center gap-2"
          style={{ background: 'hsl(220 45% 7% / 0.7)', border: '1px solid hsl(220 25% 14%)' }}
        >
          <Users className="w-4 h-4" style={{ color: 'hsl(195 80% 65%)' }} />
          <div>
            <div className="text-[9px] font-black uppercase tracking-wider text-white/50">Players</div>
            <div className="text-[14px] font-black tabular-nums font-mono">{totalPlayers}</div>
          </div>
        </div>
        <div
          className="rounded-xl p-3 flex items-center gap-2"
          style={{ background: 'hsl(220 45% 7% / 0.7)', border: '1px solid hsl(220 25% 14%)' }}
        >
          <Calendar className="w-4 h-4" style={{ color: 'hsl(38 100% 65%)' }} />
          <div>
            <div className="text-[9px] font-black uppercase tracking-wider text-white/50">Week</div>
            <div className="text-[14px] font-black tabular-nums font-mono">#{challenge.week_number}</div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div
        className="rounded-lg p-2.5 flex items-start gap-2 text-[10px]"
        style={{ background: 'hsl(38 60% 10% / 0.4)', border: '1px solid hsl(38 100% 50% / 0.18)', color: 'hsl(38 30% 75%)' }}
      >
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'hsl(38 100% 60%)' }} />
        <span>
          <strong>For entertainment only.</strong> Portfolio Wars is a friendly competition — not financial advice or real trading.
        </span>
      </div>

      {editable && (
        <PickStocksDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          challenge={challenge}
          currentTickers={myTickers}
          onDone={refetch}
        />
      )}
    </div>
  );
}

/* ─────────────────── Results view (completed week) ─────────────────── */
function ResultsView({ challenge }: { challenge: PwChallenge }) {
  const { user } = useAuth();
  const { data: leaderboard } = useChallengeLeaderboard(challenge.id);
  const { data: accolades } = useChallengeAccolades(challenge.id);
  const winner = leaderboard?.[0];
  const profileMap = new Map((leaderboard || []).map((r: any) => [r.user_id, r.profile]));

  return (
    <div className="space-y-3">
      {/* Winner hero */}
      {winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl p-5 text-center"
          style={{
            background:
              'radial-gradient(ellipse 120% 80% at 50% 0%, hsl(45 95% 35% / 0.55), transparent 60%),' +
              'linear-gradient(180deg, hsl(45 30% 10%), hsl(45 30% 5%))',
            border: '1px solid hsl(45 95% 55% / 0.45)',
            boxShadow: '0 0 40px -10px hsl(45 95% 50% / 0.5)',
          }}
        >
          <Crown className="w-10 h-10 mx-auto mb-2" style={{ color: 'hsl(45 95% 60%)', filter: 'drop-shadow(0 0 12px hsl(45 95% 50% / 0.7))' }} />
          <div
            className="text-[10px] font-black uppercase tracking-[0.22em] mb-1"
            style={{ color: 'hsl(45 95% 70%)' }}
          >
            The Market Has Spoken
          </div>
          <h2 className="text-[22px] font-black mb-2">{winner.profile?.display_name || 'Player'}</h2>
          <span
            className="inline-block px-3 py-1 rounded-md text-[14px] font-black tabular-nums font-mono"
            style={{
              background: 'hsl(152 80% 50% / 0.18)',
              color: 'hsl(152 80% 70%)',
              border: '1px solid hsl(152 80% 50% / 0.4)',
            }}
          >
            {winner.avg_pct != null && (Number(winner.avg_pct) >= 0 ? '+' : '')}
            {winner.avg_pct != null ? `${Number(winner.avg_pct).toFixed(2)}%` : '—'}
          </span>
        </motion.div>
      )}

      {/* Accolades */}
      {accolades && accolades.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{ background: 'hsl(220 45% 7% / 0.7)', border: '1px solid hsl(220 25% 14%)' }}
        >
          <h3 className="font-black text-[13px] mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'hsl(38 100% 65%)' }} /> Weekly Accolades
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {accolades.map((a, i) => {
              const m = ACCOLADE_META[a.kind];
              if (!m) return null;
              const prof: any = profileMap.get(a.user_id);
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="rounded-xl p-3"
                  style={{
                    background: `${m.color.replace(')', ' / 0.06)')}`,
                    border: `1px solid ${m.color.replace(')', ' / 0.28)')}`,
                  }}
                >
                  <div className="text-xl mb-1">{m.emoji}</div>
                  <div
                    className="text-[9.5px] font-black uppercase tracking-wider mb-0.5"
                    style={{ color: m.color }}
                  >
                    {m.label}
                  </div>
                  <div className="text-[12px] font-extrabold truncate">{prof?.display_name || 'Player'}</div>
                  {a.ticker && (
                    <div className="text-[10px] font-mono text-white/55">{a.ticker}</div>
                  )}
                  {a.value != null && (
                    <div className="text-[10px] tabular-nums font-mono text-white/55">
                      {a.kind === 'most_balanced' || a.kind === 'boom_or_bust'
                        ? `σ ${Number(a.value).toFixed(2)}`
                        : `${Number(a.value) >= 0 ? '+' : ''}${Number(a.value).toFixed(2)}%`}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-black text-[13px] mb-2 px-1 uppercase tracking-wider text-white/70">Final Standings</h3>
        <LeaderboardList rows={leaderboard as any} currentUserId={user?.id} />
      </div>
    </div>
  );
}

/* ─────────────────── Admin panel ─────────────────── */
function AdminPanel({ challenge }: { challenge: PwChallenge | null }) {
  const action = usePwAdminAction();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    supabase.rpc('is_app_admin', { _user_id: user.id }).then(({ data }) => setIsAdmin(!!data));
  }, [user?.id]);
  if (!isAdmin) return null;

  async function run(label: string, payload: any) {
    try {
      const res = await action.mutateAsync(payload);
      toast.success(`${label}: ${JSON.stringify(res).slice(0, 80)}`);
    } catch (e: any) {
      toast.error(`${label} failed: ${e?.message || e}`);
    }
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'hsl(38 50% 8% / 0.5)', border: '1px solid hsl(38 100% 50% / 0.28)' }}
    >
      <h3 className="font-black text-[13px] mb-2 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'hsl(38 100% 65%)' }} /> Admin Controls
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={() => run('Open next', { action: 'open_next' })}>
          Open Next Week
        </Button>
        <Button size="sm" variant="outline" onClick={() => run('Snapshot', { action: 'snapshot' })}>
          <RefreshCw className="w-3 h-3" /> Snapshot Prices
        </Button>
        {challenge && (
          <>
            <Button size="sm" variant="outline" onClick={() => run('Lock', { action: 'lock', challenge_id: challenge.id })}>
              Lock Week
            </Button>
            <Button size="sm" variant="outline" onClick={() => run('Finalize', { action: 'finalize', challenge_id: challenge.id })}>
              Finalize Week
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── Leaderboard tab wrapper ─────────────────── */
function LeaderboardTab({ challengeId, currentUserId }: { challengeId?: string; currentUserId?: string }) {
  const { data } = useChallengeLeaderboard(challengeId);
  return <LeaderboardList rows={data as any} currentUserId={currentUserId} />;
}

/* ─────────────────── Main page ─────────────────── */
export default function PortfolioWarsPage() {
  const { user } = useAuth();
  const { data: current, isLoading } = useCurrentChallenge();
  const { data: allChallenges } = useAllChallenges();
  const completed = useMemo(
    () => (allChallenges || []).filter((c) => c.status === 'completed' || c.status === 'archived'),
    [allChallenges],
  );
  const [historyId, setHistoryId] = useState<string | null>(null);
  const historyChallenge = useMemo(
    () => completed.find((c) => c.id === historyId) || null,
    [completed, historyId],
  );

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Tabs defaultValue="lobby" className="w-full">
          <TabsList
            className="grid w-full grid-cols-3 mb-4 h-10"
            style={{ background: 'hsl(220 45% 6%)', border: '1px solid hsl(220 25% 14%)' }}
          >
            <TabsTrigger value="lobby" className="text-[11px] font-black uppercase tracking-wider">
              Lobby
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-[11px] font-black uppercase tracking-wider">
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="history" className="text-[11px] font-black uppercase tracking-wider">
              Archive
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lobby" className="space-y-3">
            {isLoading ? (
              <LobbySkeleton />
            ) : (
              <>
                {current && (current.status === 'completed' || current.status === 'archived')
                  ? <ResultsView challenge={current} />
                  : <Lobby challenge={current || null} />}
                <AdminPanel challenge={current || null} />
              </>
            )}
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-3">
            {current ? (
              <>
                <div
                  className="rounded-lg p-2.5 flex items-center justify-between text-[11px]"
                  style={{ background: 'hsl(220 45% 6%)', border: '1px solid hsl(220 25% 14%)' }}
                >
                  <span className="font-bold text-white/65">
                    Week {current.week_number} · {format(new Date(current.week_start), 'MMM d')}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                    style={{ background: 'hsl(152 80% 50% / 0.16)', color: 'hsl(152 80% 65%)' }}
                  >
                    {current.status}
                  </span>
                </div>
                <LeaderboardTab challengeId={current.id} currentUserId={user?.id} />
              </>
            ) : (
              <div
                className="rounded-2xl p-6 text-center text-[12px]"
                style={{ background: 'hsl(220 45% 6%)', border: '1px solid hsl(220 25% 14%)', color: 'hsl(150 10% 60%)' }}
              >
                No active challenge.
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {completed.length === 0 ? (
              <div
                className="rounded-2xl p-6 text-center text-[12px]"
                style={{ background: 'hsl(220 45% 6%)', border: '1px solid hsl(220 25% 14%)', color: 'hsl(150 10% 60%)' }}
              >
                No completed weeks yet. Friday close decides the first one.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {completed.map((c) => (
                    <ArchiveCard key={c.id} challenge={c} onOpen={() => setHistoryId(c.id)} />
                  ))}
                </div>
                <Dialog open={!!historyChallenge} onOpenChange={(o) => !o && setHistoryId(null)}>
                  <DialogContent className="max-w-md p-0 max-h-[85vh] overflow-y-auto">
                    {historyChallenge && (
                      <div className="p-4">
                        <DialogHeader className="mb-3">
                          <DialogTitle className="text-base font-extrabold">
                            Week {historyChallenge.week_number} Results
                          </DialogTitle>
                          <p className="text-[11px] text-white/55">
                            {format(new Date(historyChallenge.week_start), 'MMM d')} — {format(new Date(historyChallenge.week_end), 'MMM d, yyyy')}
                          </p>
                        </DialogHeader>
                        <ResultsView challenge={historyChallenge} />
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

function ArchiveCard({ challenge, onOpen }: { challenge: PwChallenge; onOpen: () => void }) {
  const { data: leaderboard } = useChallengeLeaderboard(challenge.id);
  const winner = leaderboard?.[0];
  return (
    <button
      onClick={onOpen}
      className="w-full rounded-xl p-3 flex items-center gap-3 text-left active:scale-[0.99] transition"
      style={{ background: 'hsl(220 45% 7% / 0.7)', border: '1px solid hsl(220 25% 14%)' }}
    >
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'hsl(45 95% 55% / 0.10)', border: '1px solid hsl(45 95% 55% / 0.28)' }}
      >
        <Trophy className="w-5 h-5" style={{ color: 'hsl(45 95% 60%)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-black uppercase tracking-wider text-white/55">
          Week {challenge.week_number}
        </div>
        <div className="text-[13px] font-extrabold truncate">
          {winner?.profile?.display_name || 'Champion TBD'}
          {winner?.avg_pct != null && (
            <span
              className="ml-2 font-mono text-[12px]"
              style={{ color: Number(winner.avg_pct) >= 0 ? 'hsl(152 80% 70%)' : 'hsl(0 80% 75%)' }}
            >
              {Number(winner.avg_pct) >= 0 ? '+' : ''}{Number(winner.avg_pct).toFixed(2)}%
            </span>
          )}
        </div>
        <div className="text-[10px] text-white/50 font-mono">
          {format(new Date(challenge.week_start), 'MMM d')} — {format(new Date(challenge.week_end), 'MMM d, yyyy')}
          {leaderboard && ` · ${leaderboard.length} players`}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-white/40" />
    </button>
  );
}

function LobbySkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-28 rounded-2xl animate-pulse" style={{ background: 'hsl(220 45% 7%)' }} />
      <div className="h-44 rounded-2xl animate-pulse" style={{ background: 'hsl(220 45% 7%)' }} />
      <div className="h-12 rounded-xl animate-pulse" style={{ background: 'hsl(220 45% 7%)' }} />
    </div>
  );
}
