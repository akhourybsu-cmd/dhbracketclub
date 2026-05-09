import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNowStrict } from 'date-fns';
import {
  TrendingUp, TrendingDown, Lock, Unlock, ChevronRight, Trophy, Crown,
  Search, X, Clock, BarChart3, Sparkles, RefreshCw, ShieldCheck, ArrowLeft, Share2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCurrentChallenge, useMyEntry, useChallengeLeaderboard, useChallengeAccolades,
  useAllChallenges, useSubmitPicks, usePwAdminAction, type PwChallenge,
} from '@/hooks/usePortfolioWars';
import { searchTickers, TICKER_MAP } from '@/lib/portfolioWars/tickers';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { copyShareTextWithLink } from '@/lib/share';
import { toast } from 'sonner';

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'Upcoming',
  locked: 'Locked',
  active: 'In Progress',
  completed: 'Complete',
  archived: 'Archived',
};

function statusColor(s: string) {
  switch (s) {
    case 'upcoming': return 'hsl(195 90% 60%)';
    case 'locked': return 'hsl(45 95% 60%)';
    case 'active': return 'hsl(152 70% 55%)';
    case 'completed': return 'hsl(280 70% 65%)';
    default: return 'hsl(0 0% 60%)';
  }
}

function PctBadge({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className={cn('text-muted-foreground/60', className)}>—</span>;
  const positive = value >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold tabular-nums',
        className,
      )}
      style={{
        background: positive ? 'hsl(152 70% 50% / 0.15)' : 'hsl(0 75% 60% / 0.15)',
        color: positive ? 'hsl(152 70% 65%)' : 'hsl(0 75% 70%)',
      }}
    >
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const c = statusColor(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-[0.1em]"
      style={{
        background: `${c.replace(')', ' / 0.15)').replace('hsl(', 'hsl(')}`,
        color: c, border: `1px solid ${c.replace(')', ' / 0.3)')}`,
      }}
    >
      {status === 'active' && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c }} />}
      {STATUS_LABEL[status] || status}
    </span>
  );
}

/* ─── Pick stocks dialog ─── */
function PickStocksDialog({
  open, onOpenChange, challenge, currentTickers, onDone,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  challenge: PwChallenge;
  currentTickers: string[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(currentTickers);
  const [query, setQuery] = useState('');
  const submit = useSubmitPicks();

  useEffect(() => { setSelected(currentTickers); }, [currentTickers, open]);

  const results = useMemo(() => searchTickers(query, 30), [query]);

  function toggle(symbol: string) {
    setSelected((s) => {
      if (s.includes(symbol)) return s.filter((x) => x !== symbol);
      if (s.length >= 3) {
        toast.error('You already have 3 picks. Remove one first.');
        return s;
      }
      return [...s, symbol];
    });
  }

  async function handleSubmit() {
    try {
      await submit.mutateAsync({ challengeId: challenge.id, tickers: selected });
      toast.success('Picks locked in 🚀');
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save picks');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b border-border/40">
          <DialogTitle className="text-base font-extrabold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Pick Your 3 Stocks
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            Week of {format(new Date(challenge.week_start), 'MMM d')} — locks {format(new Date(challenge.lock_at), 'EEE h:mm a')}
          </p>
        </DialogHeader>

        {/* Selected */}
        <div className="px-4 pt-3">
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => {
              const sym = selected[i];
              const meta = sym ? TICKER_MAP[sym] : null;
              return (
                <div
                  key={i}
                  className={cn(
                    'h-16 rounded-xl flex flex-col items-center justify-center text-center px-1 relative',
                    sym ? 'bg-primary/10 border border-primary/40' : 'bg-muted/30 border border-dashed border-border/50',
                  )}
                >
                  {sym ? (
                    <>
                      <button
                        onClick={() => toggle(sym)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                        aria-label="Remove"
                      >
                        <X className="w-3 h-3" strokeWidth={3} />
                      </button>
                      <span className="font-extrabold text-[13px]">{sym}</span>
                      <span className="text-[9px] text-muted-foreground truncate w-full">
                        {meta?.name || ''}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60 font-bold">Slot {i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ticker or company..."
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Results */}
        <div className="px-2 pt-2 pb-3 max-h-[40vh] overflow-y-auto">
          {results.map((t) => {
            const isSelected = selected.includes(t.symbol);
            return (
              <button
                key={t.symbol}
                onClick={() => toggle(t.symbol)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg active:scale-[0.99] transition',
                  isSelected ? 'bg-primary/15' : 'hover:bg-muted/40',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-[11px]',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/80',
                    )}
                  >
                    {t.symbol.slice(0, 4)}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-[12px] font-extrabold leading-tight">{t.symbol}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{t.name}</div>
                  </div>
                </div>
                {t.sector && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 flex-shrink-0">
                    {t.sector}
                  </span>
                )}
              </button>
            );
          })}
          {results.length === 0 && (
            <p className="text-center text-[12px] text-muted-foreground py-6">No matches.</p>
          )}
        </div>

        <div className="p-3 border-t border-border/40 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="flex-1"
            disabled={selected.length !== 3 || submit.isPending}
            onClick={handleSubmit}
          >
            {submit.isPending ? 'Saving…' : `Lock In ${selected.length}/3`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Lobby ─── */
function Lobby({ challenge }: { challenge: PwChallenge | null }) {
  const { user } = useAuth();
  const { data: entry, refetch } = useMyEntry(challenge?.id);
  const { data: leaderboard } = useChallengeLeaderboard(challenge?.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  if (!challenge) {
    return (
      <div className="glass-card p-6 text-center">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
        <h3 className="font-extrabold text-[15px] mb-1">No Active Challenge</h3>
        <p className="text-[12px] text-muted-foreground">An admin will open the next weekly challenge soon.</p>
      </div>
    );
  }

  const lockMs = new Date(challenge.lock_at).getTime() - now;
  const endMs = new Date(challenge.end_at).getTime() - now;
  const myTickers = entry?.pw_picks?.sort((a, b) => a.position - b.position).map((p) => p.ticker) || [];
  const myRank = leaderboard?.findIndex((e: any) => e.user_id === user?.id);
  const totalPlayers = leaderboard?.length || 0;

  return (
    <div className="space-y-3">
      {/* Hero status card */}
      <div
        className="relative overflow-hidden rounded-2xl p-5"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% 0%, hsl(152 70% 30% / 0.45), transparent 60%),' +
            'linear-gradient(180deg, hsl(160 30% 8%), hsl(160 30% 5%))',
          border: '1px solid hsl(152 60% 40% / 0.3)',
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-primary/80 mb-1">
              ◆ Portfolio Wars · Week {challenge.week_number}
            </div>
            <h2 className="text-[22px] font-extrabold leading-none">
              {format(new Date(challenge.week_start), 'MMM d')} — {format(new Date(challenge.week_end), 'MMM d')}
            </h2>
          </div>
          <StatusPill status={challenge.status} />
        </div>

        {/* Countdown / context */}
        <div className="text-[12px] text-muted-foreground/90 mb-4">
          {challenge.status === 'upcoming' && lockMs > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Picks lock in <strong>{formatDistanceToNowStrict(new Date(challenge.lock_at))}</strong>
            </span>
          )}
          {challenge.status === 'active' && endMs > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Closes in <strong>{formatDistanceToNowStrict(new Date(challenge.end_at))}</strong>
            </span>
          )}
          {(challenge.status === 'completed' || challenge.status === 'archived') && (
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Week complete · {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'}
            </span>
          )}
          {challenge.status === 'locked' && <span>Awaiting market open…</span>}
        </div>

        {/* CTA */}
        {challenge.status === 'upcoming' ? (
          <Button
            onClick={() => setPickerOpen(true)}
            className="w-full font-extrabold"
            size="lg"
          >
            {myTickers.length === 3 ? <><Unlock className="w-4 h-4" /> Edit My Picks</> : <><Sparkles className="w-4 h-4" /> Enter Weekly Challenge</>}
          </Button>
        ) : (
          <div className="text-center text-[11px] text-muted-foreground italic flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Picks are locked
          </div>
        )}
      </div>

      {/* My picks card */}
      {myTickers.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-[13px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> My Portfolio
            </h3>
            {entry?.avg_pct != null && <PctBadge value={Number(entry.avg_pct)} />}
          </div>
          <div className="space-y-2">
            {entry?.pw_picks?.sort((a, b) => a.position - b.position).map((p) => {
              const meta = TICKER_MAP[p.ticker];
              return (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center font-extrabold text-[11px] text-primary">
                      {p.ticker.slice(0, 4)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-extrabold">{p.ticker}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{meta?.name || ''}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {p.start_price != null && p.latest_price != null && (
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        ${Number(p.start_price).toFixed(2)} → ${Number(p.latest_price).toFixed(2)}
                      </div>
                    )}
                    <PctBadge value={p.pct_change != null ? Number(p.pct_change) : null} />
                  </div>
                </div>
              );
            })}
          </div>
          {myRank != null && myRank >= 0 && (
            <div className="mt-3 text-[11px] text-center text-muted-foreground">
              Current rank · <strong className="text-foreground">#{myRank + 1}</strong> of {totalPlayers}
            </div>
          )}
          {challenge.status === 'active' && (
            <p className="mt-2 text-center text-[10px] text-muted-foreground/70 italic">
              Prices refresh end-of-day. Not real-time.
            </p>
          )}
        </div>
      )}

      {/* Rules summary */}
      <div className="glass-card p-4">
        <h3 className="font-extrabold text-[13px] mb-2">How It Works</h3>
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          <li>• Pick 3 stock tickers before Monday market open.</li>
          <li>• Score = average % gain across your 3 picks (Mon open → Fri close).</li>
          <li>• Highest average wins the week. Special accolades for best/worst picks.</li>
          <li>• Prices update end-of-day. Not real-time.</li>
        </ul>
      </div>

      {challenge.status === 'upcoming' && (
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

/* ─── Leaderboard ─── */
function LeaderboardList({ challengeId, currentUserId }: { challengeId?: string; currentUserId?: string }) {
  const { data: rows } = useChallengeLeaderboard(challengeId);
  if (!rows?.length) {
    return (
      <div className="glass-card p-6 text-center text-[12px] text-muted-foreground">
        No entries yet. Be the first to pick!
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((r: any, i: number) => {
        const isMe = r.user_id === currentUserId;
        const tickers = (r.pw_picks || []).sort((a: any, b: any) => a.position - b.position);
        return (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            className={cn(
              'glass-card p-3 flex items-center gap-3',
              isMe && 'border-primary/40',
            )}
            style={isMe ? { background: 'hsl(var(--primary) / 0.05)' } : undefined}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-[12px] flex-shrink-0',
                i === 0 && 'bg-gold/20 text-gold',
                i === 1 && 'bg-muted text-foreground/80',
                i === 2 && 'bg-amber-700/20 text-amber-500',
                i > 2 && 'bg-muted/40 text-muted-foreground',
              )}
              style={i === 0 ? { background: 'hsl(45 95% 55% / 0.18)', color: 'hsl(45 95% 60%)' } : undefined}
            >
              {i === 0 ? <Crown className="w-4 h-4" /> : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-extrabold truncate">
                {r.profile?.display_name || 'Player'} {isMe && <span className="text-primary">(you)</span>}
              </div>
              <div className="flex gap-1 mt-0.5">
                {tickers.map((p: any) => (
                  <span
                    key={p.id}
                    className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-muted/60 text-foreground/75"
                  >
                    {p.ticker}
                  </span>
                ))}
              </div>
            </div>
            <PctBadge value={r.avg_pct != null ? Number(r.avg_pct) : null} />
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Completed week results (with accolades) ─── */
function ResultsView({ challenge }: { challenge: PwChallenge }) {
  const { user } = useAuth();
  const { data: leaderboard } = useChallengeLeaderboard(challenge.id);
  const { data: accolades } = useChallengeAccolades(challenge.id);
  const winner = leaderboard?.[0];
  const ACCOLADE_META: Record<string, { label: string; emoji: string; color: string }> = {
    winner: { label: 'Champion', emoji: '👑', color: 'hsl(45 95% 60%)' },
    best_pick: { label: 'Best Single Pick', emoji: '🚀', color: 'hsl(152 70% 60%)' },
    worst_pick: { label: 'Worst Pick', emoji: '💀', color: 'hsl(0 75% 65%)' },
    most_balanced: { label: 'Most Balanced', emoji: '⚖️', color: 'hsl(195 80% 65%)' },
    boom_or_bust: { label: 'Boom or Bust', emoji: '💥', color: 'hsl(280 70% 70%)' },
    bag_holder: { label: 'Bag Holder', emoji: '🛍️', color: 'hsl(20 70% 60%)' },
  };
  const profileMap = new Map((leaderboard || []).map((r: any) => [r.user_id, r.profile]));

  return (
    <div className="space-y-3">
      {winner && (
        <div
          className="rounded-2xl p-5 text-center relative overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse 120% 80% at 50% 0%, hsl(45 95% 35% / 0.5), transparent 60%),' +
              'linear-gradient(180deg, hsl(45 30% 10%), hsl(45 30% 6%))',
            border: '1px solid hsl(45 95% 55% / 0.4)',
          }}
        >
          <Crown className="w-9 h-9 mx-auto mb-2" style={{ color: 'hsl(45 95% 60%)' }} />
          <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold/80 mb-1">Week Winner</div>
          <h2 className="text-[20px] font-extrabold mb-1">{winner.profile?.display_name || 'Player'}</h2>
          <PctBadge value={winner.avg_pct != null ? Number(winner.avg_pct) : null} className="text-sm" />
        </div>
      )}

      {accolades && accolades.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="font-extrabold text-[13px] mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Accolades
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {accolades.map((a) => {
              const m = ACCOLADE_META[a.kind];
              if (!m) return null;
              const prof: any = profileMap.get(a.user_id);
              return (
                <div key={a.id} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="text-lg mb-1">{m.emoji}</div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider mb-0.5" style={{ color: m.color }}>
                    {m.label}
                  </div>
                  <div className="text-[12px] font-bold truncate">{prof?.display_name || 'Player'}</div>
                  {a.ticker && <div className="text-[10px] text-muted-foreground">{a.ticker}</div>}
                  {a.value != null && (
                    <div className="text-[10px] tabular-nums text-muted-foreground">
                      {a.kind === 'most_balanced' || a.kind === 'boom_or_bust'
                        ? `σ ${Number(a.value).toFixed(2)}`
                        : `${Number(a.value) >= 0 ? '+' : ''}${Number(a.value).toFixed(2)}%`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-extrabold text-[13px] mb-2 px-1">Final Standings</h3>
        <LeaderboardList challengeId={challenge.id} currentUserId={user?.id} />
      </div>
    </div>
  );
}

/* ─── Admin tools ─── */
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
    <div className="glass-card p-4 border-amber-500/30" style={{ background: 'hsl(45 50% 8%)' }}>
      <h3 className="font-extrabold text-[13px] mb-2 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-gold" /> Admin Controls
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
      <p className="text-[10px] text-muted-foreground mt-2">
        Use only if a market-calendar edge case occurs or for testing.
      </p>
    </div>
  );
}

/* ─── Main page ─── */
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <Link to="/compete" className="page-header-icon active:scale-95 transition" aria-label="Back to Compete">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="page-header-title">Portfolio Wars</h1>
            <p className="page-header-subtitle">Weekly stock-picking challenge</p>
          </div>
          <button
            onClick={async () => {
              const url = 'https://dryhorse.app/portfolio-wars';
              const text = current
                ? `Portfolio Wars · Week ${current.week_number} on DH Club — pick 3 stocks, climb the leaderboard.`
                : 'Pick 3 stocks. Climb the leaderboard. Portfolio Wars on DH Club.';
              if (navigator.share) {
                try { await navigator.share({ title: 'Portfolio Wars', text, url }); return; }
                catch { /* fall through to copy */ }
              }
              await copyShareTextWithLink(text, url);
            }}
            className="page-header-icon active:scale-95 transition"
            aria-label="Share Portfolio Wars"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        <Tabs defaultValue="lobby" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="lobby" className="text-[11px] font-bold">📊 Lobby</TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-[11px] font-bold">🏆 Standings</TabsTrigger>
            <TabsTrigger value="history" className="text-[11px] font-bold">📚 History</TabsTrigger>
          </TabsList>

          <TabsContent value="lobby" className="space-y-3">
            {isLoading ? (
              <div className="glass-card p-6 text-center text-muted-foreground text-[12px]">Loading…</div>
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
                <div className="text-[11px] text-muted-foreground px-1">
                  Week of {format(new Date(current.week_start), 'MMM d')} · {STATUS_LABEL[current.status]}
                </div>
                <LeaderboardList challengeId={current.id} currentUserId={user?.id} />
              </>
            ) : (
              <div className="glass-card p-6 text-center text-[12px] text-muted-foreground">No active challenge.</div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {completed.length === 0 ? (
              <div className="glass-card p-6 text-center text-[12px] text-muted-foreground">
                No completed weeks yet.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {completed.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setHistoryId(c.id)}
                      className="w-full glass-card p-3 flex items-center gap-3 text-left active:scale-[0.99] transition"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-extrabold">
                          Week {c.week_number} · {format(new Date(c.week_start), 'MMM d')}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{format(new Date(c.week_end), 'EEE MMM d, yyyy')}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </button>
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
                          <p className="text-[11px] text-muted-foreground">
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
