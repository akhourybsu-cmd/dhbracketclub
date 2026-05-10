// Nexus Defense — Continue Run Banner
//
// Scans localStorage for an in-flight battle (saved by battlePersist) and,
// if one is found, surfaces a prominent "Resume" card on the Nexus hub.
// Pure UI surface — the actual resume logic lives in NexusBattlePage which
// already reads the persisted state when the route is opened.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlayCircle, Trash2, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useResolvedMissions } from '@/hooks/useMissionCalibrations';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';
import { clearBattle } from '@/lib/nexus/battlePersist';
import type { PersistedRun } from '@/lib/nexus/battlePersist';

const STORAGE_PREFIX = 'nexus_run_state_v1';

interface ResumeCandidate {
  missionId: number;
  missionName: string;
  isEndless: boolean;
  waveIndex: number;
  totalWaves: number;
  baseHp: number;
  baseHpMax: number;
  savedAt: number;
}

export function ContinueRunBanner() {
  const { user } = useAuth();
  const { missions } = useResolvedMissions();
  const [candidate, setCandidate] = useState<ResumeCandidate | null>(null);
  const [version, setVersion] = useState(0); // bump to force re-scan after dismiss

  const userKey = user?.id ?? 'anon';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let best: { c: ResumeCandidate; key: string } | null = null;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith(`${STORAGE_PREFIX}:${userKey}:`)) continue;
      try {
        const raw = window.localStorage.getItem(k);
        if (!raw) continue;
        const run = JSON.parse(raw) as PersistedRun;
        if (!run?.state || run.state.status === 'victory' || run.state.status === 'defeat') continue;
        const mission = missions.find(m => m.id === run.missionId);
        const c: ResumeCandidate = {
          missionId: run.missionId,
          missionName: mission?.name ?? (run.missionId === ENDLESS_MISSION_ID ? 'Endless Defense' : `Mission ${run.missionId}`),
          isEndless: run.missionId === ENDLESS_MISSION_ID,
          waveIndex: run.state.waveIndex,
          totalWaves: run.state.totalWaves,
          baseHp: run.state.baseHp,
          baseHpMax: run.state.baseHpMax,
          savedAt: run.savedAt,
        };
        if (!best || c.savedAt > best.c.savedAt) best = { c, key: k };
      } catch {
        // ignore corrupted entries
      }
    }
    setCandidate(best?.c ?? null);
  }, [userKey, missions, version]);

  const wavesLabel = useMemo(() => {
    if (!candidate) return '';
    if (candidate.isEndless) return `Wave ${Math.max(1, candidate.waveIndex + 1)}`;
    return `Wave ${Math.max(1, candidate.waveIndex + 1)} of ${Math.max(candidate.totalWaves, 1)}`;
  }, [candidate]);

  if (!candidate) return null;

  const hpPct = Math.max(0, Math.min(100, Math.round((candidate.baseHp / Math.max(1, candidate.baseHpMax)) * 100)));
  const accent = candidate.isEndless ? 'hsl(var(--nx-amber))' : 'hsl(150 80% 60%)';

  const handleDiscard = () => {
    clearBattle(user?.id ?? null, candidate.missionId);
    setVersion(v => v + 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative nx-clip-sm overflow-hidden mb-3"
      style={{
        background: 'linear-gradient(180deg, hsl(150 35% 12%), hsl(150 50% 6%))',
        border: `1px solid ${accent.replace(')', ' / 0.55)')}`,
        boxShadow: `0 0 16px -4px ${accent.replace(')', ' / 0.45)')}`,
      }}
    >
      {/* sweep highlight */}
      <motion.div
        aria-hidden
        className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${accent.replace(')', ' / 0.18)')}, transparent)` }}
        initial={{ x: '0%' }}
        animate={{ x: '420%' }}
        transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.6 }}
      />
      <div className="relative p-3 flex items-center gap-3">
        <Link
          to={`/nexus/battle/${candidate.missionId}`}
          className="flex items-center gap-3 flex-1 min-w-0 active:scale-[0.99] transition"
        >
          <div
            className="w-10 h-10 nx-clip-sm flex items-center justify-center flex-shrink-0"
            style={{
              background: accent.replace(')', ' / 0.18)'),
              border: `1.5px solid ${accent}`,
              color: accent,
            }}
          >
            <PlayCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="nx-pulse-dot inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
              />
              <p className="nx-title text-[9px]" style={{ color: accent, letterSpacing: '0.22em' }}>
                MISSION IN PROGRESS · TAP TO RESUME
              </p>
            </div>
            <p className="text-[12px] font-black truncate text-foreground">{candidate.missionName}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-foreground/70 font-bold tabular-nums">{wavesLabel}</span>
              <span className="w-0.5 h-0.5 rounded-full bg-foreground/25" />
              <span className="text-[10px] text-foreground/70 font-bold tabular-nums">
                HP {hpPct}%
              </span>
            </div>
            {/* HP bar */}
            <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'hsl(0 0% 100% / 0.08)' }}>
              <div
                className="h-full"
                style={{
                  width: `${hpPct}%`,
                  background: hpPct > 40
                    ? 'linear-gradient(90deg, hsl(150 80% 55%), hsl(188 92% 60%))'
                    : 'linear-gradient(90deg, hsl(15 90% 60%), hsl(350 85% 62%))',
                  boxShadow: hpPct > 40 ? '0 0 6px hsl(150 80% 55% / 0.45)' : '0 0 6px hsl(350 85% 62% / 0.55)',
                }}
              />
            </div>
          </div>
          <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
        </Link>

        <button
          type="button"
          onClick={handleDiscard}
          aria-label="Discard saved run"
          className="flex-shrink-0 w-8 h-8 nx-clip-sm flex items-center justify-center text-foreground/50 hover:text-rose-300 active:scale-90 transition"
          style={{ background: 'hsl(0 0% 100% / 0.04)', border: '1px solid hsl(0 0% 100% / 0.1)' }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
