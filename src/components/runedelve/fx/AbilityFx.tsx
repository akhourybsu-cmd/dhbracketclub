import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { AbilityFx as AbilityFxEntry } from '@/hooks/useFxQueue';
import { Meteor, RuneCircle, SacredStar, CrossGlyph, RockChunk } from './FxIcons';

interface Props {
  fx: AbilityFxEntry;
  containerRect: DOMRect;
  onDone: () => void;
}

/**
 * Class-specific ability overlay set pieces. Each class gets a signature
 * cinematic flourish (~900ms total). Pure visual, GPU-composited.
 */
export function AbilityFx({ fx, containerRect, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 1000);
    return () => clearTimeout(t);
  }, [onDone]);

  const cx = containerRect.width / 2;
  const cy = containerRect.height / 2;
  const tx = fx.target ? fx.target.x + fx.target.w / 2 - containerRect.left : cx;
  const ty = fx.target ? fx.target.y + fx.target.h / 2 - containerRect.top : cy;

  switch (fx.cls) {
    case 'warrior':
      return <EarthshatterCleave cx={cx} cy={cy} containerRect={containerRect} />;
    case 'mage':
      return <StarfallConvergence tx={tx} ty={ty} containerRect={containerRect} />;
    case 'rogue':
      return <FivefoldShadow cx={cx} cy={cy} containerRect={containerRect} />;
    case 'cleric':
      return <HallowedSanctum cx={cx} cy={cy} />;
    default:
      return null;
  }
}

/* ─── Warrior · Earthshatter Cleave ────────────────────────────────── */
function EarthshatterCleave({ cx, cy, containerRect }: { cx: number; cy: number; containerRect: DOMRect }) {
  const W = containerRect.width;
  return (
    <>
      {/* Wind-up red aura */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.7, 0], scale: 1.3 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: containerRect.height - 40,
          width: 120,
          height: 60,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse, hsl(var(--destructive) / 0.7), transparent 65%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Wide curved arc-slash with ember trail */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={W}
        height={containerRect.height}
        style={{ overflow: 'visible' }}
      >
        <motion.path
          d={`M ${cx - W * 0.45} ${cy} Q ${cx} ${cy - 30}, ${cx + W * 0.45} ${cy}`}
          stroke="url(#cleave-grad)"
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 0.55, delay: 0.2, ease: 'easeOut' }}
          style={{ filter: 'drop-shadow(0 0 14px hsl(var(--destructive)))' }}
        />
        <defs>
          <linearGradient id="cleave-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="hsl(var(--destructive))" stopOpacity="0" />
            <stop offset="0.5" stopColor="hsl(var(--gold))" />
            <stop offset="1" stopColor="hsl(var(--destructive))" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* 3 ground crack lines */}
      {[-1, 0, 1].map(i => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: [0, 1, 0.4, 0], scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.45 + i * 0.04, ease: 'easeOut' }}
          className="absolute pointer-events-none"
          style={{
            left: cx + i * 60,
            top: cy + 26,
            width: 70,
            height: 3,
            transform: `translate(-50%, -50%) rotate(${i * 12}deg)`,
            background: 'linear-gradient(90deg, transparent, hsl(var(--destructive)), hsl(0 0% 0%), hsl(var(--destructive)), transparent)',
            transformOrigin: 'center',
            borderRadius: 2,
            boxShadow: '0 0 8px hsl(var(--destructive))',
          }}
        />
      ))}

      {/* White shockwave ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, 0.85, 0], scale: 2 }}
        transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: 180,
          height: 180,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '4px solid white',
          boxShadow: '0 0 32px hsl(var(--destructive) / 0.8)',
        }}
      />

      {/* Falling rock chunks */}
      {[0, 1, 2, 3, 4].map(i => {
        const startX = cx - 80 + i * 40;
        return (
          <motion.div
            key={`rk${i}`}
            initial={{ opacity: 0, x: startX, y: cy - 10, rotate: 0 }}
            animate={{ opacity: [0, 1, 0], x: startX + (i - 2) * 8, y: cy + 60, rotate: 180 + i * 60 }}
            transition={{ duration: 0.55, delay: 0.65 + i * 0.05, ease: 'easeIn' }}
            className="absolute pointer-events-none"
            style={{ left: 0, top: 0, transform: 'translate(-50%, -50%)' }}
          >
            <RockChunk size={10} color="hsl(28 30% 30%)" />
          </motion.div>
        );
      })}
    </>
  );
}

/* ─── Mage · Starfall Convergence ──────────────────────────────────── */
function StarfallConvergence({ tx, ty, containerRect }: { tx: number; ty: number; containerRect: DOMRect }) {
  // 3 meteor trajectories converging on target
  const meteors = [
    { fromX: tx - 200, fromY: -80, rot: 30 },
    { fromX: tx + 180, fromY: -60, rot: 150 },
    { fromX: tx - 60, fromY: -160, rot: 90 },
  ];
  return (
    <>
      {/* Rune circle ground glyph */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
        animate={{ opacity: [0, 0.95, 0.7, 0], scale: 1.2, rotate: 90 }}
        transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{ left: tx, top: ty, transform: 'translate(-50%, -50%)' }}
      >
        <RuneCircle size={100} color="hsl(280 80% 70%)" />
      </motion.div>

      {meteors.map((m, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: m.fromX, y: m.fromY, rotate: m.rot, scale: 0.7 }}
          animate={{ opacity: [0, 1, 1, 0], x: tx, y: ty, rotate: m.rot, scale: 1 }}
          transition={{ duration: 0.5, delay: i * 0.07, ease: 'easeIn' }}
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0, transform: 'translate(-50%, -50%)' }}
        >
          <Meteor size={90} color="hsl(280 80% 65%)" />
        </motion.div>
      ))}

      {/* Chromatic-aberration rings */}
      {[
        { c: 'hsl(0 90% 60%)', d: 0.55, off: 0 },
        { c: 'hsl(140 80% 60%)', d: 0.6, off: 4 },
        { c: 'hsl(220 90% 65%)', d: 0.65, off: -4 },
      ].map((r, i) => (
        <motion.div
          key={`ring${i}`}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: [0, 0.85, 0], scale: 2 }}
          transition={{ duration: r.d, delay: 0.55, ease: 'easeOut' }}
          className="absolute pointer-events-none"
          style={{
            left: tx + r.off,
            top: ty,
            width: 90,
            height: 90,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: `2px solid ${r.c}`,
            boxShadow: `0 0 18px ${r.c}`,
            mixBlendMode: 'screen',
          }}
        />
      ))}

      {/* Lightning forks */}
      {[0, 1, 2, 3].map(i => {
        const a = (Math.PI / 2) * i + Math.PI / 4;
        return (
          <motion.div
            key={`fork${i}`}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: [0, 1, 0], scaleY: 1 }}
            transition={{ duration: 0.35, delay: 0.6, ease: 'easeOut' }}
            className="absolute pointer-events-none"
            style={{
              left: tx,
              top: ty,
              width: 3,
              height: 50,
              background: 'linear-gradient(180deg, hsl(280 100% 90%), transparent)',
              boxShadow: '0 0 10px hsl(280 100% 80%)',
              borderRadius: 2,
              transform: `translate(-50%, -50%) rotate(${(a * 180) / Math.PI}deg) translateY(-30px)`,
              transformOrigin: 'center',
            }}
          />
        );
      })}
    </>
  );
}

/* ─── Rogue · Fivefold Shadow ──────────────────────────────────────── */
function FivefoldShadow({ cx, cy, containerRect }: { cx: number; cy: number; containerRect: DOMRect }) {
  const W = containerRect.width;
  return (
    <>
      {/* 5 ghost copies fan across */}
      {[0, 1, 2, 3, 4].map(i => {
        const targetX = cx - W * 0.35 + (i * W * 0.7) / 4;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: cx, y: cy, scale: 0.6 }}
            animate={{ opacity: [0, 0.85, 0.5, 0], x: targetX, y: cy, scale: 1 }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: 'easeOut' }}
            className="absolute pointer-events-none"
            style={{
              left: 0,
              top: 0,
              width: 28,
              height: 36,
              transform: 'translate(-50%, -50%)',
              background: 'linear-gradient(180deg, hsl(var(--gold) / 0.6), hsl(0 0% 10% / 0.7))',
              borderRadius: '40% 40% 30% 30%',
              filter: 'blur(2px)',
              boxShadow: '0 0 14px hsl(0 0% 0% / 0.8)',
            }}
          />
        );
      })}

      {/* Tiny ✕ tag-marks under each ghost */}
      {[0, 1, 2, 3, 4].map(i => {
        const targetX = cx - W * 0.35 + (i * W * 0.7) / 4;
        return (
          <motion.span
            key={`x${i}`}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], scale: 1.1 }}
            transition={{ duration: 0.4, delay: 0.18 + i * 0.06, ease: 'easeOut' }}
            className="absolute pointer-events-none text-xs font-extrabold"
            style={{
              left: targetX,
              top: cy + 22,
              transform: 'translate(-50%, -50%)',
              color: 'hsl(var(--gold))',
              textShadow: '0 0 8px hsl(var(--gold))',
            }}
          >✕</motion.span>
        );
      })}

      {/* Converging back to center */}
      <motion.div
        initial={{ opacity: 0, scale: 1.4 }}
        animate={{ opacity: [0, 1, 0], scale: 0.3 }}
        transition={{ duration: 0.4, delay: 0.55, ease: 'easeIn' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: 80,
          height: 80,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsl(0 0% 0% / 0.7), transparent 65%)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Shadowstep badge settles in */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 0 }}
        animate={{ opacity: [0, 1, 0], scale: 1.05, y: -28 }}
        transition={{ duration: 0.55, delay: 0.7, ease: 'easeOut' }}
        className="absolute pointer-events-none text-[11px] font-extrabold px-2 py-1 rounded-md"
        style={{
          left: cx,
          top: cy,
          transform: 'translate(-50%, -50%)',
          color: 'hsl(var(--gold))',
          background: 'hsl(0 0% 0% / 0.6)',
          border: '1px solid hsl(var(--gold) / 0.6)',
          textShadow: '0 0 8px hsl(var(--gold))',
          boxShadow: '0 0 16px hsl(0 0% 0% / 0.8)',
        }}
      >
        Shadowstep ✦
      </motion.div>
    </>
  );
}

/* ─── Cleric · Hallowed Sanctum ────────────────────────────────────── */
function HallowedSanctum({ cx, cy }: { cx: number; cy: number }) {
  const color = 'hsl(var(--success))';
  const gold = 'hsl(var(--gold))';
  return (
    <>
      {/* Sacred star inscribes */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, rotate: 0 }}
        animate={{ opacity: [0, 1, 0.7, 0], scale: 1.1, rotate: 30 }}
        transition={{ duration: 0.85, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)', filter: `drop-shadow(0 0 10px ${color})` }}
      >
        <SacredStar size={140} color={color} />
      </motion.div>

      {/* Concentric halos in 3 waves */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 0.85, 0], scale: 1.7 + i * 0.5 }}
          transition={{ duration: 0.85, delay: i * 0.15, ease: 'easeOut' }}
          className="absolute pointer-events-none"
          style={{
            left: cx,
            top: cy,
            width: 110,
            height: 110,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: `2px solid ${color}`,
            boxShadow: `0 0 16px ${color}`,
          }}
        />
      ))}

      {/* Dome of light sweep */}
      <motion.div
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: [0, 0.55, 0], scaleY: 1.4 }}
        transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy + 20,
          width: 200,
          height: 120,
          transform: 'translate(-50%, -100%)',
          borderRadius: '50% 50% 0 0',
          background: `radial-gradient(ellipse at center bottom, ${color} 0%, transparent 65%)`,
          mixBlendMode: 'screen',
          transformOrigin: 'center bottom',
        }}
      />

      {/* Floating gold cross-glyphs */}
      {[0, 1, 2, 3].map(i => {
        const a = (Math.PI * 2 * i) / 4 + Math.PI / 8;
        const dist = 50;
        return (
          <motion.div
            key={`c${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0], x: Math.cos(a) * dist, y: Math.sin(a) * dist - 20, scale: 1 }}
            transition={{ duration: 0.85, delay: 0.3 + i * 0.05, ease: 'easeOut' }}
            className="absolute pointer-events-none"
            style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)', filter: `drop-shadow(0 0 4px ${gold})` }}
          >
            <CrossGlyph size={12} color={gold} />
          </motion.div>
        );
      })}

      {/* Central bloom */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.7, 0], scale: 1.5 }}
        transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: 130,
          height: 130,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}
