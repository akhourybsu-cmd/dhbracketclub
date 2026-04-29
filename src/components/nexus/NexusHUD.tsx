import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Trophy, Cpu, Users } from 'lucide-react';
import { useNexusProgress } from '@/hooks/useNexusProgress';
import { useActiveOperation } from '@/hooks/useNexusOperation';
import { NexusExitDialog } from './NexusExitDialog';
import nexusEmblem from '@/assets/nexus-emblem.png';

/**
 * In-game HUD for Nexus Defense. Replaces the DH page header while inside
 * the /nexus/* shell. Hidden during the active battle screen — that screen
 * owns its own immersive header.
 */
export function NexusHUD() {
  const location = useLocation();
  const navigate = useNavigate();
  const { progress } = useNexusProgress();
  const [exitOpen, setExitOpen] = useState(false);

  // Battle screen owns its own header; don't double-stack.
  if (location.pathname.startsWith('/nexus/battle/')) return null;

  const isHub = location.pathname === '/nexus';
  const isOpHub = location.pathname.startsWith('/nexus/operation');
  const { operation } = useActiveOperation();
  const opActive = operation?.status === 'active';

  const handleBack = () => {
    if (isHub) {
      setExitOpen(true);
    } else {
      navigate('/nexus');
    }
  };

  // Compact contextual subtitle per route
  const subtitle = (() => {
    const p = location.pathname;
    if (p === '/nexus') return 'Outer Rim · Sector I';
    if (p.startsWith('/nexus/missions')) return 'Sector Map';
    if (p.startsWith('/nexus/loadout')) return 'Mission Loadout';
    if (p.startsWith('/nexus/results')) return 'Mission Debrief';
    if (p.startsWith('/nexus/leaderboard')) return 'Pilot Rankings';
    if (p.startsWith('/nexus/codex')) return 'Tactical Codex';
    if (p.startsWith('/nexus/calibration')) return 'Calibration · Admin';
    if (p.startsWith('/nexus/balance')) return 'Telemetry · Admin';
    if (p.startsWith('/nexus/operation')) return 'Co-op Operation';
    return 'Nexus Defense';
  })();

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-xl"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background:
            'linear-gradient(180deg, hsl(var(--nx-panel) / 0.95), hsl(var(--nx-panel) / 0.78))',
          borderColor: 'hsl(var(--nx-panel-edge) / 0.55)',
          boxShadow:
            '0 1px 0 hsl(var(--nx-cyan) / 0.12), 0 6px 18px -10px hsl(var(--nx-cyan) / 0.35)',
        }}
      >
        <div className="flex items-center gap-2 h-12 px-2 max-w-[640px] mx-auto">
          <button
            onClick={handleBack}
            aria-label={isHub ? 'Exit Nexus Defense' : 'Back to Nexus hub'}
            className="w-11 h-11 rounded-xl flex items-center justify-center btn-press text-foreground/90 active:text-cyan-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Link to="/nexus" className="flex-1 min-w-0 flex items-center gap-2.5 btn-press">
            <span
              className="relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, hsl(var(--nx-cyan) / 0.35), hsl(var(--nx-indigo) / 0.18))',
                border: '1px solid hsl(var(--nx-cyan) / 0.45)',
                boxShadow: '0 0 12px hsl(var(--nx-cyan) / 0.35)',
              }}
            >
              <img
                src={nexusEmblem}
                alt=""
                className="w-5 h-5 object-contain"
                style={{ filter: 'drop-shadow(0 0 4px hsl(var(--nx-cyan) / 0.8))' }}
              />
            </span>
            <div className="flex-1 min-w-0 leading-tight">
              <p className="nx-title text-[12px] truncate" style={{ color: 'hsl(var(--nx-cyan))' }}>
                Nexus Defense
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/65 truncate">
                {subtitle}
              </p>
            </div>
          </Link>

          {/* Cores readout */}
          <div
            className="flex items-center gap-1 h-9 px-2.5 rounded-lg"
            style={{
              background: 'hsl(var(--nx-amber) / 0.12)',
              border: '1px solid hsl(var(--nx-amber) / 0.35)',
            }}
          >
            <Cpu className="w-3.5 h-3.5" style={{ color: 'hsl(var(--nx-amber))' }} />
            <span
              className="text-[11px] font-black tabular-nums"
              style={{ color: 'hsl(var(--nx-amber))' }}
            >
              {progress.cores}
            </span>
          </div>

          {!isHub && (
            <Link
              to="/nexus/leaderboard"
              aria-label="Leaderboard"
              className="w-9 h-9 rounded-lg flex items-center justify-center btn-press"
              style={{
                background: 'hsl(var(--nx-cyan) / 0.1)',
                border: '1px solid hsl(var(--nx-cyan) / 0.25)',
                color: 'hsl(var(--nx-cyan))',
              }}
            >
              <Trophy className="w-4 h-4" />
            </Link>
          )}
          {isHub && (
            <Link
              to="/nexus/codex"
              aria-label="Codex"
              className="w-9 h-9 rounded-lg flex items-center justify-center btn-press"
              style={{
                background: 'hsl(var(--nx-cyan) / 0.1)',
                border: '1px solid hsl(var(--nx-cyan) / 0.25)',
                color: 'hsl(var(--nx-cyan))',
              }}
            >
              <BookOpen className="w-4 h-4" />
            </Link>
          )}
        </div>
      </header>

      <NexusExitDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        onConfirm={() => {
          setExitOpen(false);
          navigate('/compete');
        }}
      />
    </>
  );
}
