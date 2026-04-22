import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { RuneFx } from '@/hooks/useFxQueue';
import {
  KatanaBlade,
  ImpactStar,
  HeaterShield,
  HexNode,
  VineLeaf,
  Kanji,
  RuneCircle,
} from './FxIcons';

interface Props {
  fx: RuneFx;
  containerRect: DOMRect;
  onDone: () => void;
}

/**
 * Per-rune chain overlay FX. Each rune has a *signature* visual identity —
 * blades for red, vine spiral for green, shield-forge for gold, hex resonance
 * for blue. Pure transform/opacity — GPU-composited.
 */
export function RuneChainFx({ fx, containerRect, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [onDone]);

  const target = fx.target;
  const tx = target ? target.x + target.w / 2 - containerRect.left : containerRect.width / 2;
  const ty = target ? target.y + target.h / 2 - containerRect.top : containerRect.height / 2;

  const goldTrail = fx.tier !== 'normal';
  const fullBloom = fx.tier === 'huge';

  return (
    <>
      {/* "BONUS" floating chip — chain ≥7 */}
      {fx.length >= 7 && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: -36, scale: 1.15 }}
          transition={{ duration: 0.85, ease: 'easeOut' }}
          className="absolute pointer-events-none text-[11px] font-extrabold rd-fx-bonus-chip"
          style={{
            left: tx,
            top: ty - 24,
            transform: 'translate(-50%, -50%)',
            color: 'hsl(var(--gold))',
            textShadow: '0 0 12px hsl(var(--gold) / 0.9)',
            letterSpacing: '0.05em',
          }}
        >
          ✨ BONUS x{fx.length}
        </motion.div>
      )}

      {/* Chain ≥8 — vignette flash + screen-wide gold bloom */}
      {fullBloom && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0] }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, transparent 30%, hsl(0 0% 100% / 0.5) 100%)',
              mixBlendMode: 'screen',
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.6, 0], scale: 1.5 }}
            transition={{ duration: 0.75, ease: 'easeOut', delay: 0.05 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, hsl(var(--gold) / 0.6), transparent 60%)',
              mixBlendMode: 'screen',
            }}
          />
        </>
      )}

      {fx.rune === 'red' && <BladeStorm tx={tx} ty={ty} goldTrail={goldTrail} containerRect={containerRect} />}
      {fx.rune === 'green' && <LifebloomSpiral tx={tx} ty={ty} containerRect={containerRect} goldTrail={goldTrail} />}
      {fx.rune === 'gold' && <AegisForge tx={tx} ty={ty} containerRect={containerRect} goldTrail={goldTrail} />}
      {fx.rune === 'blue' && <AetherResonance tx={tx} ty={ty} containerRect={containerRect} goldTrail={goldTrail} />}
    </>
  );
}

/* ─── Red — Blade Storm ────────────────────────────────────────────── */
function BladeStorm({ tx, ty, goldTrail, containerRect }: { tx: number; ty: number; goldTrail: boolean; containerRect: DOMRect }) {
  const color = goldTrail ? 'hsl(var(--gold))' : 'hsl(var(--destructive))';
  const W = containerRect.width;
  // Three blade trajectories: from top-left, right, bottom-left
  const blades = [
    { fromX: -W * 0.5, fromY: -120, rot: 30 },
    { fromX: W * 0.5, fromY: -20, rot: 180 },
    { fromX: -W * 0.5, fromY: 80, rot: -20 },
  ];
  return (
    <>
      {blades.map((b, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: b.fromX, y: b.fromY, rotate: b.rot, scale: 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], x: 0, y: 0, rotate: b.rot, scale: 1.05 }}
          transition={{ duration: 0.42, delay: i * 0.08, ease: [0.4, 0.0, 0.2, 1] }}
          className="absolute pointer-events-none"
          style={{ left: tx, top: ty, transform: 'translate(-50%, -50%)', color }}
        >
          <KatanaBlade size={110} color={color} />
        </motion.div>
      ))}

      {/* Impact star — fires on the 3rd blade */}
      <motion.div
        initial={{ opacity: 0, scale: 0.2, rotate: 0 }}
        animate={{ opacity: [0, 1, 0], scale: [0.2, 1.4, 1.7], rotate: 22 }}
        transition={{ duration: 0.5, delay: 0.18, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{ left: tx, top: ty, transform: 'translate(-50%, -50%)', color }}
      >
        <ImpactStar size={84} color="hsl(0 0% 100%)" />
      </motion.div>

      {/* Red ember rise */}
      {[0, 1, 2, 3, 4].map(i => {
        const a = -Math.PI / 2 + (i - 2) * 0.35;
        const dist = 30 + (i % 2) * 14;
        return (
          <motion.span
            key={`e${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0], x: Math.cos(a) * dist, y: Math.sin(a) * dist - 18, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.25 + i * 0.04, ease: 'easeOut' }}
            className="absolute pointer-events-none"
            style={{
              left: tx,
              top: ty,
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 8px ${color}`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}

      {/* Gold-tier kanji flash */}
      {goldTrail && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
          animate={{ opacity: [0, 0.95, 0], scale: 1.15, rotate: 0 }}
          transition={{ duration: 0.42, delay: 0.22, ease: 'easeOut' }}
          className="absolute pointer-events-none"
          style={{ left: tx, top: ty, transform: 'translate(-50%, -50%)', color: 'hsl(var(--gold))' }}
        >
          <Kanji size={56} color="hsl(var(--gold))" />
        </motion.div>
      )}
    </>
  );
}

/* ─── Green — Lifebloom Spiral ─────────────────────────────────────── */
function LifebloomSpiral({ tx, ty, containerRect, goldTrail }: { tx: number; ty: number; containerRect: DOMRect; goldTrail: boolean }) {
  const color = goldTrail ? 'hsl(var(--gold))' : 'hsl(var(--success))';
  // Spiral path: start near board center bottom, curl toward HP bar (tx, ty)
  const startX = containerRect.width / 2;
  const startY = containerRect.height * 0.7;
  const ctrl1X = startX - 40;
  const ctrl1Y = (startY + ty) / 2 + 20;
  const ctrl2X = tx + 30;
  const ctrl2Y = (startY + ty) / 2 - 10;
  const path = `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${tx} ${ty}`;

  return (
    <>
      {/* Vine path draws in */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={containerRect.width}
        height={containerRect.height}
        style={{ overflow: 'visible' }}
      >
        <motion.path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0.6, 0] }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>

      {/* 3 leaves bloom along the path */}
      {[0, 1, 2].map(i => {
        const t = 0.25 + i * 0.3;
        const x = startX + (tx - startX) * t + Math.sin(t * Math.PI * 2) * 18;
        const y = startY + (ty - startY) * t;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.3, x, y: y + 10, rotate: -20 + i * 30 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.1, 1], x, y: y - 30, rotate: 20 + i * 30 }}
            transition={{ duration: 0.85, delay: 0.15 + i * 0.12, ease: 'easeOut' }}
            className="absolute pointer-events-none"
            style={{ left: 0, top: 0, transform: 'translate(-50%, -50%)' }}
          >
            <VineLeaf size={18} color={color} />
          </motion.div>
        );
      })}

      {/* HP arrival pulse */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.85, 0], scale: 1.6 }}
        transition={{ duration: 0.55, delay: 0.55, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: tx,
          top: ty,
          width: 70,
          height: 70,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}

/* ─── Gold — Aegis Forge ───────────────────────────────────────────── */
function AegisForge({ tx, ty, containerRect, goldTrail }: { tx: number; ty: number; containerRect: DOMRect; goldTrail: boolean }) {
  const cx = containerRect.width / 2;
  const cy = Math.min(ty, containerRect.height / 2);
  const color = 'hsl(var(--gold))';
  return (
    <>
      {/* Left half slides in */}
      <motion.div
        initial={{ opacity: 0, x: -160, rotate: -20 }}
        animate={{ opacity: [0, 1, 1, 0], x: -16, rotate: 0 }}
        transition={{ duration: 0.55, ease: [0.5, 0, 0.3, 1] }}
        className="absolute pointer-events-none"
        style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)', color, filter: `drop-shadow(0 0 10px ${color})` }}
      >
        <HeaterShield size={56} color={color} doubleRim={goldTrail} />
      </motion.div>
      {/* Right half (mirrored) slides in */}
      <motion.div
        initial={{ opacity: 0, x: 160, rotate: 20 }}
        animate={{ opacity: [0, 1, 1, 0], x: 16, rotate: 0 }}
        transition={{ duration: 0.55, ease: [0.5, 0, 0.3, 1] }}
        className="absolute pointer-events-none"
        style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)', color, filter: `drop-shadow(0 0 10px ${color})` }}
      >
        <HeaterShield size={56} color={color} mirror doubleRim={goldTrail} />
      </motion.div>

      {/* Hammer-strike sparkscape — 12 radial sparks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (Math.PI * 2 * i) / 12;
        const dist = 70;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4, rotate: (a * 180) / Math.PI }}
            animate={{ opacity: [0, 1, 0], x: Math.cos(a) * dist, y: Math.sin(a) * dist, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.42, ease: 'easeOut' }}
            className="absolute pointer-events-none"
            style={{
              left: cx,
              top: cy,
              width: 3,
              height: 14,
              borderRadius: 2,
              background: 'linear-gradient(180deg, white, hsl(var(--gold)))',
              boxShadow: `0 0 8px ${color}`,
              transform: `translate(-50%, -50%) rotate(${(a * 180) / Math.PI + 90}deg)`,
            }}
          />
        );
      })}

      {/* Runic ring orbits */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
        animate={{ opacity: [0, 0.95, 0.7, 0], scale: [0.6, 1.15, 0.4], rotate: 180 }}
        transition={{ duration: 0.75, delay: 0.4, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)', color }}
      >
        <RuneCircle size={100} color={color} />
      </motion.div>

      {/* Implosion ribbon to shield chip */}
      <motion.div
        initial={{ opacity: 0, scale: 1, x: 0, y: 0 }}
        animate={{ opacity: [0, 1, 0], scale: 0.2, x: tx - cx, y: ty - cy }}
        transition={{ duration: 0.5, delay: 0.55, ease: 'easeIn' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}, transparent 70%)`,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}

/* ─── Blue — Aether Resonance ──────────────────────────────────────── */
function AetherResonance({ tx, ty, containerRect, goldTrail }: { tx: number; ty: number; containerRect: DOMRect; goldTrail: boolean }) {
  const color = goldTrail ? 'hsl(var(--gold))' : 'hsl(215 75% 60%)';
  const ribbonColor = goldTrail ? 'hsl(var(--gold))' : 'hsl(215 90% 75%)';
  const cx = containerRect.width / 2;
  const cy = containerRect.height * 0.55;

  // 6 hex nodes arranged on a circle
  const nodes = Array.from({ length: 6 }).map((_, i) => {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return { x: cx + Math.cos(a) * 56, y: cy + Math.sin(a) * 56 };
  });

  // Polyline forming the magic circle
  const polyPoints = [...nodes, nodes[0]].map(n => `${n.x},${n.y}`).join(' ');

  return (
    <>
      {/* Hex nodes resonate (rise + offset bob) */}
      {nodes.map((n, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: n.x, y: n.y + 12, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], x: n.x, y: n.y, scale: [0.6, 1, 0.95, 1.1] }}
          transition={{ duration: 0.7, delay: i * 0.04, ease: 'easeOut', times: [0, 0.3, 0.6, 1] }}
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0, transform: 'translate(-50%, -50%)' }}
        >
          <HexNode size={20} color={color} />
        </motion.div>
      ))}

      {/* Lightning lines connecting them */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={containerRect.width}
        height={containerRect.height}
        style={{ overflow: 'visible' }}
      >
        <motion.polyline
          points={polyPoints}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0.7, 0] }}
          transition={{ duration: 0.55, delay: 0.2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>

      {/* Central orb collapses */}
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 1, 0], scale: [0.2, 1.2, 0.4] }}
        transition={{ duration: 0.45, delay: 0.5, ease: 'easeIn' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: `radial-gradient(circle, white, ${color})`,
          boxShadow: `0 0 20px ${color}`,
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Ribbon to mana pip */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: [0, 1, 0], scaleX: 1 }}
        transition={{ duration: 0.4, delay: 0.65, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: Math.hypot(tx - cx, ty - cy),
          height: 3,
          background: `linear-gradient(90deg, ${ribbonColor}, transparent)`,
          boxShadow: `0 0 10px ${ribbonColor}`,
          transformOrigin: 'left center',
          transform: `translate(0, -50%) rotate(${Math.atan2(ty - cy, tx - cx)}rad)`,
          borderRadius: 2,
        }}
      />

      {/* Mana pip ring expansion */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 0], scale: 2 }}
        transition={{ duration: 0.4, delay: 0.75, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: tx,
          top: ty,
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: `2px solid ${ribbonColor}`,
          boxShadow: `0 0 12px ${ribbonColor}`,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </>
  );
}
