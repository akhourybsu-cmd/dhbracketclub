import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Shield, Trophy, Target, Users, Sparkles, Sliders, BarChart3, FlaskConical } from 'lucide-react';
import { useNexusProgress } from '@/hooks/useNexusProgress';
import { useResolvedMissions } from '@/hooks/useMissionCalibrations';
import { useActiveOperation } from '@/hooks/useNexusOperation';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function NexusHomePage() {
  const { progress } = useNexusProgress();
  const { missions } = useResolvedMissions();
  // Endless mission lives outside the campaign list; keep next-mission picker pure.
  const campaign = missions.filter(m => m.id !== ENDLESS_MISSION_ID);
  const nextMission = campaign.find(m => m.id === progress.highest_mission) ?? campaign[0];
  const cleared = Math.min(progress.highest_mission - 1, 6);
  const { operation } = useActiveOperation();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }: any) => setIsAdmin(!!data));
  }, [user]);

  return (
    <div className="max-w-md mx-auto pb-6">
      {/* ───── Command panel hero ───── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden mt-2 mb-4 nx-clip nx-bracket"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 25% 15%, hsl(188 70% 22% / 0.55), transparent 60%),' +
            'linear-gradient(160deg, hsl(218 50% 10%), hsl(220 60% 5%))',
          border: '1px solid hsl(var(--nx-cyan) / 0.4)',
          boxShadow:
            '0 0 24px -8px hsl(var(--nx-cyan) / 0.55), inset 0 1px 0 hsl(var(--nx-cyan) / 0.18)',
        }}
      >
        {/* Decorative grid */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--nx-cyan)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--nx-cyan)) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 70% 70% at 80% 50%, black, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 80% 50%, black, transparent 80%)',
          }}
        />
        {/* Glow halo */}
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full" style={{ background: 'hsl(188 92% 56% / 0.18)', filter: 'blur(40px)' }} />

        <div className="relative p-5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="nx-pulse-dot inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--nx-cyan))', boxShadow: '0 0 6px hsl(var(--nx-cyan))' }} />
            <p className="nx-title text-[9px]" style={{ color: 'hsl(var(--nx-cyan))' }}>OUTER RIM · SECTOR I</p>
          </div>
          <h1 className="text-3xl font-black text-foreground mb-1.5 tracking-tight">Nexus Defense</h1>
          <p className="text-xs text-foreground/65 mb-5 max-w-[280px] leading-relaxed">
            Defend the energy core. Engineer your grid. Survive the swarm.
          </p>

          {/* Mini stats — tactical readouts */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            <div className="nx-clip-sm px-2.5 py-2" style={{ background: 'hsl(218 35% 7%)', border: '1px solid hsl(var(--nx-amber) / 0.3)' }}>
              <div className="flex items-center justify-between">
                <span className="nx-title text-[8px]" style={{ color: 'hsl(var(--nx-amber) / 0.85)' }}>CORES</span>
                <span className="text-[9px]" style={{ color: 'hsl(var(--nx-amber))' }}>⚡</span>
              </div>
              <div className="text-base font-black tabular-nums leading-none mt-0.5" style={{ color: 'hsl(var(--nx-amber))' }}>{progress.cores}</div>
            </div>
            <div className="nx-clip-sm px-2.5 py-2" style={{ background: 'hsl(218 35% 7%)', border: '1px solid hsl(150 80% 60% / 0.3)' }}>
              <div className="flex items-center justify-between">
                <span className="nx-title text-[8px]" style={{ color: 'hsl(150 80% 70% / 0.85)' }}>CLEARED</span>
                <Trophy className="w-2.5 h-2.5" style={{ color: 'hsl(150 80% 70%)' }} />
              </div>
              <div className="text-base font-black tabular-nums leading-none mt-0.5" style={{ color: 'hsl(150 80% 70%)' }}>{cleared}/6</div>
            </div>
          </div>

          <Link
            to={`/nexus/loadout/${nextMission.id}`}
            className="block w-full text-center px-4 py-3 nx-clip-sm font-black text-sm active:scale-95 transition nx-title relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, hsl(150 80% 55%), hsl(150 80% 42%))',
              color: 'hsl(150 30% 8%)',
              boxShadow: '0 0 18px hsl(150 80% 55% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.35)',
            }}
          >
            ▶  DEPLOY · M{nextMission.id} {nextMission.name.toUpperCase()}
          </Link>
        </div>
      </motion.div>

      {operation ? (() => {
        // Surface the active co-op operation as a prominent card so the friend
        // group sees shared progress without digging into a sub-page.
        const targets = [operation.phase1_target, operation.phase2_target, operation.phase3_target];
        const progresses = [operation.phase1_progress, operation.phase2_progress, operation.phase3_progress];
        const phaseIdx = operation.current_phase - 1;
        const t = Math.max(1, targets[phaseIdx]);
        const pct = Math.min(100, Math.round((progresses[phaseIdx] / t) * 100));
        const phaseLabel = ['Phase 1 · Eliminate', 'Phase 2 · Score', 'Phase 3 · Siege Core'][phaseIdx];
        return (
          <Link
            to="/nexus/operation"
            className="block mb-3 nx-clip-sm p-3 active:scale-[0.98] transition"
            style={{
              background: 'linear-gradient(180deg, hsl(280 50% 14%), hsl(280 60% 8%))',
              border: '1px solid hsl(280 80% 65% / 0.45)',
              boxShadow: '0 0 16px -4px hsl(280 80% 60% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.06)',
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" style={{ color: 'hsl(280 90% 78%)' }} />
                <span className="nx-title text-[9px]" style={{ color: 'hsl(280 90% 78%)', letterSpacing: '0.22em' }}>
                  CO-OP OPERATION
                </span>
              </div>
              <span className="text-[9px] font-bold tabular-nums" style={{ color: 'hsl(280 90% 78%)' }}>
                {operation.total_contributors} ALLY{operation.total_contributors === 1 ? '' : 'IES'}
              </span>
            </div>
            <div className="text-sm font-black tracking-tight text-foreground truncate">{operation.name}</div>
            <div className="text-[10px] text-foreground/65 mt-0.5">{phaseLabel}</div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(280 30% 12%)' }}>
              <div className="h-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, hsl(280 90% 65%), hsl(320 90% 65%))' }} />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px]">
              <span className="text-foreground/60 tabular-nums">{progresses[phaseIdx].toLocaleString()} / {t.toLocaleString()}</span>
              <span className="font-black" style={{ color: 'hsl(280 90% 78%)' }}>OPEN HUB →</span>
            </div>
          </Link>
        );
      })() : (
        // Standby card — always visible so admins can start an op and players
        // know the mode exists even when nothing is currently running.
        <Link
          to="/nexus/operation"
          className="block mb-3 nx-clip-sm p-3 active:scale-[0.98] transition"
          style={{
            background: 'linear-gradient(180deg, hsl(280 25% 10%), hsl(280 35% 6%))',
            border: '1px dashed hsl(280 80% 65% / 0.4)',
            boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.04)',
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" style={{ color: 'hsl(280 70% 70% / 0.85)' }} />
              <span className="nx-title text-[9px]" style={{ color: 'hsl(280 70% 70% / 0.85)', letterSpacing: '0.22em' }}>
                CO-OP OPERATION · STANDBY
              </span>
            </div>
            <span className="text-[9px] font-bold" style={{ color: 'hsl(280 70% 70% / 0.7)' }}>OPEN →</span>
          </div>
          <div className="text-[11px] text-foreground/65 leading-snug">
            No active club operation. Open the hub to view past ops or start a new one.
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2 mb-2">
        <NavTile
          to="/nexus/operation"
          icon={<Users className="w-4 h-4" />}
          label="Co-op Op"
          accent="hsl(280 80% 65%)"
          borderColor="hsl(280 80% 65% / 0.35)"
        />
        <NavTile
          to={`/nexus/loadout/${ENDLESS_MISSION_ID}`}
          icon={<Target className="w-4 h-4" />}
          label="Endless"
          accent="hsl(var(--nx-amber))"
          borderColor="hsl(var(--nx-amber) / 0.3)"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <NavTile to="/nexus/missions" icon={<Target className="w-4 h-4" />} label="Sector Map" />
        <NavTile to="/nexus/leaderboard" icon={<Trophy className="w-4 h-4" />} label="Leaderboard" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NavTile
          to="/nexus/sigils"
          icon={<Sparkles className="w-4 h-4" />}
          label="Sigil Vault"
          accent="hsl(45 100% 70%)"
          borderColor="hsl(45 100% 60% / 0.35)"
        />
        <NavTile to="/nexus/codex" icon={<Shield className="w-4 h-4" />} label="Codex" />
      </div>
    </div>
  );
}

function NavTile({
  to,
  icon,
  label,
  accent = 'hsl(var(--nx-cyan))',
  borderColor = 'hsl(var(--nx-cyan) / 0.2)',
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  accent?: string;
  borderColor?: string;
}) {
  return (
    <Link
      to={to}
      className="aspect-square nx-clip-sm flex flex-col items-center justify-center gap-1.5 active:scale-95 transition"
      style={{
        background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
        border: `1px solid ${borderColor}`,
        boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.04)',
      }}
    >
      <span style={{ color: accent }}>{icon}</span>
      <span className="nx-title text-[9px]">{label}</span>
    </Link>
  );
}
