import { motion, AnimatePresence } from 'framer-motion';
import { ABILITIES } from '@/lib/nexus/abilities';
import { ENEMIES } from '@/lib/nexus/enemies';
import { TOWERS, towerDamageAt, towerRangeAt, towerSellValue, towerUpgradeCost } from '@/lib/nexus/towers';
import { GRID_COLS, GRID_ROWS, isBuildable, isPath, NEXUS_CELL, PATH, pathToXY } from '@/lib/nexus/grid';
import { BattleState, TowerKind } from '@/lib/nexus/types';
import { cn } from '@/lib/utils';
import { Heart, ChevronUp, X } from 'lucide-react';
import { TowerIcon } from './TowerIcon';
import { EnemyMarker, getEnemyAccent } from './EnemyMarker';

// hsl strings for SVG/inline use — anchored to nx tokens conceptually but
// resolved here so they render reliably inside framer-motion wrappers.
const TOWER_HSL: Record<TowerKind, { c: string; cDim: string; bg: string; text: string }> = {
  pulse: { c: 'hsl(188 92% 56%)', cDim: 'hsl(188 92% 56% / 0.18)', bg: 'hsl(188 92% 56% / 0.14)', text: 'hsl(188 92% 78%)' },
  arc:   { c: 'hsl(265 80% 70%)', cDim: 'hsl(265 80% 70% / 0.18)', bg: 'hsl(265 80% 70% / 0.14)', text: 'hsl(265 80% 84%)' },
  cryo:  { c: 'hsl(200 95% 70%)', cDim: 'hsl(200 95% 70% / 0.18)', bg: 'hsl(200 95% 70% / 0.14)', text: 'hsl(200 95% 84%)' },
  rail:  { c: 'hsl(38 95% 60%)',  cDim: 'hsl(38 95% 60% / 0.18)',  bg: 'hsl(38 95% 60% / 0.14)',  text: 'hsl(38 95% 78%)' },
};

interface Props {
  state: BattleState;
  selectedTowerKind: TowerKind | null;
  selectedTowerId: string | null;
  onSelectKind: (k: TowerKind | null) => void;
  onPlace: (col: number, row: number) => void;
  onSelectTower: (id: string | null) => void;
  onUpgrade: (id: string) => void;
  onSell: (id: string) => void;
  onCastAbility: (kind: 'orbital' | 'emp') => void;
  onStartWave: () => void;
}

// Build SVG polyline `points` attribute for the enemy path (centers of each cell)
const PATH_POINTS = PATH
  .map((c) => `${(c.col + 0.5) * (100 / GRID_COLS)},${(c.row + 0.5) * (100 / GRID_ROWS)}`)
  .join(' ');

export function NexusBattleScreen({
  state, selectedTowerKind, selectedTowerId,
  onSelectKind, onPlace, onSelectTower, onUpgrade, onSell, onCastAbility, onStartWave,
}: Props) {
  const cells = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) cells.push({ c, r });
  }
  const selectedTower = selectedTowerId ? state.towers.find(t => t.id === selectedTowerId) : null;
  const hpPctBase = state.baseHp / state.baseHpMax;
  const hpColor = hpPctBase > 0.5 ? 'hsl(150 80% 60%)' : hpPctBase > 0.25 ? 'hsl(38 95% 60%)' : 'hsl(350 85% 62%)';

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto select-none">
      {/* ───── Unified command HUD rail ───── */}
      <div
        className="relative px-3 py-2"
        style={{
          background:
            'linear-gradient(180deg, hsl(var(--nx-panel) / 0.96), hsl(var(--nx-panel) / 0.55))',
          borderBottom: '1px solid hsl(var(--nx-cyan) / 0.3)',
          boxShadow:
            '0 1px 0 hsl(var(--nx-cyan) / 0.18), 0 8px 16px -10px hsl(var(--nx-cyan) / 0.35)',
        }}
      >
        {/* Corner brackets — make whole HUD feel like one panel */}
        <span aria-hidden className="absolute top-1 left-1 w-2 h-2 border-l border-t" style={{ borderColor: 'hsl(var(--nx-cyan) / 0.7)' }} />
        <span aria-hidden className="absolute top-1 right-1 w-2 h-2 border-r border-t" style={{ borderColor: 'hsl(var(--nx-cyan) / 0.7)' }} />
        <div className="flex items-stretch gap-3">
          {/* HP block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <Heart className="w-2.5 h-2.5" style={{ color: hpColor }} />
              <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.14em' }}>NEXUS</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums leading-none" style={{ color: hpColor, textShadow: `0 0 8px ${hpColor}` }}>{state.baseHp}</span>
              <span className="text-[9px] font-bold tabular-nums" style={{ color: 'hsl(0 0% 100% / 0.4)' }}>/{state.baseHpMax}</span>
            </div>
            <div className="mt-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'hsl(0 0% 100% / 0.06)' }}>
              <div className="h-full transition-all" style={{ width: `${Math.max(0, hpPctBase * 100)}%`, background: hpColor, boxShadow: `0 0 6px ${hpColor}` }} />
            </div>
          </div>

          {/* Vertical divider */}
          <div className="w-px self-stretch" style={{ background: 'linear-gradient(180deg, transparent, hsl(var(--nx-cyan) / 0.35), transparent)' }} />

          {/* Energy block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] leading-none" style={{ color: 'hsl(var(--nx-amber))' }}>⚡</span>
              <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.14em' }}>ENERGY</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums leading-none" style={{ color: 'hsl(var(--nx-amber))', textShadow: '0 0 8px hsl(var(--nx-amber) / 0.7)' }}>{state.energy}</span>
            </div>
            <div className="mt-1 h-[3px] rounded-full overflow-hidden nx-scan-bar" style={{ background: 'hsl(var(--nx-amber) / 0.15)' }}>
              <div className="h-full" style={{ width: `100%`, background: 'linear-gradient(90deg, hsl(var(--nx-amber) / 0.55), hsl(var(--nx-amber)))' }} />
            </div>
          </div>

          {/* Vertical divider */}
          <div className="w-px self-stretch" style={{ background: 'linear-gradient(180deg, transparent, hsl(var(--nx-cyan) / 0.35), transparent)' }} />

          {/* Wave block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] leading-none" style={{ color: 'hsl(var(--nx-cyan))' }}>◫</span>
              <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.14em' }}>WAVE</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums leading-none" style={{ color: 'hsl(var(--nx-cyan))', textShadow: '0 0 8px hsl(var(--nx-cyan) / 0.7)' }}>{Math.max(0, state.waveIndex + 1)}</span>
              <span className="text-[9px] font-bold tabular-nums" style={{ color: 'hsl(0 0% 100% / 0.4)' }}>/{state.totalWaves ?? '·'}</span>
            </div>
            <div className="mt-1 flex gap-[2px]">
              {Array.from({ length: state.totalWaves || 0 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-[3px] rounded-sm"
                  style={{
                    background: i <= state.waveIndex
                      ? 'hsl(var(--nx-cyan))'
                      : 'hsl(var(--nx-cyan) / 0.18)',
                    boxShadow: i <= state.waveIndex ? '0 0 4px hsl(var(--nx-cyan))' : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ───── Battle grid ───── */}
      <div className="relative flex-1 flex items-center justify-center p-2 overflow-hidden">
        <div
          className="relative grid w-full max-w-[420px] overflow-hidden nx-clip"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`,
            background:
              'radial-gradient(ellipse 80% 60% at 50% 40%, hsl(218 50% 9%), hsl(220 60% 4%) 75%)',
            border: '1px solid hsl(var(--nx-cyan) / 0.35)',
            boxShadow:
              'inset 0 0 24px hsl(var(--nx-cyan) / 0.12), 0 0 28px -8px hsl(var(--nx-cyan) / 0.45)',
          }}
        >
          {/* Subtle background grid */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-[0.18]"
            style={{
              backgroundImage:
                'linear-gradient(hsl(var(--nx-cyan) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--nx-cyan) / 0.6) 1px, transparent 1px)',
              backgroundSize: `${100 / GRID_COLS}% ${100 / GRID_ROWS}%`,
            }}
          />

          {/* Energy corridor (path) — SVG glow + scan dashes */}
          <svg
            aria-hidden
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Outer glow */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 92% 56% / 0.18)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'blur(2px)' }}
            />
            {/* Lane fill */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 92% 56% / 0.32)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* Inner bright core */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 92% 80%)"
              strokeWidth="0.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.7"
            />
            {/* Running scan dashes — energy moving toward the nexus */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 92% 90%)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="2 8"
              opacity="0.8"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.6s" repeatCount="indefinite" />
            </polyline>
          </svg>

          {/* Cell grid (interaction layer) */}
          {cells.map(({ c, r }) => {
            const onPath = isPath(c, r);
            const buildable = isBuildable(c, r);
            const isNexus = c === NEXUS_CELL.col && r === NEXUS_CELL.row;
            const placed = state.towers.find(t => t.cell.col === c && t.cell.row === r);
            const canPlaceHere = !!selectedTowerKind && buildable && !placed && state.energy >= TOWERS[selectedTowerKind].cost;
            return (
              <button
                key={`${c}-${r}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (placed) {
                    onSelectTower(placed.id);
                    onSelectKind(null);
                  } else if (selectedTowerKind && buildable) {
                    onPlace(c, r);
                  } else {
                    onSelectTower(null);
                  }
                }}
                className={cn(
                  'relative transition-colors',
                  buildable && !placed && !canPlaceHere && 'hover:bg-cyan-400/10',
                  canPlaceHere && 'bg-emerald-400/25',
                )}
                style={canPlaceHere ? {
                  boxShadow: 'inset 0 0 0 1.5px hsl(150 80% 60% / 0.85)',
                } : undefined}
              >
                {/* Nexus core */}
                {isNexus && (
                  <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="nx-reactor-glow absolute inset-1 rounded-full"
                      style={{
                        background:
                          'radial-gradient(circle, hsl(var(--nx-amber) / 0.6), hsl(var(--nx-amber) / 0.15) 60%, transparent 75%)',
                      }}
                    />
                    <span
                      className="relative w-[68%] h-[68%] rounded-full flex items-center justify-center"
                      style={{
                        background:
                          'radial-gradient(circle at 35% 30%, hsl(38 95% 75%), hsl(38 95% 50%) 55%, hsl(20 70% 30%) 90%)',
                        boxShadow:
                          '0 0 10px hsl(var(--nx-amber) / 0.7), inset 0 0 6px hsl(0 0% 100% / 0.4), inset 0 -2px 4px hsl(0 0% 0% / 0.4)',
                        border: '1px solid hsl(38 95% 80% / 0.7)',
                      }}
                    >
                      <span className="text-[7px] font-black" style={{ color: 'hsl(20 60% 18%)' }}>◉</span>
                    </span>
                  </span>
                )}

                {/* Hardpoint dot on empty buildable tiles */}
                {buildable && !placed && !canPlaceHere && (
                  <span aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 nx-hardpoint" />
                )}

                {/* Path waypoint nodes (subtle) */}
                {onPath && !isNexus && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full"
                    style={{ background: 'hsl(188 92% 75% / 0.35)' }}
                  />
                )}

                {/* Placed tower */}
                {placed && (
                  <div
                    className={cn(
                      'absolute inset-[3px] rounded-md flex items-center justify-center',
                      selectedTowerId === placed.id && 'ring-2',
                    )}
                    style={{
                      background: TOWER_HSL[placed.kind].bg,
                      border: `1.5px solid ${TOWER_HSL[placed.kind].c}`,
                      boxShadow: `0 0 8px ${TOWER_HSL[placed.kind].cDim}, inset 0 0 6px hsl(0 0% 100% / 0.06)`,
                      color: TOWER_HSL[placed.kind].c,
                      // @ts-expect-error css var
                      '--tw-ring-color': 'hsl(150 80% 60% / 0.85)',
                    }}
                  >
                    <TowerIcon kind={placed.kind} size={20} />
                    <span
                      className="absolute -top-[5px] -right-[5px] text-[7px] font-black px-[3px] py-[1px] rounded-sm leading-none"
                      style={{
                        background: 'hsl(218 50% 8%)',
                        color: TOWER_HSL[placed.kind].text,
                        border: `1px solid ${TOWER_HSL[placed.kind].c}`,
                      }}
                    >
                      L{placed.level}
                    </span>
                  </div>
                )}
              </button>
            );
          })}

          {/* Enemies overlay — distinct silhouettes per type */}
          <div className="absolute inset-0 pointer-events-none">
            {state.enemies.map(e => {
              const def = ENEMIES[e.kind];
              const accent = getEnemyAccent(e.kind);
              const pos = pathToXY(e.pathIndex, e.progress);
              const left = ((pos.x + 0.5) / GRID_COLS) * 100;
              const top = ((pos.y + 0.5) / GRID_ROWS) * 100;
              const hpPct = Math.max(0, e.hp / def.hp);
              const size = e.kind === 'boss' ? 30 : e.kind === 'walker' ? 22 : 17;
              const barW = e.kind === 'boss' ? 22 : 14;
              return (
                <div
                  key={e.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  {/* Boss aura — extra threat presence */}
                  {e.kind === 'boss' && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full nx-reactor-glow"
                      style={{
                        width: size + 14,
                        height: size + 14,
                        background: `radial-gradient(circle, ${accent.glow}, transparent 70%)`,
                      }}
                    />
                  )}

                  {/* Stealth cloak ring (dashed) */}
                  {def.stealth && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: size + 6,
                        height: size + 6,
                        border: `1px dashed ${accent.edge}`,
                        opacity: 0.55,
                      }}
                    />
                  )}

                  {/* Shield bubble */}
                  {e.shield > 0 && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: size + 8,
                        height: size + 8,
                        background: 'radial-gradient(circle, hsl(200 95% 70% / 0.18), transparent 70%)',
                        border: '1px solid hsl(200 95% 75% / 0.85)',
                        boxShadow: '0 0 6px hsl(200 95% 70% / 0.7), inset 0 0 4px hsl(200 95% 80% / 0.4)',
                      }}
                    />
                  )}

                  <div
                    className={cn('relative flex items-center justify-center', def.stealth && 'opacity-75')}
                    style={{ width: size, height: size }}
                  >
                    <EnemyMarker kind={e.kind} size={size} />
                  </div>

                  {/* HP bar */}
                  <div
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-[2px] rounded overflow-hidden"
                    style={{ width: barW, background: 'hsl(0 0% 0% / 0.7)', border: '0.5px solid hsl(0 0% 100% / 0.15)' }}
                  >
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${hpPct * 100}%`,
                        background: hpPct > 0.5 ? 'hsl(150 85% 60%)' : hpPct > 0.25 ? 'hsl(38 95% 60%)' : 'hsl(350 90% 62%)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Range circle for selected placed tower */}
          {selectedTower && (
            <div
              className="absolute pointer-events-none rounded-full"
              style={{
                left: `${((selectedTower.cell.col + 0.5) / GRID_COLS) * 100}%`,
                top: `${((selectedTower.cell.row + 0.5) / GRID_ROWS) * 100}%`,
                width: `${(towerRangeAt(selectedTower.kind, selectedTower.level) * 2 / GRID_COLS) * 100}%`,
                height: `${(towerRangeAt(selectedTower.kind, selectedTower.level) * 2 / GRID_ROWS) * 100}%`,
                transform: 'translate(-50%, -50%)',
                border: '1px dashed hsl(150 80% 60% / 0.7)',
                background: 'hsl(150 80% 60% / 0.05)',
                boxShadow: 'inset 0 0 12px hsl(150 80% 60% / 0.18)',
              }}
            />
          )}

          {/* Shot effects */}
          <div className="absolute inset-0 pointer-events-none">
            <AnimatePresence>
              {state.events.filter(ev => ev.type === 'shot').map((ev, i) => {
                if (ev.type !== 'shot') return null;
                const x1 = ((ev.from.col + 0.5) / GRID_COLS) * 100;
                const y1 = ((ev.from.row + 0.5) / GRID_ROWS) * 100;
                const x2 = ((ev.to.x + 0.5) / GRID_COLS) * 100;
                const y2 = ((ev.to.y + 0.5) / GRID_ROWS) * 100;
                const stroke = ev.tower === 'pulse' ? '#22d3ee'
                  : ev.tower === 'arc' ? '#a78bfa'
                  : ev.tower === 'cryo' ? '#7dd3fc'
                  : '#fbbf24';
                return (
                  <motion.svg
                    key={`${ev.t}-${i}`}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={ev.tower === 'rail' ? 0.6 : 0.35} />
                  </motion.svg>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Start wave / status overlay */}
        {(state.status === 'pre' || state.status === 'between') && (
          <button
            onClick={onStartWave}
            className="absolute bottom-3 left-3 right-3 nx-clip-sm py-3 font-black text-sm active:scale-95 transition nx-title"
            style={{
              background: 'linear-gradient(180deg, hsl(150 80% 55%), hsl(150 80% 42%))',
              color: 'hsl(150 30% 8%)',
              boxShadow: '0 0 18px hsl(150 80% 55% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.35)',
            }}
          >
            {state.status === 'pre'
              ? `▶  DEPLOY WAVE 01 / ${String(state.totalWaves).padStart(2, '0')}`
              : `▶  WAVE ${String(state.waveIndex + 2).padStart(2, '0')} / ${String(state.totalWaves).padStart(2, '0')}  ·  ${Math.ceil(state.betweenWaveMs / 1000)}s  ·  TAP TO RUSH`}
          </button>
        )}
      </div>

      {/* ───── Selected tower panel ───── */}
      {selectedTower && (
        <div className="px-3 pb-2">
          <div
            className="nx-clip-sm p-2 flex items-center gap-2"
            style={{
              background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 8%))',
              border: '1px solid hsl(150 80% 55% / 0.5)',
              boxShadow: '0 0 12px -4px hsl(150 80% 55% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.05)',
            }}
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: TOWER_HSL[selectedTower.kind].bg,
                border: `1.5px solid ${TOWER_HSL[selectedTower.kind].c}`,
                color: TOWER_HSL[selectedTower.kind].c,
                boxShadow: `0 0 10px ${TOWER_HSL[selectedTower.kind].cDim}`,
              }}
            >
              <TowerIcon kind={selectedTower.kind} size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black truncate">
                {TOWERS[selectedTower.kind].name}
                <span className="ml-1.5 text-[9px] font-bold nx-title" style={{ color: TOWER_HSL[selectedTower.kind].text }}>L{selectedTower.level}</span>
              </div>
              <div className="text-[10px] text-foreground/65 nx-title">
                DMG <span className="text-foreground">{towerDamageAt(selectedTower.kind, selectedTower.level)}</span> · RNG <span className="text-foreground">{towerRangeAt(selectedTower.kind, selectedTower.level).toFixed(1)}</span>
              </div>
            </div>
            <button
              onClick={() => onUpgrade(selectedTower.id)}
              disabled={selectedTower.level >= 3 || state.energy < towerUpgradeCost(selectedTower.kind, selectedTower.level)}
              className="px-2.5 py-2 rounded-md text-[11px] font-black disabled:opacity-40 active:scale-95 nx-title"
              style={{
                background: 'hsl(150 80% 55% / 0.18)',
                color: 'hsl(150 80% 70%)',
                border: '1px solid hsl(150 80% 55% / 0.5)',
              }}
            >
              <ChevronUp className="w-3 h-3 inline" /> {selectedTower.level >= 3 ? 'MAX' : towerUpgradeCost(selectedTower.kind, selectedTower.level)}
            </button>
            <button
              onClick={() => onSell(selectedTower.id)}
              className="px-2.5 py-2 rounded-md text-[11px] font-black active:scale-95 nx-title"
              style={{
                background: 'hsl(350 85% 62% / 0.14)',
                color: 'hsl(350 85% 78%)',
                border: '1px solid hsl(350 85% 62% / 0.4)',
              }}
            >
              <X className="w-3 h-3 inline" /> {towerSellValue(selectedTower.kind, selectedTower.level)}
            </button>
          </div>
        </div>
      )}

      {/* ───── Bottom tray: tower picker + abilities ───── */}
      <div
        className="px-3 pb-3 pt-2"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--nx-panel) / 0.6), hsl(var(--nx-panel) / 0.95))',
          borderTop: '1px solid hsl(var(--nx-cyan) / 0.25)',
          boxShadow: '0 -1px 0 hsl(var(--nx-cyan) / 0.15)',
        }}
      >
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {(['pulse','arc','cryo','rail'] as TowerKind[]).map(kind => {
            const def = TOWERS[kind];
            const selected = selectedTowerKind === kind;
            const affordable = state.energy >= def.cost;
            const shortName = kind === 'pulse' ? 'Pulse' : kind === 'arc' ? 'Arc' : kind === 'cryo' ? 'Cryo' : 'Rail';
            const c = TOWER_HSL[kind];
            return (
              <button
                key={kind}
                onClick={() => { onSelectKind(selected ? null : kind); onSelectTower(null); }}
                className={cn(
                  'relative min-h-[64px] nx-clip-sm flex flex-col items-center justify-center gap-0 py-1 transition active:scale-95',
                  !affordable && 'opacity-50',
                )}
                style={{
                  background: selected
                    ? `linear-gradient(180deg, ${c.bg}, hsl(218 35% 9%))`
                    : 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 8%))',
                  border: selected ? `1.5px solid ${c.c}` : '1px solid hsl(0 0% 100% / 0.06)',
                  boxShadow: selected
                    ? `0 0 14px -2px ${c.cDim}, inset 0 1px 0 hsl(0 0% 100% / 0.08)`
                    : 'inset 0 1px 0 hsl(0 0% 100% / 0.04)',
                  color: c.c,
                }}
              >
                <TowerIcon kind={kind} size={26} />
                <span className="nx-title text-[8px] mt-0.5" style={{ color: selected ? c.text : 'hsl(0 0% 100% / 0.7)' }}>{shortName}</span>
                <span className="text-[9px] font-black tabular-nums leading-none mt-0.5" style={{ color: 'hsl(var(--nx-amber))' }}>⚡{def.cost}</span>
                {selected && (
                  <>
                    <span aria-hidden className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-l border-t" style={{ borderColor: c.c }} />
                    <span aria-hidden className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-r border-b" style={{ borderColor: c.c }} />
                  </>
                )}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {state.abilities.map(a => {
            const def = ABILITIES[a.kind];
            const ready = a.cooldownMs <= 0;
            const pct = ready ? 1 : 1 - (a.cooldownMs / def.cooldownMs);
            const remainSec = Math.ceil(a.cooldownMs / 1000);
            return (
              <button
                key={a.kind}
                onClick={() => ready && onCastAbility(a.kind)}
                disabled={!ready}
                className="relative h-12 nx-clip-sm flex items-center justify-center gap-2 font-black text-xs overflow-hidden active:scale-95 nx-title"
                style={{
                  background: ready
                    ? 'linear-gradient(180deg, hsl(var(--nx-amber) / 0.28), hsl(var(--nx-amber) / 0.12))'
                    : 'linear-gradient(180deg, hsl(218 35% 12%), hsl(218 38% 9%))',
                  border: ready ? '1.5px solid hsl(var(--nx-amber) / 0.85)' : '1px solid hsl(0 0% 100% / 0.06)',
                  boxShadow: ready
                    ? '0 0 14px -2px hsl(var(--nx-amber) / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.1)'
                    : 'inset 0 1px 0 hsl(0 0% 100% / 0.04)',
                  color: ready ? 'hsl(var(--nx-amber))' : 'hsl(0 0% 100% / 0.4)',
                }}
              >
                <span className="text-base leading-none">{def.glyph}</span>
                <span className="text-[10px]">{def.name}</span>
                {/* Radial cooldown sweep */}
                {!ready && (
                  <>
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          `conic-gradient(hsl(0 0% 0% / 0.55) ${(1 - pct) * 360}deg, transparent 0deg)`,
                        mixBlendMode: 'multiply',
                      }}
                    />
                    <span className="absolute right-1.5 bottom-1 text-[9px] font-mono tabular-nums" style={{ color: 'hsl(0 0% 100% / 0.7)' }}>
                      {remainSec}s
                    </span>
                  </>
                )}
                {ready && (
                  <span aria-hidden className="absolute inset-0 pointer-events-none nx-scan-bar" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
