// Nexus Defense — Endless Map Selector
//
// Shown on the Loadout page when the active mission is Endless. Lets the
// player pick which layout they want their endless run "deployed on" — the
// selection is persisted to localStorage and surfaced on the briefing card,
// during the run (HUD subtitle), and on the after-action screen.
//
// The selection is wired through to the battle engine via
// `getEnginePathVariant()` — the player's chosen layout drives the actual
// enemy routing for single-spawn / single-core variants (bend, zigzag,
// spiral). Multi-spawn / multi-core layouts (split, dual_nexus, crossfire)
// keep their visual identity but route via the canonical S-curve until the
// engine grows multi-source support.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Map as MapIcon, Check, ChevronRight, X } from 'lucide-react';
import { MapLayoutPreview } from './MapLayoutPreview';
import { ENDLESS_LAYOUTS, getLayout, type MapLayoutId, DEFAULT_ENDLESS_LAYOUT } from '@/lib/nexus/mapLayouts';

const STORAGE_KEY = 'nexus_endless_layout_v1';

/* ─── Public hooks ──────────────────────────────────────────────────── */

export function getEndlessLayoutSelection(): MapLayoutId {
  if (typeof window === 'undefined') return DEFAULT_ENDLESS_LAYOUT;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && ENDLESS_LAYOUTS.some(l => l.id === v)) return v as MapLayoutId;
  } catch { /* ignore */ }
  return DEFAULT_ENDLESS_LAYOUT;
}

export function setEndlessLayoutSelection(id: MapLayoutId): void {
  try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}

export function useEndlessLayout(): [MapLayoutId, (id: MapLayoutId) => void] {
  const [id, setId] = useState<MapLayoutId>(() => getEndlessLayoutSelection());
  useEffect(() => {
    // Re-read on mount in case another tab changed it
    setId(getEndlessLayoutSelection());
  }, []);
  const update = (next: MapLayoutId) => {
    setEndlessLayoutSelection(next);
    setId(next);
  };
  return [id, update];
}

/* ─── Selector card + sheet ────────────────────────────────────────── */

export function EndlessMapSelector() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useEndlessLayout();
  const layout = getLayout(selected);

  return (
    <>
      <motion.button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full nx-clip-sm overflow-hidden flex items-center gap-3 p-3 active:scale-[0.99] transition mb-3"
        style={{
          background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
          border: `1px solid ${layout?.preview.accent.replace(')', ' / 0.4)') ?? 'hsl(var(--nx-amber) / 0.4)'}`,
          boxShadow: `0 0 12px -6px ${layout?.preview.accent.replace(')', ' / 0.45)') ?? 'hsl(var(--nx-amber) / 0.45)'}`,
        }}
      >
        {layout && <MapLayoutPreview layout={layout} size="sm" />}
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MapIcon className="w-3 h-3 flex-shrink-0" style={{ color: layout?.preview.accent ?? 'hsl(var(--nx-amber))' }} />
            <p className="nx-title text-[9px]" style={{ color: layout?.preview.accent ?? 'hsl(var(--nx-amber))', letterSpacing: '0.22em' }}>
              ENDLESS LAYOUT · TAP TO CHANGE
            </p>
          </div>
          <p className="text-[12px] font-black truncate">{layout?.name ?? 'Classic Lane Defense'}</p>
          <p className="text-[10px] text-foreground/65 leading-snug truncate">{layout?.tagline ?? ''}</p>
        </div>
        <ChevronRight className="w-4 h-4 flex-shrink-0 text-foreground/55" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <EndlessMapSheet
            currentId={selected}
            onSelect={(id) => { setSelected(id); setOpen(false); }}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Sheet ────────────────────────────────────────────────────────── */

function EndlessMapSheet({
  currentId,
  onSelect,
  onClose,
}: {
  currentId: MapLayoutId;
  onSelect: (id: MapLayoutId) => void;
  onClose: () => void;
}) {
  // Portal to body so the sheet escapes any ancestor `transform` (PageTransition,
  // framer-motion route wrappers, etc.) that would otherwise break `position: fixed`.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'hsl(218 50% 3% / 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[88dvh] overflow-y-auto nx-clip rounded-t-2xl"
        style={{
          background: 'linear-gradient(180deg, hsl(218 45% 8%), hsl(218 50% 5%))',
          border: '1px solid hsl(var(--nx-amber) / 0.35)',
          boxShadow: '0 -10px 30px -8px hsl(var(--nx-amber) / 0.35)',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-3.5 py-3 border-b"
          style={{
            background: 'linear-gradient(180deg, hsl(218 50% 7%), hsl(218 45% 9% / 0.92))',
            borderColor: 'hsl(var(--nx-amber) / 0.25)',
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <MapIcon className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--nx-amber))' }} />
            <p className="nx-title text-[10px] truncate" style={{ color: 'hsl(var(--nx-amber))', letterSpacing: '0.22em' }}>
              SELECT ENDLESS LAYOUT
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 nx-clip-sm flex items-center justify-center text-foreground/60 hover:text-foreground active:scale-90 transition"
            style={{ background: 'hsl(0 0% 100% / 0.04)', border: '1px solid hsl(0 0% 100% / 0.1)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-3.5 pt-3">
          <p className="text-[11px] text-foreground/65 leading-snug">
            Pick the deployment layout for your next Endless run. Single-path layouts route hostiles along their own
            shape; multi-source layouts (Split Path, Dual Nexus, Crossfire Grid) keep their visual identity but route
            through the canonical path while multi-source engine support lands.
          </p>
        </div>

        <div className="p-3 grid grid-cols-2 gap-2" data-sheet-body>
          {ENDLESS_LAYOUTS.map(layout => {
            const isSelected = layout.id === currentId;
            const accent = layout.preview.accent;
            return (
              <button
                key={layout.id}
                type="button"
                onClick={() => onSelect(layout.id)}
                className="relative text-left p-2.5 nx-clip-sm active:scale-[0.98] transition flex flex-col gap-2"
                style={{
                  background: isSelected
                    ? `linear-gradient(180deg, ${accent.replace(')', ' / 0.18)')}, hsl(218 38% 7%))`
                    : 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
                  border: isSelected
                    ? `1.5px solid ${accent}`
                    : `1px solid ${accent.replace(')', ' / 0.25)')}`,
                  boxShadow: isSelected ? `0 0 12px -4px ${accent.replace(')', ' / 0.5)')}` : undefined,
                }}
              >
                {isSelected && (
                  <span
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: accent, color: 'hsl(218 50% 6%)' }}
                  >
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                )}
                <MapLayoutPreview layout={layout} size="md" pulse={isSelected} />
                <div className="min-w-0">
                  <p className="text-[11px] font-black truncate">{layout.name}</p>
                  <div className="flex items-center gap-0.5 mt-0.5" aria-label={`Difficulty ${layout.difficulty} of 5`}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-sm"
                        style={{ background: i <= layout.difficulty ? accent : 'hsl(0 0% 100% / 0.12)' }}
                      />
                    ))}
                    <span className="ml-1 text-[9px] text-foreground/55 truncate">{layout.preview.cores}× CORE</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
