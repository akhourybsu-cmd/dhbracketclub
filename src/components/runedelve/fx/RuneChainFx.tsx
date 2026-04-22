import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { RuneFx } from '@/hooks/useFxQueue';

interface Props {
  fx: RuneFx;
  containerRect: DOMRect;
  onDone: () => void;
}

/**
 * Per-rune chain overlay FX. Renders thematic motion cues that briefly
 * appear above the board and fade. Pure visual, GPU-composited
 * (transform + opacity only).
 */
export function RuneChainFx({ fx, containerRect, onDone }: Props) {
  // Auto-clear after the longest sub-animation has played.
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [onDone]);

  const target = fx.target;
  const tx = target ? target.x + target.w / 2 - containerRect.left : containerRect.width / 2;
  const ty = target ? target.y + target.h / 2 - containerRect.top : containerRect.height / 2;

  // Tier flourish: gold trail for chain ≥6, full-board bloom for ≥8.
  const goldTrail = fx.tier !== 'normal';
  const fullBloom = fx.tier === 'huge';

  return (
    <>
      {/* Tier badge — floats up where the chain ended. */}
      {fx.length >= 7 && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: -32, scale: 1.1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute pointer-events-none text-[11px] font-extrabold rd-fx-bonus-chip"
          style={{
            left: tx,
            top: ty - 24,
            transform: 'translate(-50%, -50%)',
            color: 'hsl(var(--gold))',
            textShadow: '0 0 10px hsl(var(--gold) / 0.8)',
          }}
        >
          ✨ Chain x{fx.length}
        </motion.div>
      )}

      {/* Full-board gold bloom for chain ≥8. */}
      {fullBloom && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 0.55, 0], scale: 1.4 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, hsl(var(--gold) / 0.55), transparent 60%)',
            mixBlendMode: 'screen',
          }}
        />
      )}

      {fx.rune === 'red' && <RedSlash tx={tx} ty={ty} goldTrail={goldTrail} />}
      {fx.rune === 'green' && <GreenBloom tx={tx} ty={ty} containerRect={containerRect} goldTrail={goldTrail} />}
      {fx.rune === 'gold' && <GoldShieldLock tx={tx} ty={ty} containerRect={containerRect} goldTrail={goldTrail} />}
      {fx.rune === 'blue' && <BlueArcane tx={tx} ty={ty} containerRect={containerRect} goldTrail={goldTrail} />}
    </>
  );
}

/* ─── Red — Crimson Slash ──────────────────────────────────────────── */
function RedSlash({ tx, ty, goldTrail }: { tx: number; ty: number; goldTrail: boolean }) {
  const slashColor = goldTrail ? 'hsl(var(--gold))' : 'hsl(var(--destructive))';
  return (
    <>
      {/* Three staggered diagonal slashes */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scaleX: 0, rotate: -28 + i * 4 }}
          animate={{ opacity: [0, 1, 0], scaleX: [0, 1.2, 1.4] }}
          transition={{ duration: 0.36, delay: i * 0.06, ease: 'easeOut' }}
          className="absolute pointer-events-none"
          style={{
            left: tx,
            top: ty - 12 + i * 6,
            width: 92,
            height: 5,
            transform: 'translate(-50%, -50%)',
            background: `linear-gradient(90deg, transparent, ${slashColor}, transparent)`,
            boxShadow: `0 0 14px ${slashColor}`,
            borderRadius: 4,
            transformOrigin: 'left center',
          }}
        />
      ))}
      {/* Radial impact flash. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, 0.85, 0], scale: 1.6 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: tx,
          top: ty,
          width: 70,
          height: 70,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${slashColor} 0%, transparent 65%)`,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}

/* ─── Green — Verdant Bloom ────────────────────────────────────────── */
function GreenBloom({ tx, ty, containerRect, goldTrail }: { tx: number; ty: number; containerRect: DOMRect; goldTrail: boolean }) {
  const color = goldTrail ? 'hsl(var(--gold))' : 'hsl(var(--success))';
  const motes = 7;
  return (
    <>
      {/* Healing wind ribbon rising toward HP bar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4, y: 0 }}
        animate={{ opacity: [0, 0.8, 0], scale: 1.4, y: ty - 12 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: tx,
          top: ty,
          width: 110,
          height: 110,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
          mixBlendMode: 'screen',
          filter: 'blur(2px)',
        }}
      />
      {/* Leaf motes drifting up */}
      {Array.from({ length: motes }).map((_, i) => {
        const angle = -Math.PI / 2 + (i - 3) * 0.18;
        const dist = 40 + (i % 3) * 12;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 0], x: dx, y: dy, scale: 1 }}
            transition={{ duration: 0.7, delay: i * 0.04, ease: 'easeOut' }}
            className="absolute pointer-events-none text-[10px]"
            style={{
              left: tx,
              top: ty,
              transform: 'translate(-50%, -50%)',
              color,
              textShadow: `0 0 6px ${color}`,
            }}
          >✦</motion.span>
        );
      })}
    </>
  );
}

/* ─── Gold — Bulwark Lock ──────────────────────────────────────────── */
function GoldShieldLock({ tx, ty, containerRect, goldTrail }: { tx: number; ty: number; containerRect: DOMRect; goldTrail: boolean }) {
  const cx = containerRect.width / 2;
  const cy = Math.min(ty, containerRect.height / 2);
  return (
    <>
      {/* Left half slides in */}
      <motion.div
        initial={{ opacity: 0, x: -120, rotate: -10 }}
        animate={{ opacity: [0, 1, 1, 0], x: -10, rotate: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="absolute pointer-events-none text-3xl"
        style={{
          left: cx,
          top: cy,
          transform: 'translate(-50%, -50%)',
          color: 'hsl(var(--gold))',
          textShadow: '0 0 18px hsl(var(--gold) / 0.9)',
        }}
      >🛡</motion.div>
      {/* Right half slides in */}
      <motion.div
        initial={{ opacity: 0, x: 120, rotate: 10, scaleX: -1 }}
        animate={{ opacity: [0, 1, 1, 0], x: 10, rotate: 0, scaleX: -1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="absolute pointer-events-none text-3xl"
        style={{
          left: cx,
          top: cy,
          transform: 'translate(-50%, -50%)',
          color: 'hsl(var(--gold))',
          textShadow: '0 0 18px hsl(var(--gold) / 0.9)',
        }}
      >🛡</motion.div>
      {/* Lock click flash */}
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.9, 0], scale: 1.5 }}
        transition={{ duration: 0.5, delay: 0.35, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: 80,
          height: 80,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, hsl(var(--gold)) 0%, transparent 65%)',
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}

/* ─── Blue — Arcane Charge ─────────────────────────────────────────── */
function BlueArcane({ tx, ty, containerRect, goldTrail }: { tx: number; ty: number; containerRect: DOMRect; goldTrail: boolean }) {
  const color = goldTrail ? 'hsl(var(--gold))' : 'hsl(215 75% 60%)';
  return (
    <>
      {/* Converging diamonds */}
      {[0, 1, 2, 3].map(i => {
        const angle = (Math.PI * 2 * i) / 4;
        const startDist = 60;
        const sx = Math.cos(angle) * startDist;
        const sy = Math.sin(angle) * startDist;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: sx, y: sy, scale: 0.6, rotate: 45 }}
            animate={{ opacity: [0, 1, 0], x: 0, y: 0, scale: 1.1, rotate: 45 }}
            transition={{ duration: 0.55, delay: i * 0.05, ease: 'easeIn' }}
            className="absolute pointer-events-none"
            style={{
              left: tx,
              top: ty,
              width: 12,
              height: 12,
              transform: 'translate(-50%, -50%)',
              background: color,
              boxShadow: `0 0 12px ${color}`,
              borderRadius: 2,
            }}
          />
        );
      })}
      {/* Central pulse */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 0], scale: [0.4, 1.4, 1.8] }}
        transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: tx,
          top: ty,
          width: 80,
          height: 80,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}
