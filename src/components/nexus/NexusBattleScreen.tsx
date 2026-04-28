import { motion, AnimatePresence } from 'framer-motion';
import { ABILITIES } from '@/lib/nexus/abilities';
import { ENEMIES } from '@/lib/nexus/enemies';
import { TOWERS, towerDamageAt, towerRangeAt, towerSellValue, towerUpgradeCost } from '@/lib/nexus/towers';
import { GRID_COLS, GRID_ROWS, isBuildable, isPath, NEXUS_CELL, pathToXY } from '@/lib/nexus/grid';
import { BattleState, TowerKind } from '@/lib/nexus/types';
import { cn } from '@/lib/utils';
import { Zap, Heart, Layers, ChevronUp, X } from 'lucide-react';

const TOWER_COLORS: Record<TowerKind, { bg: string; border: string; ring: string; text: string }> = {
  pulse:  { bg: 'bg-cyan-500/30',   border: 'border-cyan-400',   ring: 'ring-cyan-400/40',   text: 'text-cyan-300' },
  arc:    { bg: 'bg-violet-500/30', border: 'border-violet-400', ring: 'ring-violet-400/40', text: 'text-violet-300' },
  cryo:   { bg: 'bg-sky-500/30',    border: 'border-sky-400',    ring: 'ring-sky-400/40',    text: 'text-sky-300' },
  rail:   { bg: 'bg-amber-500/30',  border: 'border-amber-400',  ring: 'ring-amber-400/40',  text: 'text-amber-300' },
};

const ENEMY_COLORS: Record<string, string> = {
  drone: 'bg-rose-400 border-rose-200',
  walker: 'bg-orange-500 border-orange-200',
  shielded: 'bg-sky-400 border-sky-100',
  stealth: 'bg-violet-500/60 border-violet-200',
  boss: 'bg-red-600 border-red-200',
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

export function NexusBattleScreen({
  state, selectedTowerKind, selectedTowerId,
  onSelectKind, onPlace, onSelectTower, onUpgrade, onSell, onCastAbility, onStartWave,
}: Props) {
  const cells = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) cells.push({ c, r });
  }
  const selectedTower = selectedTowerId ? state.towers.find(t => t.id === selectedTowerId) : null;
  const totalWaves = (state as any).totalWaves ?? undefined;
  // Range preview for selected tower
  const rangePreview = selectedTower
    ? { col: selectedTower.cell.col, row: selectedTower.cell.row, range: towerRangeAt(selectedTower.kind, selectedTower.level) }
    : selectedTowerKind
      ? { col: -1, row: -1, range: TOWERS[selectedTowerKind].range }
      : null;
  const hpPctBase = state.baseHp / state.baseHpMax;
  const hpColor = hpPctBase > 0.5 ? 'text-emerald-300' : hpPctBase > 0.25 ? 'text-amber-300' : 'text-rose-400';

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto select-none">
      {/* HUD */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-card/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Heart className={cn("w-4 h-4", hpColor)} />
          <span className={cn("tabular-nums", hpColor)}>{state.baseHp}<span className="text-muted-foreground text-xs font-normal">/{state.baseHpMax}</span></span>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-amber-300 tabular-nums">{state.energy}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span className="text-foreground tabular-nums">
            {Math.max(0, state.waveIndex + 1)}
            <span className="text-muted-foreground text-xs font-normal">/{state.totalWaves ?? '·'}</span>
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="relative flex-1 flex items-center justify-center p-2 overflow-hidden">
        <div
          className="relative grid w-full max-w-[420px] rounded-xl bg-[radial-gradient(circle_at_50%_50%,hsl(220_60%_8%),hsl(220_70%_4%))] border border-cyan-500/20 shadow-[0_0_30px_-10px_hsl(180_80%_50%/0.4)] overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`,
          }}
        >
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
                  'relative border border-cyan-500/5 transition-colors',
                  onPath && 'bg-cyan-500/10',
                  buildable && !placed && 'bg-emerald-500/[0.04] hover:bg-emerald-500/15',
                  isNexus && 'bg-amber-500/30 ring-1 ring-amber-400/60',
                  canPlaceHere && 'bg-emerald-500/30 ring-1 ring-emerald-300',
                  placed && 'bg-transparent',
                )}
              >
                {isNexus && <span className="absolute inset-0 flex items-center justify-center text-amber-300 font-black text-[10px]">N</span>}
                {placed && (
                  <div className={cn(
                    'absolute inset-1 rounded-md border-2 flex items-center justify-center font-black text-[11px]',
                    TOWER_COLORS[placed.kind].bg,
                    TOWER_COLORS[placed.kind].border,
                    TOWER_COLORS[placed.kind].text,
                    selectedTowerId === placed.id && 'ring-2 ring-emerald-400',
                  )}>
                    {TOWERS[placed.kind].glyph}
                    <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-background/80 px-1 rounded">L{placed.level}</span>
                  </div>
                )}
              </button>
            );
          })}

          {/* Enemies overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {state.enemies.map(e => {
              const def = ENEMIES[e.kind];
              const pos = pathToXY(e.pathIndex, e.progress);
              const left = ((pos.x + 0.5) / GRID_COLS) * 100;
              const top = ((pos.y + 0.5) / GRID_ROWS) * 100;
              const hpPct = Math.max(0, e.hp / def.hp);
              const size = e.kind === 'boss' ? 28 : e.kind === 'walker' ? 18 : 14;
              return (
                <div
                  key={e.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <div className={cn(
                    'rounded-full border-2 shadow-md flex items-center justify-center text-[8px] font-black text-white',
                    ENEMY_COLORS[e.kind],
                    def.stealth && 'opacity-60',
                  )} style={{ width: size, height: size }}>
                    {def.glyph}
                  </div>
                  {(e.shield > 0) && (
                    <div className="absolute -inset-0.5 rounded-full border border-sky-300/70" />
                  )}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-black/60 rounded">
                    <div className="h-full bg-emerald-400 rounded transition-all" style={{ width: `${hpPct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

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
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-emerald-500 text-emerald-950 font-black text-sm shadow-lg shadow-emerald-500/30 active:scale-95 transition"
          >
            {state.status === 'pre' ? 'START WAVE 1' : `NEXT WAVE (${Math.ceil(state.betweenWaveMs / 1000)}s) — TAP TO RUSH`}
          </button>
        )}
      </div>

      {/* Selected tower panel */}
      {selectedTower && (
        <div className="px-3 pb-2">
          <div className="rounded-lg border border-emerald-500/40 bg-card/90 p-2 flex items-center gap-2">
            <div className={cn('w-9 h-9 rounded-md border-2 flex items-center justify-center font-black text-sm', TOWER_COLORS[selectedTower.kind].bg, TOWER_COLORS[selectedTower.kind].border, TOWER_COLORS[selectedTower.kind].text)}>
              {TOWERS[selectedTower.kind].glyph}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold">{TOWERS[selectedTower.kind].name} <span className="text-muted-foreground font-normal">L{selectedTower.level}</span></div>
              <div className="text-[10px] text-muted-foreground">DMG {towerDamageAt(selectedTower.kind, selectedTower.level)} · RNG {towerRangeAt(selectedTower.kind, selectedTower.level).toFixed(1)}</div>
            </div>
            <button
              onClick={() => onUpgrade(selectedTower.id)}
              disabled={selectedTower.level >= 3 || state.energy < towerUpgradeCost(selectedTower.kind, selectedTower.level)}
              className="px-2.5 py-2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold disabled:opacity-40 active:scale-95"
            >
              <ChevronUp className="w-3 h-3 inline" /> {selectedTower.level >= 3 ? 'MAX' : towerUpgradeCost(selectedTower.kind, selectedTower.level)}
            </button>
            <button
              onClick={() => onSell(selectedTower.id)}
              className="px-2.5 py-2 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-bold active:scale-95"
            >
              <X className="w-3 h-3 inline" /> {towerSellValue(selectedTower.kind, selectedTower.level)}
            </button>
          </div>
        </div>
      )}

      {/* Bottom tray: tower picker + abilities */}
      <div className="px-3 pb-3 pt-1 bg-card/80 backdrop-blur border-t border-border">
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {(['pulse','arc','cryo','rail'] as TowerKind[]).map(kind => {
            const def = TOWERS[kind];
            const selected = selectedTowerKind === kind;
            const affordable = state.energy >= def.cost;
            return (
              <button
                key={kind}
                onClick={() => { onSelectKind(selected ? null : kind); onSelectTower(null); }}
                className={cn(
                  'relative h-14 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition active:scale-95',
                  TOWER_COLORS[kind].bg,
                  selected ? TOWER_COLORS[kind].border : 'border-transparent',
                  !affordable && 'opacity-50',
                )}
              >
                <span className={cn('font-black text-base', TOWER_COLORS[kind].text)}>{def.glyph}</span>
                <span className="text-[9px] font-bold text-foreground/80">⚡{def.cost}</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {state.abilities.map(a => {
            const def = ABILITIES[a.kind];
            const ready = a.cooldownMs <= 0;
            const pct = ready ? 1 : 1 - (a.cooldownMs / def.cooldownMs);
            return (
              <button
                key={a.kind}
                onClick={() => ready && onCastAbility(a.kind)}
                disabled={!ready}
                className={cn(
                  'relative h-11 rounded-lg border-2 flex items-center justify-center gap-1.5 font-bold text-xs overflow-hidden active:scale-95',
                  ready ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-border bg-muted/50 text-muted-foreground',
                )}
              >
                <span className="text-base">{def.glyph}</span>
                <span>{def.name}</span>
                {!ready && (
                  <div className="absolute inset-0 bg-background/60" style={{ clipPath: `inset(0 0 ${pct * 100}% 0)` }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
