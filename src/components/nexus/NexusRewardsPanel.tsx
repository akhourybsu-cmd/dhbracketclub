import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useSigilCatalog } from '@/hooks/useNexusRewards';
import { sigilTone, sigilRingShadow, sigilAnimation, type SigilRarity } from '@/lib/nexus/sigilStyle';
import { SigilGlyph } from './SigilGlyph';

interface Reward {
  code: string;
  first_time: boolean;
}

interface Props {
  rewards: { sigils: Reward[]; tokens: number } | null;
  boostCode?: string | null;
}

function useCountUp(target: number, durationMs = 1000) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

/**
 * Results-screen panel: shows Salvage Tokens earned + any sigils awarded
 * (first-time sigils glow extra). Only renders when there's something to show.
 */
export function NexusRewardsPanel({ rewards, boostCode }: Props) {
  const { data: catalog = [] } = useSigilCatalog();
  const tokens = rewards?.tokens ?? 0;
  const animatedTokens = useCountUp(tokens);

  if (!rewards || (tokens === 0 && rewards.sigils.length === 0)) {
    return null;
  }

  const newSigils = rewards.sigils.filter(s => s.first_time);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="relative nx-clip-sm p-3 mb-4 overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, hsl(195 60% 14%), hsl(195 70% 7%))',
        border: '1px solid hsl(195 90% 60% / 0.5)',
        boxShadow: '0 0 18px -4px hsl(195 90% 60% / 0.5)',
      }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'hsl(195 95% 80%)' }} />
          <span
            className="nx-title text-[10px]"
            style={{ color: 'hsl(195 95% 80%)', letterSpacing: '0.22em' }}
          >
            REWARDS EARNED
          </span>
        </div>
        {boostCode && (
          <span
            className="text-[9px] font-black px-1.5 py-0.5 nx-clip-sm uppercase tracking-wider"
            style={{
              background: 'hsl(150 70% 18%)',
              border: '1px solid hsl(150 80% 55%)',
              color: 'hsl(150 90% 80%)',
            }}
          >
            ⚡ {boostCode.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Tokens */}
      {tokens > 0 && (
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[12px] font-bold text-foreground/80">Salvage Tokens</span>
          <motion.span
            initial={{ scale: 0.9 }}
            animate={{ scale: [0.9, 1.18, 1] }}
            transition={{ duration: 0.6 }}
            className="text-xl font-black tabular-nums"
            style={{
              color: 'hsl(195 95% 88%)',
              textShadow: '0 0 8px hsl(195 90% 55% / 0.7)',
            }}
          >
            +⬢ {animatedTokens}
          </motion.span>
        </div>
      )}

      {/* Sigils */}
      {rewards.sigils.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-foreground/55 mb-1.5">
            Sigils
          </div>
          <div className="flex flex-wrap gap-2">
            {rewards.sigils.map((r, i) => {
              const def = catalog.find(c => c.code === r.code);
              if (!def) return null;
              const tone = sigilTone(def.rarity as SigilRarity);
              const isNew = r.first_time;
              return (
                <motion.div
                  key={r.code}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.55 + i * 0.12, type: 'spring', stiffness: 200, damping: 14 }}
                  className="relative flex flex-col items-center gap-1 min-w-[72px]"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: tone.bg,
                      boxShadow: sigilRingShadow(def.rarity as SigilRarity),
                      animation: isNew ? sigilAnimation(def.rarity as SigilRarity) : undefined,
                      color: tone.fg,
                    }}
                  >
                    <SigilGlyph icon={def.icon} className="w-6 h-6" />
                  </div>
                  <div className="text-[9px] font-black text-center leading-tight max-w-[80px] truncate" style={{ color: tone.fg }}>
                    {def.name}
                  </div>
                  {isNew && (
                    <span
                      className="text-[7px] font-black uppercase tracking-widest px-1 py-px"
                      style={{ background: tone.border, color: 'hsl(218 60% 8%)' }}
                    >
                      NEW
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
          {newSigils.length === 0 && (
            <div className="mt-2 text-[10px] text-foreground/55">
              All sigils already collected — token rewards still credited.
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
