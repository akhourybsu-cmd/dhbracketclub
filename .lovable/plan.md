# Rune Delve — Comprehensive Balance Report (Admin)

## Goal

Add a one-click, admin-only **Balance Report** that:
1. Runs the existing headless `simulator.ts` across the full level range (1-150) for **all 4 classes**.
2. Cross-references the live data (real player runs in `runedelve_runs`) with the synthetic sim data.
3. Produces a long-form, structured report covering every balance lever in the game.
4. Surfaces concrete, prioritized **rebalance recommendations** with the exact constants/files to edit.
5. Lives behind the existing admin-role gate inside the **Commissioner Hub** on the profile.

No player-facing changes. No DB migrations.

---

## Where it lives

- New tile in `src/components/profile/AdminHub.tsx` under **Competitions**:
  > 📊 **Rune Delve Balance Report** — Full-spectrum balance audit (1-150, all classes)
- New route: `/rune-delve/balance` → `src/pages/RuneDelveBalanceReportPage.tsx`
- Gated identically to the existing Simulator/Analytics pages (admin role check).

---

## What the report contains

The page renders a long, scrollable document with these sections (each generated from real data + sim output):

### 1. Executive Summary
- Health score (0-100) for the campaign.
- Top 5 critical issues (e.g., "L42-45 unwinnable for Cleric", "Rogue dominates 60-100").
- Top 5 quick wins (smallest edits, biggest impact).

### 2. Macro Scaling Audit
- HP curve, damage curve, turn-limit curve plotted across L1-150.
- "DPS budget" per level (total enemy HP ÷ turn limit) vs. simulated avg DPS by class.
- Flags any level where required DPS > best-class achievable DPS.

### 3. Class Balance Matrix
- 4 × 150 grid of clear-rates, color-coded.
- Per-class: best/worst chapters, signature wins, dead zones.
- Identifies class lock-out levels (any level a class can't clear in 100 sim runs).
- Compares passive value (Warrior +30% red, Mage +1 mana on blue, Rogue +15% chain≥5, Cleric +50% green heal).

### 4. Mastery Effectiveness
For each of the 20 masteries (5 per class):
- Wired/unwired status (regression check vs. last balance pass).
- Sim-measured impact: clear-rate delta when active vs. inactive at the unlock level.
- Recommendation: keep / strengthen / nerf / rework.

### 5. Boss & Mid-Boss Audit
- Each boss rule (`bossRules.ts`) — fire-rate, kill-time, near-death rate.
- Phase Lock and Splitter trigger frequency.
- Flags bosses that are (a) total walls or (b) pushovers.

### 6. Enemy Roster & Abilities
- Per-archetype (`enemyRoster.ts`) usage frequency and damage contribution.
- Per-ability (`enemyAbilities.ts`) fire-rate and impact.
- Calls out enemies that are over-/under-represented across chapters.

### 7. Mechanics Layer
For each mechanic (corrupted, eclipse, sealed, shifting, linked-pair, telegraph, layered-goals, daily modifiers):
- Levels it appears on, sim impact on win-rate, and intro pacing.
- Detects "mechanic stacking" cliffs (e.g., 3+ mechanics simultaneously).

### 8. Economy & Progression
- Shard income per level (`shardEconomy.ts`) vs. shop costs.
- XP curve from `scoring.ts`'s `xpForRun` — projected hours to max for each class.
- Relic acquisition rate vs. relic power (`relicEffects.ts`) — flags must-pick / never-pick relics.
- Daily challenge reward parity.

### 9. Live-Data Cross-Check
Pulled from `runedelve_runs` via `supabase--read_query`:
- Real clear rate per level vs. simulated clear rate (delta column).
- Class popularity, ability usage rate.
- Identifies levels where humans massively underperform the AI sim (UX problem) or overperform it (sim AI is too dumb).

### 10. Prioritized Recommendations
Auto-ranked (P0 → P3) action items, e.g.:
> **P0** — `levelGenerator.ts:142` — Reduce L46 enemy HP cap from 160 → 140; current sim clears at 8% across all classes.
> **P1** — `scoring.ts:38` — Rogue +15% bonus too steep at chapters 5+; sim shows 22% score lead. Suggest 12%.
> **P2** — `masteryEffects.ts` — Cleric T4 (Resurgent Light) fires in <3% of runs; consider lowering revive threshold.

Each recommendation includes: file, line range (best-effort), current value, suggested value, expected delta, and a one-line justification.

---

## Technical approach

### New files
- `src/pages/RuneDelveBalanceReportPage.tsx` — UI shell, run controls, rendering.
- `src/lib/runedelve/balanceReport.ts` — pure analysis module: takes sim aggregates + live data → returns a structured `BalanceReport` object (sections, findings, recommendations).
- `src/lib/runedelve/balanceReportRenderer.tsx` — section components (chart-free; uses simple bar rows + tables to keep the file lean).

### Reuse (no edits)
- `simulator.ts` — `simulateBand(1, 150, cls, runs)` per class.
- `levelGenerator.ts`, `bossRules.ts`, `enemyRoster.ts`, `mechanics.ts`, `relicEffects.ts`, `scoring.ts`, `shardEconomy.ts` — read-only inspection.
- `AdminHub.tsx` — add one tile.

### Edits
- `src/App.tsx` — register `/rune-delve/balance` route (mirrors `/rune-delve/simulator`).
- `src/components/profile/AdminHub.tsx` — add the tile under Competitions.

### Run shape
- Default: **80 runs/level × 150 levels × 4 classes = 48,000 sim runs**. Empirically ~6-12s on a modern phone.
- Lower preset (40 runs) for quick scans, higher (200) for deep audits.
- Progress bar segmented by class, then level. Non-blocking via `await new Promise(r => setTimeout(r, 0))` between levels (pattern already used by Simulator page).

### Live-data query
Single read-only Supabase query (no migration):
```sql
SELECT level_number, hero_class,
  count(*) AS attempts,
  count(*) FILTER (WHERE dungeon_cleared) AS clears,
  avg(turns_used) AS avg_turns,
  avg(total_damage) AS avg_dmg,
  avg(hp_remaining) AS avg_hp,
  count(DISTINCT user_id) AS unique_players,
  avg(CASE WHEN ability_used THEN 1 ELSE 0 END) AS ability_rate
FROM runedelve_runs
WHERE level_number BETWEEN 1 AND 150
GROUP BY level_number, hero_class;
```

### Export
- **Copy as Markdown** button (clipboard) — full report as a plain `.md` document.
- **Download .md file** — saves locally for archival / pasting into chat.
- (Optional, if cheap) **Open in new tab as printable HTML** — uses the existing render layer.

### Performance & safety
- Pure client work — no DB writes.
- Heavy loop chunked per class to keep the UI responsive.
- `useRef` cancel flag so navigating away aborts the sweep.
- Hidden behind admin gate (`user_roles.role = 'admin'`), same pattern as Simulator/Analytics.

---

## What it does NOT do
- No automatic application of recommendations — every change still requires a follow-up build pass.
- No new DB tables. Report is regenerated on demand.
- No changes to player-facing pages, combat math, or progression in this pass.

---

## Out of scope (explicitly)
- Tuning changes themselves. Once you review the report, you can ask me to apply specific recommendations and I'll make targeted edits.
- A scheduled / cron'd version — this is on-demand only.
