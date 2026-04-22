
## Rune Delve — Shield Thorns (counter-damage on guard)

### The idea
While the hero's shield is active, a portion of incoming enemy damage is reflected back as "Thorns" damage — splitting evenly across the attackers that swung that turn. Adds an offensive layer to a currently 100%-defensive mechanic without breaking the chain economy.

### How it works (game design)

**Base rule (always on):**
- When `shieldTurns > 0` and enemies hit the hero, calculate Thorns = `round(rawIncomingDamage * 0.25)`.
- "Raw incoming" means the pre-shield total (currently scaled to 40% before HP loss). Thorns is based on the unscaled hit so it scales with how hard the enemy was swinging.
- Thorns is split evenly across all living attackers that contributed to the swing this turn (`floor(thorns / attackers)` each, remainder goes to the first attacker — usually the front-line threat).
- Each attacker takes Thorns damage through `applyArmorToDamage` (so `shield_self`-armored enemies still partially resist — keeps that ability meaningful).
- Kills from Thorns count toward `enemiesDefeated` and `totalDamage` like any other damage source.

**Why 25% and split:**
- Low enough that you can't just turtle behind gold chains and win. With 4 enemies hitting for 8 each (32 raw), Thorns = 8 split = 2 per enemy. Chip damage, not a win condition.
- High enough to matter against bosses (a boss hitting for 30 alone returns 7-8 — meaningful over a 3-turn shield).
- Splitting prevents the cheese case of "stack 5 enemies, eat one shield, kill them all."

**Class and relic interactions:**
- **Warrior** gets a class bonus: Thorns = 40% (up from 25%). Reinforces the "tank that punches back" identity.
- **Cleric** ability already grants 2 turns of shield + heal — now becomes a soft offensive cooldown too.
- New relic tier: **Spiked Aegis** (Common / Rare / Epic) — adds +10% / +20% / +35% to Thorns multiplier. Fits the existing relic catalog (passive multiplier, no new system needed).

**Boss-rule respect:**
- `untargetable` / `phaselock` enemies ignore Thorns (you can't reflect onto a phased target — same rule as red chains). They still hit you, you just can't reflect to them. Prevents Thorns from trivializing those gimmicks.

**Telegraphed ("heavy") swings:** Thorns uses the actual damage that landed, so charged blasts return proportionally bigger reflects. Encourages timing shield drops for big telegraphed turns.

### Combat log + UI
- New log entry type: `🌵 Thorns reflected X damage to [enemy name]` (or `to N enemies` for splits ≥3).
- New FX hook on the shield indicator: a brief outward pulse when Thorns fires (data-fx-target already exists for `shield`).
- Hero Status Bar shield pill stays the same; tooltip updates to "Reflects 25% of damage taken" (40% for warrior).

### Mechanic intro
First time the player completes a level with `shieldTurns > 0` AND takes a hit, surface a one-time `MechanicIntroSheet` explaining Thorns. New mechanic id: `thorns`. Goes in the existing mechanic registry — same flow as other intros.

### Files touched

**`src/lib/runedelve/combatEngine.ts`**
- Add new return field on `enemiesAttack`: `thornsLog?: Omit<CombatLogEntry, 'id'>`.
- In both telegraphed and non-telegraphed branches, when `shieldTurns > 0` AND `totalIncoming > 0`:
  - Compute Thorns from the raw pre-shield total.
  - Apply class multiplier (warrior 1.6x base → 40%, others 1.0x → 25%).
  - Apply relic multiplier (passed via new optional `thornsMultiplier` param so the page layer can plug Spiked Aegis ranks in).
  - Find living, targetable attackers (filter via `filterTargetable(bossRule, enemies)`).
  - Split evenly, apply via `applyArmorToDamage` to each, update `enemiesDefeated` / `totalDamage`, build a single combat log entry.

**`src/lib/runedelve/relics.ts` + `src/lib/runedelve/relicEffects.ts`**
- Register `spiked_aegis` relic with 3 ranks. Common / Rare / Epic shard prices in line with existing offensive relics.
- Compute `thornsMultiplier` in the relic-effects aggregator and expose on `ActiveRelics`.

**`src/lib/runedelve/mechanics.ts`**
- Add `thorns` mechanic entry: icon 🌵, family "Defense", one-liner "Your shield reflects part of every hit back at the attacker."

**`src/pages/RuneDelvePlayPage.tsx`**
- Pass `activeRelics?.thornsMultiplier ?? 1` and `cls` into `enemiesAttack`.
- Append `result.thornsLog` to the combat log when present.
- Trigger a `shield` FX pulse when `thornsLog` exists.
- Detect first-ever Thorns trigger for that user → show the `thorns` mechanic intro once (same pattern as existing intros, persisted via the existing mechanic-seen tracking).

**`src/components/runedelve/HeroStatusBar.tsx`**
- Add a `title` / aria-label on the shield pill: "Reflects 25% of damage taken" (warrior shows 40%).

**`src/components/runedelve/RelicCard.tsx`** — no changes needed; the new relic uses the existing card shape.

### What won't change
- Shield turns, damage scaling (40%), and chain economy stay identical.
- No DB migration. Relic rank persistence already supports new ids.
- Snapshot persistence (just shipped) covers the new state automatically — Thorns is a derived effect, no new fields.

### Verification
- Take a 32-damage swing with shield up: HP drops by ~13 (32 * 0.4), enemies collectively lose 8 HP (32 * 0.25), split.
- As warrior, same swing: enemies lose ~13 HP (32 * 0.4).
- Equip Spiked Aegis Epic on warrior: same swing reflects ~18 HP (32 * 0.4 * 1.35).
- Untargetable boss hits you for 30 with shield up: HP drops by 12, no Thorns log entry (no valid target).
- 4 grunts each hit for 6 (24 raw): each takes 1 Thorns, log reads "Thorns reflected 4 damage across 4 enemies."
- Killing blow via Thorns increments `enemiesDefeated` and shows in the run summary.
- First Thorns trigger ever → mechanic intro sheet appears once, never again.
