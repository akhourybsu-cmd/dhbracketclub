import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { AbilityFx as AbilityFxEntry } from '@/hooks/useFxQueue';

interface Props {
  fx: AbilityFxEntry;
  containerRect: DOMRect;
  onDone: () => void;
}

/**
 * Class-specific ability overlay. Each class gets a unique signature cue
 * (~900ms total). Pure visual, GPU-composited.
 */
export function AbilityFx({ fx, containerRect, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 950);
    return () => clearTimeout(t);
  }, [onDone]);

  const cx = containerRect.width / 2;
  const cy = containerRect.height / 2;

  switch (fx.cls) {
    case 'warrior':
      return <WarriorCleave cx={cx} cy={cy} width={containerRect.width} />;
    case 'mage':
      return <MageArcBurst cx={cx} cy={cy} target={fx.target} containerRect={containerRect} />;
    case 'rogue':
      return <RogueShadowstep cx={cx} cy={cy} width={containerRect.width} />;
    case 'cleric':
      return <ClericSanctuary cx={cx} cy={cy} />;
    default:
      return null;
  }
}

/* ─── Warrior · Cleave ─────────────────────────────────────────────── */
function WarriorCleave({ cx, cy, width }: { cx: number; cy: number; width: number }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scaleX: 0, x: -width / 2 }}
        animate={{ opacity: [0, 1, 0], scaleX: 1.4, x: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: width * 0.95,
          height: 14,
          transform: 'translate(-50%, -50%) skewY(-6deg)',
          background:
            'linear-gradient(90deg, transparent, hsl(var(--destructive)) 35%, hsl(var(--gold)) 50%, hsl(var(--destructive)) 65%, transparent)',
          boxShadow: '0 0 22px hsl(var(--destructive) / 0.9)',
          transformOrigin: 'left center',
          borderRadius: 6,
        }}
      />
      {/* Shockwave ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.7, 0], scale: 1.6 }}
        transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: 140,
          height: 140,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '3px solid hsl(var(--destructive))',
          boxShadow: '0 0 24px hsl(var(--destructive) / 0.6)',
        }}
      />
    </>
  );
}

/* ─── Mage · Arc Burst ─────────────────────────────────────────────── */
function MageArcBurst({
  cx,
  cy,
  target,
  containerRect,
}: {
  cx: number;
  cy: number;
  target?: { x: number; y: number; w: number; h: number };
  containerRect: DOMRect;
}) {
  const tx = target ? target.x + target.w / 2 - containerRect.left : cx;
  const ty = target ? target.y + target.h / 2 - containerRect.top : cy - 40;
  return (
    <>
      {/* Bolt streak from bottom to target */}
      <motion.div
        initial={{ opacity: 0, scaleY: 0, x: cx, y: containerRect.height - 20 }}
        animate={{ opacity: [0, 1, 0], scaleY: 1, x: tx, y: ty }}
        transition={{ duration: 0.45, ease: 'easeIn' }}
        className="absolute pointer-events-none"
        style={{
          left: 0,
          top: 0,
          width: 6,
          height: 80,
          background: 'linear-gradient(180deg, hsl(280 80% 70%), hsl(215 80% 60%))',
          boxShadow: '0 0 18px hsl(280 80% 70%)',
          borderRadius: 3,
          transformOrigin: 'center bottom',
        }}
      />
      {/* Detonation ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 1, 0], scale: 1.8 }}
        transition={{ duration: 0.55, delay: 0.4, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: tx,
          top: ty,
          width: 80,
          height: 80,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '3px solid hsl(280 80% 70%)',
          boxShadow: '0 0 28px hsl(280 80% 70% / 0.9)',
        }}
      />
      {/* Lightning sparks */}
      {[0, 1, 2, 3, 4].map(i => {
        const a = (Math.PI * 2 * i) / 5;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], x: Math.cos(a) * 50, y: Math.sin(a) * 50 }}
            transition={{ duration: 0.5, delay: 0.45, ease: 'easeOut' }}
            className="absolute pointer-events-none"
            style={{
              left: tx,
              top: ty,
              width: 3,
              height: 22,
              transform: `translate(-50%, -50%) rotate(${(a * 180) / Math.PI + 90}deg)`,
              background: 'hsl(280 100% 85%)',
              boxShadow: '0 0 8px hsl(280 100% 85%)',
              borderRadius: 2,
            }}
          />
        );
      })}
    </>
  );
}

/* ─── Rogue · Shadowstep ───────────────────────────────────────────── */
function RogueShadowstep({ cx, cy, width }: { cx: number; cy: number; width: number }) {
  return (
    <>
      {/* Afterimage streak */}
      <motion.div
        initial={{ opacity: 0, x: -width / 3 }}
        animate={{ opacity: [0, 0.8, 0], x: width / 3 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: width * 0.6,
          height: 36,
          transform: 'translate(-50%, -50%)',
          background:
            'linear-gradient(90deg, transparent, hsl(var(--gold) / 0.8), transparent)',
          filter: 'blur(4px)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Sparkle trail */}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <motion.span
          key={i}
          initial={{ opacity: 0, x: -width / 3, y: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 0], x: -width / 3 + (i * width) / 6, y: -10 + (i % 2) * 20, scale: 1 }}
          transition={{ duration: 0.7, delay: i * 0.05, ease: 'easeOut' }}
          className="absolute pointer-events-none text-[12px]"
          style={{
            left: cx,
            top: cy,
            transform: 'translate(-50%, -50%)',
            color: 'hsl(var(--gold))',
            textShadow: '0 0 8px hsl(var(--gold))',
          }}
        >✦</motion.span>
      ))}
    </>
  );
}

/* ─── Cleric · Sanctuary ───────────────────────────────────────────── */
function ClericSanctuary({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      {/* Concentric halos */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 0.8, 0], scale: 1.6 + i * 0.4 }}
          transition={{ duration: 0.85, delay: i * 0.12, ease: 'easeOut' }}
          className="absolute pointer-events-none"
          style={{
            left: cx,
            top: cy,
            width: 100,
            height: 100,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '2px solid hsl(var(--success))',
            boxShadow: '0 0 18px hsl(var(--success) / 0.7)',
          }}
        />
      ))}
      {/* Central bloom */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.7, 0], scale: 1.5 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: cx,
          top: cy,
          width: 120,
          height: 120,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, hsl(var(--success)) 0%, transparent 65%)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Gold sparkles */}
      {[0, 1, 2, 3].map(i => {
        const a = (Math.PI * 2 * i) / 4 + Math.PI / 8;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], x: Math.cos(a) * 60, y: Math.sin(a) * 60 }}
            transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: 'easeOut' }}
            className="absolute pointer-events-none text-sm"
            style={{
              left: cx,
              top: cy,
              transform: 'translate(-50%, -50%)',
              color: 'hsl(var(--gold))',
              textShadow: '0 0 8px hsl(var(--gold))',
            }}
          >✦</motion.span>
        );
      })}
    </>
  );
}
