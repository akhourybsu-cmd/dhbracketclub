// DH Club — "What's New" card
//
// Shown at the top of the club Home when there are unseen newly-installed
// (or version-bumped) important features. Collapses N features into ONE
// card to avoid stacking prompts. Tapping "See What's New" opens a small
// carousel — one feature at a time — each launching the full
// FeatureOnboardingModal.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronRight, X } from 'lucide-react';
import type { FeatureOnboarding } from '@/lib/onboarding/registry';
import { FeatureOnboardingModal } from './FeatureOnboardingModal';

interface Props {
  /** Unseen new features (from useNewFeatures). */
  newFeatures: FeatureOnboarding[];
  /** Club accent color (HSL parts). */
  accent: string;
  /** Called when the user finishes a single feature's tutorial. */
  onFeatureCompleted: (featureKey: string, version: number) => void;
  /** Called when the user dismisses a single feature ("don't show again"). */
  onFeatureDismissed: (featureKey: string, version: number) => void;
  /** Called when the user delays a single feature ("maybe later"). */
  onFeatureRemindLater: (featureKey: string, version: number) => void;
  /** Called when the user dismisses the whole card. */
  onDismissAll: () => void;
}

export function WhatIsNewCard({
  newFeatures, accent,
  onFeatureCompleted, onFeatureDismissed, onFeatureRemindLater,
  onDismissAll,
}: Props) {
  const [activeFeature, setActiveFeature] = useState<FeatureOnboarding | null>(null);

  if (newFeatures.length === 0) return null;

  const single = newFeatures.length === 1;
  const top = newFeatures[0];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative mb-4"
      >
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background:
              `radial-gradient(ellipse 80% 100% at 100% 0%, hsl(${accent} / 0.20), transparent 70%),` +
              'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
            border: `1px solid hsl(${accent} / 0.42)`,
            boxShadow: `0 0 22px -8px hsl(${accent} / 0.5)`,
          }}
        >
          {/* Dismiss-all button */}
          <button
            type="button"
            onClick={onDismissAll}
            aria-label="Dismiss"
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/55 hover:text-foreground active:scale-90 transition"
            style={{ background: 'hsl(var(--muted) / 0.35)' }}
          >
            <X className="w-3 h-3" />
          </button>

          <div className="relative p-3.5 pr-9">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: `hsl(${accent})` }} />
              <p
                className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]"
                style={{ color: `hsl(${accent})` }}
              >
                {single ? 'New Feature' : "What's New"}
              </p>
            </div>
            <h3 className="text-[15px] font-extrabold tracking-tight leading-tight">
              {single
                ? `${top.displayName} is now available`
                : `${newFeatures.length} new features were added to this club`}
            </h3>
            <p className="text-[11px] text-muted-foreground/85 leading-snug mt-1">
              {single
                ? top.shortDescription
                : 'Tap to see what changed.'}
            </p>

            {/* Action row */}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveFeature(top)}
                className="flex-1 h-9 rounded-xl text-[11.5px] font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
                style={{
                  background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
                  color: 'hsl(218 50% 6%)',
                  boxShadow: `0 4px 14px -4px hsl(${accent} / 0.5)`,
                }}
              >
                {single ? 'Show me' : 'See what\'s new'} <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
              </button>
            </div>

            {/* Mini-carousel when 2+ features — small chips for each */}
            {!single && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {newFeatures.map(f => (
                  <button
                    key={f.featureKey}
                    type="button"
                    onClick={() => setActiveFeature(f)}
                    className="flex-shrink-0 px-2.5 h-7 rounded-full text-[10.5px] font-bold active:scale-95 transition flex items-center gap-1"
                    style={{
                      background: `hsl(${accent} / 0.12)`,
                      border: `1px solid hsl(${accent} / 0.28)`,
                      color: `hsl(${accent})`,
                    }}
                  >
                    {f.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Per-feature tutorial */}
      <FeatureOnboardingModal
        open={!!activeFeature}
        onboarding={activeFeature}
        accent={accent}
        onClose={() => setActiveFeature(null)}
        onComplete={() => activeFeature && onFeatureCompleted(activeFeature.featureKey, activeFeature.version)}
        onDismiss={() => activeFeature && onFeatureDismissed(activeFeature.featureKey, activeFeature.version)}
        onRemindLater={() => activeFeature && onFeatureRemindLater(activeFeature.featureKey, activeFeature.version)}
      />
    </>
  );
}
