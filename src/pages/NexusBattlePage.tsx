import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { castAbility, initBattle, placeTower, sellTower, startWave, tick, TICK_MS, upgradeTower } from '@/lib/nexus/engine';
import { AbilityKind, BattleState, TowerKind } from '@/lib/nexus/types';
import { NexusBattleScreen } from '@/components/nexus/NexusBattleScreen';
import { useAuth } from '@/contexts/AuthContext';
import { recordNexusRun, useNexusProgress } from '@/hooks/useNexusProgress';
import { useResolvedMission } from '@/hooks/useMissionCalibrations';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function NexusBattlePage() {
  const { missionId } = useParams<{ missionId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { progress, updateProgress } = useNexusProgress();

  const id = parseInt(missionId || '1', 10);
  const { mission, enemyMods, loading: calLoading } = useResolvedMission(id);

  const abilities = useMemo<AbilityKind[]>(() => {
    const raw = params.get('abilities');
    if (!raw) return ['orbital', 'emp'];
    return raw.split(',').filter(Boolean) as AbilityKind[];
  }, [params]);

  const [state, setState] = useState<BattleState | null>(null);
  // Initialise battle once mission is resolved.
  useEffect(() => {
    if (!mission || state) return;
    setState(initBattle(mission.id, abilities, {
      mission,
      enemyHpMult: enemyMods.hpMult,
      enemyShieldMult: enemyMods.shieldMult,
      enemySpeedMult: enemyMods.speedMult,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [selectedKind, setSelectedKind] = useState<TowerKind | null>(null);
  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const savedRef = useRef(false);

  // Game loop
  useEffect(() => {
    if (!mission) return;
    const interval = setInterval(() => {
      const cur = stateRef.current;
      if (!cur || cur.status === 'victory' || cur.status === 'defeat' || paused || exitOpen) return;
      const next = tick(cur, mission);
      stateRef.current = next;
      setState(next);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [mission, paused, exitOpen]);

  // End-of-run handling
  useEffect(() => {
    if (!state || !mission || savedRef.current) return;
    if (state.status === 'victory' || state.status === 'defeat') {
      savedRef.current = true;
      const won = state.status === 'victory';
      const cores = won ? mission.rewardCores : Math.round(mission.rewardCores * 0.2);
      const newProgress: Partial<typeof progress> = {
        cores: progress.cores + cores,
      };
      if (won && mission.id >= progress.highest_mission) {
        newProgress.highest_mission = Math.min(mission.id + 1, 6);
      }
      updateProgress(newProgress);
      if (user) {
        recordNexusRun({
          userId: user.id,
          missionId: mission.id,
          victory: won,
          score: state.score,
          wavesCleared: won ? mission.waves.length : Math.max(0, state.waveIndex),
          baseHpRemaining: state.baseHp,
          durationSeconds: Math.round(state.elapsedMs / 1000),
          loadout: { towers: ['pulse','arc','cryo','rail'], abilities },
          failedWave: won ? null : state.waveIndex + 1,
          towerUsage: state.towerBuilds,
          towerUpgrades: state.towerUpgrades,
          towerSells: state.towerSells,
          abilityUsage: state.abilityUses,
          energyStarvedMs: state.energyStarvedMs,
          leaks: state.leaks,
        }).catch(() => {});
      }
      // Stash run insight for the results page (avoids URL bloat).
      try {
        sessionStorage.setItem(`nexus_run_${mission.id}`, JSON.stringify({
          towerBuilds: state.towerBuilds,
          towerUpgrades: state.towerUpgrades,
          towerSells: state.towerSells,
          abilityUses: state.abilityUses,
          energyStarvedMs: state.energyStarvedMs,
          leaks: state.leaks,
          durationSeconds: Math.round(state.elapsedMs / 1000),
        }));
      } catch {}
      const t = setTimeout(() => {
        navigate(`/nexus/results/${mission.id}?win=${won ? 1 : 0}&score=${state.score}&hp=${state.baseHp}&waves=${won ? mission.waves.length : Math.max(0, state.waveIndex)}&cores=${cores}`);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [state?.status, mission, navigate, progress, updateProgress, user, abilities, state]);

  if (calLoading || !mission) {
    return <div className="p-6 text-center text-muted-foreground">{calLoading ? 'Loading mission…' : 'Mission not found.'}</div>;
  }
  if (!state) return <div className="p-6 text-center text-muted-foreground">Preparing battle…</div>;

  const handlePlace = (col: number, row: number) => {
    if (!selectedKind) return;
    const res = placeTower(state, selectedKind, col, row);
    if (!res.ok) {
      if (res.reason) toast.error(res.reason);
      return;
    }
    setState(res.state);
  };
  const handleUpgrade = (towerId: string) => {
    const res = upgradeTower(state, towerId);
    if (!res.ok) { if (res.reason) toast.error(res.reason); return; }
    setState(res.state);
  };
  const handleSell = (towerId: string) => {
    setState(sellTower(state, towerId));
    setSelectedTowerId(null);
  };
  const handleAbility = (kind: AbilityKind) => {
    const res = castAbility(state, kind);
    if (res.ok) setState(res.state);
  };
  const handleStartWave = () => {
    setState(startWave(state, mission));
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-30">
      {/* Mission header — bracketed command frame */}
      <div
        className="relative px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2"
        style={{
          background:
            'linear-gradient(180deg, hsl(218 60% 6% / 0.92), hsl(218 50% 4% / 0.4))',
        }}
      >
        <div className="flex items-stretch gap-2">
          {/* Left bracket: emblem / exit */}
          <button
            onClick={() => {
              if (state.status === 'victory' || state.status === 'defeat' || state.status === 'pre') {
                navigate('/nexus');
              } else {
                setExitOpen(true);
              }
            }}
            aria-label="Exit mission"
            className="relative w-12 h-12 nx-clip-sm flex items-center justify-center active:scale-95 transition"
            style={{
              background: 'linear-gradient(180deg, hsl(218 50% 11%), hsl(218 55% 7%))',
              border: '1px solid hsl(var(--nx-cyan) / 0.55)',
              boxShadow:
                '0 0 12px -2px hsl(var(--nx-cyan) / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.08)',
              color: 'hsl(var(--nx-cyan))',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 0 4px hsl(var(--nx-cyan)))' }}>
              <path d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z" stroke="currentColor" strokeWidth="1.6" />
              <path d="M9 9 L15 9 L15 15 L9 15 Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.25" />
            </svg>
            <span aria-hidden className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-l border-t" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
            <span aria-hidden className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-r border-b" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
          </button>

          {/* Center frame: mission title */}
          <div
            className="relative flex-1 nx-clip-sm flex flex-col items-center justify-center px-3 py-1"
            style={{
              background:
                'linear-gradient(180deg, hsl(218 50% 9% / 0.95), hsl(218 55% 5% / 0.95))',
              border: '1px solid hsl(var(--nx-cyan) / 0.45)',
              boxShadow:
                '0 0 14px -2px hsl(var(--nx-cyan) / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.05)',
            }}
          >
            <span
              className="nx-title text-[9px] leading-none"
              style={{ color: 'hsl(var(--nx-cyan))', letterSpacing: '0.28em', textShadow: '0 0 6px hsl(var(--nx-cyan) / 0.6)' }}
            >
              MISSION {String(mission.id).padStart(2, '0')}
            </span>
            <span
              className="text-base font-black tracking-wide leading-tight mt-0.5 truncate"
              style={{ color: 'hsl(0 0% 98%)', letterSpacing: '0.06em', textShadow: '0 0 8px hsl(var(--nx-cyan) / 0.4)' }}
            >
              {mission.name.toUpperCase()}
            </span>
            <span aria-hidden className="absolute top-0.5 left-0.5 w-2 h-2 border-l border-t" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
            <span aria-hidden className="absolute top-0.5 right-0.5 w-2 h-2 border-r border-t" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
            <span aria-hidden className="absolute bottom-0.5 left-0.5 w-2 h-2 border-l border-b" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
            <span aria-hidden className="absolute bottom-0.5 right-0.5 w-2 h-2 border-r border-b" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
          </div>

          {/* Right bracket: pause */}
          <button
            onClick={() => setPaused(p => !p)}
            aria-label={paused ? 'Resume' : 'Pause'}
            className="relative w-12 h-12 nx-clip-sm flex items-center justify-center active:scale-95 transition"
            style={{
              background: 'linear-gradient(180deg, hsl(218 50% 11%), hsl(218 55% 7%))',
              border: '1px solid hsl(var(--nx-cyan) / 0.55)',
              boxShadow:
                '0 0 12px -2px hsl(var(--nx-cyan) / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.08)',
              color: 'hsl(var(--nx-cyan))',
            }}
          >
            {paused ? (
              <span className="text-base font-black" style={{ filter: 'drop-shadow(0 0 4px hsl(var(--nx-cyan)))' }}>▶</span>
            ) : (
              <div className="flex gap-[3px]">
                <span className="block w-[3px] h-4 rounded-sm" style={{ background: 'hsl(var(--nx-cyan))', boxShadow: '0 0 6px hsl(var(--nx-cyan))' }} />
                <span className="block w-[3px] h-4 rounded-sm" style={{ background: 'hsl(var(--nx-cyan))', boxShadow: '0 0 6px hsl(var(--nx-cyan))' }} />
              </div>
            )}
            <span aria-hidden className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-l border-t" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
            <span aria-hidden className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-r border-b" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <NexusBattleScreen
          state={state}
          selectedTowerKind={selectedKind}
          selectedTowerId={selectedTowerId}
          onSelectKind={setSelectedKind}
          onPlace={handlePlace}
          onSelectTower={setSelectedTowerId}
          onUpgrade={handleUpgrade}
          onSell={handleSell}
          onCastAbility={handleAbility}
          onStartWave={handleStartWave}
        />
      </div>

      {paused && (
        <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center">
            <div className="text-3xl font-black text-emerald-400 mb-3">PAUSED</div>
            <button onClick={() => setPaused(false)} className="px-6 py-2 rounded-full bg-emerald-500 text-emerald-950 font-bold">Resume</button>
          </motion.div>
        </div>
      )}

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent className="max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Abandon mission?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current run will end and progress for this attempt will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => navigate('/nexus')}
              className="bg-rose-500 text-rose-950 hover:bg-rose-400"
            >
              Abandon
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
