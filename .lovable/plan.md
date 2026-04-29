## Nexus Defense Rewards — Phase A Implementation

Ships the foundation reward loop: earn sigils + salvage tokens from Endless milestones and completed Co-op Operations, spend tokens on pre-run Loadout Boosts, surface unlocks on Results/Leaderboard/HUD.

### 1. Database migration (one file)

**New tables (all RLS-enabled):**
- `nexus_sigils` — catalog: `code, name, description, icon, rarity, category`. Public read (authenticated).
- `nexus_user_sigils` — `(user_id, sigil_code, source_operation_id?, source_run_id?, awarded_at)`, unique on `(user_id, sigil_code)`. Read-all (drives leaderboard glow); writes via RPC only.
- `nexus_displayed_sigil` — one row per user, references the sigil they want shown next to their name. User manages own.
- `nexus_salvage_wallet` — `(user_id, tokens, lifetime_earned)`. Read own; writes via RPC only.
- `nexus_boosts` — catalog: `code, name, description, cost_tokens, effect_json, category`. Public read.
- `nexus_run_boosts` — ledger linking spent boost → run. Read-all; writes via RPC.

**RPCs (all SECURITY DEFINER):**
- `set_displayed_sigil(_sigil_code)` — validates ownership, upserts.
- `spend_boost(_boost_code)` — debits wallet, inserts ledger row, returns `ledger_id`.
- `attach_run_boost(_ledger_id, _nexus_run_id)` — links a spent boost to its recorded run for the leaderboard `⚡` tag.
- `award_endless_milestone(_run_id)` — checks `waves_cleared` against 10/20/30 thresholds, awards sigils + tokens (1/2/3). Idempotent.
- `award_operation_rewards(_operation_id)` — only acts on `complete` ops. Walks contributors in rank order: Participation sigil + 1 token (one-time lifetime), Top-3 sigil + 1 bonus token, MVP (`siege_core` legendary) + 2 bonus tokens, Closer (last run submitter) + 1 token. Idempotent via per-op source tracking.

**Seeded data (inserts):**
- 7 sigils: `defender` (common), `phase_breaker` (rare), `endless_10` (common), `endless_20` (rare), `endless_30` (epic), `top3_contributor` (epic), `siege_core` (legendary), `closer` (legendary).
- 5 boosts: `overcharge_coil` (2 tok), `reinforced_plating` (2 tok), `field_salvage` (3 tok), `tactical_recon` (1 tok), `operation_focus` (3 tok).

### 2. Engine + Battle integration

`src/lib/nexus/engine.ts` — extend `InitBattleOptions` with `boost?: { code: string; effect: any }`. Apply small numeric overrides at init:
- `overcharge_coil`: multiply `modTowerDamageMult[*]` by 1.15 for first 30s (track via new `boostExpiresAtMs` field; revert on expiry tick).
- `reinforced_plating`: multiply `baseHp/baseHpMax` by 1.25; reduce passive energy trickle by 10%.
- `field_salvage`: pass through; results-screen reads boost code and awards `cores * 1.5`.
- `tactical_recon`: cosmetic — surfaces next 3 wave names on the battle HUD via a new prop.
- `operation_focus`: pass through; battle page multiplies `kills`/`score` sent to `submit_operation_contribution` by 1.25 (server validates by checking `nexus_run_boosts` ledger).

`src/pages/NexusBattlePage.tsx`:
- Read `?boost=<ledgerId>:<code>` from query params, pass to `initBattle`.
- After `recordNexusRun` resolves with `nexusRunId`, call `attach_run_boost(ledgerId, nexusRunId)`.
- After endless run records: invoke `award_endless_milestone(_run_id)`. Stash awarded sigil codes in sessionStorage for results panel.
- When `submitOperationContribution` returns `operation_complete: true`, also invoke `award_operation_rewards(operationId)` (fire-and-forget; idempotent).

### 3. Hook layer

New file `src/hooks/useNexusRewards.ts`:
- `useSalvageWallet()` — react-query, 30s stale, lazy-creates row.
- `useUserSigils(userId?)` — read all sigils + catalog joined.
- `useDisplayedSigil(userId)` — single sigil for display.
- `useBoostCatalog()` — boost catalog.
- `spendBoost(code)` / `setDisplayedSigil(code)` — mutations.
- `awardEndlessMilestone(runId)` / `awardOperationRewards(opId)` — RPC wrappers.

### 4. UI surfaces (Phase A scope)

**`NexusResultsPage.tsx`** — new "Rewards Earned" panel rendered below the Operation Contribution panel (or below Combat Telemetry on non-endless runs):
- Animated reveal with rarity-tinted glow border per sigil.
- "+N Salvage Tokens" with the existing `useCountUp` hook.
- If a boost was active: small chip "⚡ Boost: [name]".
- Reads from sessionStorage key `nexus_run_${id}` (extended with `rewards: { sigils: [...], tokens: number, boostCode?: string }`).

**`NexusLoadoutPage.tsx`** — new "Loadout Boost" section above the Deploy button:
- Shows wallet balance pill (`⬢ 5`).
- Horizontal scroll of boost cards with cost, name, short tagline.
- Tap to select (one allowed). Disabled with "Need N more" if under cost.
- On Deploy: if boost selected, call `spendBoost(code)` first, append `?boost=<ledgerId>:<code>` to battle URL.

**`NexusLeaderboardPage.tsx`**:
- Fetch displayed sigils for visible users in one batched query.
- Render displayed-sigil chip after the display name.
- Avatar gets a colored ring matching the displayed sigil's rarity (common: muted, rare: cyan pulse, epic: violet glow, legendary: animated amber gradient ring).
- Top-3 rows always render with the legendary amber ring during the active scope (overrides displayed sigil ring).
- Fetch run-boost map for the listed runs; show small `⚡` icon next to score if used.

**`NexusOperationPage.tsx`** — contributor list shows the user's displayed-sigil chip beside their name (small read of `nexus_displayed_sigil` for visible IDs).

**`NexusHUD.tsx`** — add a tiny salvage pill `⬢ N` between cores readout and the leaderboard button. On non-hub routes only. Tap shows a toast "Salvage: N tokens · spend on Loadout Boosts" (full Vault page comes in Phase B).

### 5. Sigil rarity styling

Add a small util `src/lib/nexus/sigilStyle.ts` returning `{ borderColor, glowColor, animation }` per rarity. Used by results panel, leaderboard avatar rings, and contributor chips so the look stays consistent.

### 6. What this pass does NOT touch

- Solo campaign flow, Cores economy, mission unlock progression
- Calibration, telemetry, modifier systems
- Engine internals beyond the small boost-config read
- Existing Op contribution formula (boost multiplier is server-validated and additive only)
- No new top-level Vault page — comes in Phase B

### Files

**New:**
- `supabase/migrations/<timestamp>_nexus_rewards_phase_a.sql` (schema + RPCs)
- migration insert via supabase tooling for sigil + boost seed rows
- `src/hooks/useNexusRewards.ts`
- `src/lib/nexus/sigilStyle.ts`

**Edited:**
- `src/lib/nexus/engine.ts` (boost integration in `initBattle` + boost-expiry tick)
- `src/lib/nexus/types.ts` (add `boost?` field on `BattleState`)
- `src/pages/NexusBattlePage.tsx` (read boost param, attach after run, fire awards)
- `src/pages/NexusResultsPage.tsx` (Rewards Earned panel)
- `src/pages/NexusLoadoutPage.tsx` (Loadout Boost picker)
- `src/pages/NexusLeaderboardPage.tsx` (sigil chips + glow rings)
- `src/pages/NexusOperationPage.tsx` (sigil chips on contributor list)
- `src/components/nexus/NexusHUD.tsx` (salvage pill)

### Approval checklist

After approval I'll: (1) run the schema migration, (2) seed sigils + boosts via insert tool, (3) wire engine + battle page, (4) ship the four UI surfaces, (5) smoke-test from Loadout → boost spend → battle → results sigil reveal → leaderboard glow.