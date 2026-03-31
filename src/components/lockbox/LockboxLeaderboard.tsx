import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Swords, Shield, Unlock, Lock, ChevronDown, Zap } from 'lucide-react';
import { getDefensePoints, getEfficiencyBonus, BEST_CRACK_BONUS, sortCracksForBest, BASE_CRACK_POINTS } from '@/lib/lockboxScoring';

interface ComputedPlayer {
  userId: string;
  name: string;
  avatar: string | null;
  crackPts: number;
  defensePts: number;
  locksCracked: number;
  totalPts: number;
  avgAttempts: number;
}

interface Props {
  computed: ComputedPlayer[];
  formalScores: any[];
  locks: any[];
  attempts: any[];
  weekLabel: string;
  weekId: string | undefined;
}

function LockResultDetail({ lock, attempts }: { lock: any; attempts: any[] }) {
  const lockAttempts = attempts
    .filter((a: any) => a.lock_id === lock.id)
    .sort((a: any, b: any) => {
      if (a.is_solved !== b.is_solved) return a.is_solved ? -1 : 1;
      return (a.total_attempts || 999) - (b.total_attempts || 999);
    });

  const solvedCount = lockAttempts.filter((a: any) => a.is_solved).length;
  const solvedAttempts = lockAttempts.filter((a: any) => a.is_solved);
  const bestSorted = sortCracksForBest(solvedAttempts);
  const best = bestSorted[0] || null;
  const bestAttempts = best?.total_attempts ?? null;

  // Compute defense points for display
  const defPts = getDefensePoints(lock.is_cracked, bestAttempts);

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="mt-2 pl-3 border-l-2 border-primary/20 space-y-1.5">
      <div className="flex gap-3 text-[10px] text-muted-foreground mb-1">
        <span>{solvedCount} cracked</span>
        <span>{lockAttempts.length} attempted</span>
        {best && <span className="text-primary font-bold flex items-center gap-0.5"><Zap className="w-3 h-3" /> Best: {best.total_attempts} tries</span>}
      </div>
      {lockAttempts.slice(0, 5).map((a: any, i: number) => {
        const isBest = best && a.id === best.id;
        const effBonus = a.is_solved ? getEfficiencyBonus(a.total_attempts) : 0;
        const pts = a.is_solved ? BASE_CRACK_POINTS + effBonus + (isBest ? BEST_CRACK_BONUS : 0) : 0;
        return (
          <div key={a.id} className="flex items-center gap-2 text-[11px]">
            {isBest && <span className="text-[9px]">👑</span>}
            <span className="font-bold truncate flex-1">{a.profiles?.display_name || 'Player'}</span>
            {a.is_solved ? (
              <span className="text-primary font-bold">{a.total_attempts} tries · {pts} pts ✓</span>
            ) : (
              <span className="text-muted-foreground capitalize">{a.phase} phase · {a.total_attempts}</span>
            )}
          </div>
        );
      })}
      {!lock.is_cracked ? (
        <div className="text-[10px] font-bold text-primary flex items-center gap-1 mt-1">
          <Shield className="w-3 h-3" /> Uncracked — +{defPts} defense pts
        </div>
      ) : defPts > 0 ? (
        <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mt-1">
          <Shield className="w-3 h-3" /> Defense — +{defPts} pts (best crack: {bestAttempts})
        </div>
      ) : null}
    </motion.div>
  );
}

export function LockboxLeaderboard({ computed, formalScores, locks, attempts, weekLabel, weekId }: Props) {
  const [expandedLock, setExpandedLock] = useState<string | null>(null);
  const [showLockResults, setShowLockResults] = useState(false);

  const hasData = computed.length > 0 || formalScores.length > 0;

  const leaderboard = formalScores.length > 0
    ? formalScores.map((s: any, i: number) => ({
        userId: s.user_id, name: s.profiles?.display_name || 'Player',
        crackPts: s.crack_points, defensePts: s.defense_points,
        totalPts: s.total_points, locksCracked: 0, avgAttempts: 0,
        rank: s.rank || i + 1,
      }))
    : computed.map((p, i) => ({ ...p, rank: i + 1 }));

  if (!hasData) {
    return (
      <div className="glass-card p-8 text-center">
        <Trophy className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
        <h3 className="font-bold text-sm mb-1">No Activity Yet</h3>
        <p className="text-[11px] text-muted-foreground">Create your lock and start cracking to see standings</p>
      </div>
    );
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-4">
      {/* Podium */}
      {leaderboard.length >= 3 && (
        <div className="glass-card p-4 border border-primary/10">
          <div className="text-[10px] font-bold text-muted-foreground/60 mb-3 tracking-wider">{weekLabel.toUpperCase()} PODIUM</div>
          <div className="flex items-end justify-center gap-2">
            {/* 2nd */}
            <div className="text-center flex-1">
              <div className="text-2xl mb-1">🥈</div>
              <div className="bg-muted/20 rounded-xl p-2 h-16 flex flex-col justify-end">
                <div className="text-[11px] font-bold truncate">{leaderboard[1]?.name}</div>
                <div className="text-[10px] text-primary font-bold">{leaderboard[1]?.totalPts} pts</div>
              </div>
            </div>
            {/* 1st */}
            <div className="text-center flex-1">
              <div className="text-3xl mb-1">🥇</div>
              <div className="bg-primary/10 rounded-xl p-2 h-20 flex flex-col justify-end border border-primary/20">
                <div className="text-[12px] font-black truncate">{leaderboard[0]?.name}</div>
                <div className="text-sm text-primary font-black">{leaderboard[0]?.totalPts} pts</div>
              </div>
            </div>
            {/* 3rd */}
            <div className="text-center flex-1">
              <div className="text-2xl mb-1">🥉</div>
              <div className="bg-muted/20 rounded-xl p-2 h-14 flex flex-col justify-end">
                <div className="text-[11px] font-bold truncate">{leaderboard[2]?.name}</div>
                <div className="text-[10px] text-primary font-bold">{leaderboard[2]?.totalPts} pts</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full rankings */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold text-muted-foreground/60 tracking-wider">STANDINGS</div>
        {leaderboard.map((p: any, i: number) => (
          <motion.div key={p.userId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className={`glass-card p-3.5 flex items-center gap-3 ${i === 0 ? 'border border-primary/15' : ''}`}>
            <div className="w-8 text-center font-bold text-sm">
              {i < 3 ? medals[i] : <span className="text-muted-foreground">#{i + 1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] truncate">{p.name}</div>
              <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                <span className="inline-flex items-center gap-0.5"><Swords className="w-3 h-3" /> {p.crackPts}</span>
                <span className="inline-flex items-center gap-0.5"><Shield className="w-3 h-3" /> {p.defensePts}</span>
                {p.locksCracked > 0 && <span className="inline-flex items-center gap-0.5"><Unlock className="w-3 h-3" /> {p.locksCracked}</span>}
                {p.avgAttempts > 0 && <span>avg {p.avgAttempts}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-lg">{p.totalPts}</div>
              <div className="text-[9px] text-muted-foreground">pts</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Lock Results */}
      {locks.length > 0 && (
        <div>
          <button onClick={() => setShowLockResults(!showLockResults)}
            className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 tracking-wider mb-2 hover:text-muted-foreground transition-colors">
            LOCK RESULTS <ChevronDown className={`w-3 h-3 transition-transform ${showLockResults ? 'rotate-180' : ''}`} />
          </button>
          {showLockResults && (
            <div className="space-y-1.5">
              {locks.map((lock: any) => (
                <div key={lock.id}>
                  <button onClick={() => setExpandedLock(expandedLock === lock.id ? null : lock.id)}
                    className="w-full glass-card p-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${lock.is_cracked ? 'bg-destructive/12' : 'bg-primary/12'}`}>
                      {lock.is_cracked ? <Unlock className="w-4 h-4 text-destructive" /> : <Lock className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[12px] truncate">{lock.profiles?.display_name || 'Player'}</div>
                      <div className="text-[10px] text-muted-foreground">{lock.is_cracked ? 'Cracked' : 'Defended 🛡️'}</div>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/40 transition-transform ${expandedLock === lock.id ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedLock === lock.id && <LockResultDetail lock={lock} attempts={attempts} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
