

# Rune Delve — Bonus Move Rebalance

## Where we are now

```ts
const BONUS_MOVE_THRESHOLD = 6;
const grantsBonusMove = chain.length >= 6 && enemiesAlive;
```

Every chain of 6+ grants a free turn — no retaliation, no corruption spread, no turn consumed. Your instinct is right: this overcorrects. A skilled player who finds 6-chains repeatedly can string together 3–4 free turns in a row and walk through bosses untouched.

## Your two options, evaluated

**Option A — "One bonus per round, only on 6/7/8+ chains"**
Cap to **one bonus move per enemy turn cycle**. First 6+ chain in a turn cycle grants the free move; subsequent 6+ chains the same cycle do not.
- **Pro**: Simple to reason about. Still rewarding when you find the chain. Hard ceiling on snowball.
- **Con**: Slightly punishing for players who find back-to-back 6-chains by skill, not luck. The "one per cycle" framing is also a bit invisible — players won't know why their second big chain didn't grant a bonus unless we surface it.

**Option B — "Every 3 chains of 6+ grants 1 bonus"**
Track a counter; every 3rd 6+ chain grants a bonus move.
- **Pro**: Rewards consistency over the whole run.
- **Con**: Feels disconnected from the moment ("why did *that* one grant a bonus?"). Counter-based mechanics in puzzle games tend to feel arbitrary unless the counter is always visible on screen — adding HUD complexity for a small payoff.

## My recommendation — a hybrid that's better than both

**Raise the threshold AND cap to one per cycle, with a tier bonus.**

| Chain length | Effect |
|---|---|
| 6 | +20% damage on this chain (no free turn) |
| 7 | +30% damage **+ free turn** (max 1 per enemy cycle) |
| 8+ | +40% damage **+ free turn** (max 1 per enemy cycle) |

### Why this works better than A or B alone

1. **6-chains still feel rewarding** — you get a damage spike — but they no longer skip enemy turns. This is where Option A fairly punishes "lucky" 6-chains today.
2. **7+ becomes the real "I broke the encounter" moment** — and it's appropriately rare on a 5×5 board. Telemetry from the analytics page will confirm but a 7+ chain typically requires deliberate setup, not RNG.
3. **Cap of 1 per enemy cycle** prevents the snowball where one big chain begets another with no consequences. After you take your bonus turn, the next 7+ that cycle just hits hard — it doesn't *also* skip retaliation.
4. **Reads naturally on screen** — "Chain ×7 — Bonus move!" already exists. We just suppress it on chain-6 and on the second 7+ in the same cycle, with a clear log line ("Massive chain — extra damage!").

### Expected impact on difficulty

Right now I'd estimate the bonus-move mechanic is worth ~15–25% of effective HP on hard levels (8/16/25). This change cuts that to ~6–10% — meaningful reward, no longer game-breaking. Late-game bosses go back to feeling like a real threshold rather than a victory lap.

## Implementation

Single file: `src/pages/RuneDelvePlayPage.tsx`.

1. Replace the constant with a tier helper:
   ```ts
   const tierFor = (len: number) => len >= 8 ? { dmgMult: 1.4, bonus: true }
                                  : len >= 7 ? { dmgMult: 1.3, bonus: true }
                                  : len >= 6 ? { dmgMult: 1.2, bonus: false }
                                  : { dmgMult: 1, bonus: false };
   ```
2. Add per-cycle state: `const [bonusUsedThisCycle, setBonusUsedThisCycle] = useState(false);`. Set `true` when a bonus move triggers; reset to `false` whenever the enemy phase actually runs.
3. `grantsBonusMove = tier.bonus && !bonusUsedThisCycle && enemiesAlive`.
4. When `tier.dmgMult > 1` and the chain is red, scale `resolution.damageDealt` (and the enemy HP delta) by `tier.dmgMult` — or pipe it through the existing `applyChain` path via a `chainDamageMult` arg if cleaner. Round to whole HP.
5. Log lines:
   - `tier.bonus && grantsBonusMove`: "Chain x{n} — bonus move!" (existing)
   - `tier.bonus && !grantsBonusMove`: "Chain x{n} — massive damage! (bonus already used this cycle)"
   - `len === 6`: "Chain x6 — heavy strike!"
6. Toast only on bonus moves and on 8+ chains, to avoid noise.

## What I'm NOT changing

- No relic, class, scoring, or DB changes.
- No HUD additions — all feedback flows through the existing turn log + toasts.
- Bonus-move corruption-hold and seal-tick behavior stay identical when a bonus *does* fire.

## How we'll know it worked

- Hard-level (15+) clear rates trend down to a healthier band — we can verify in the analytics hub.
- 7+ chains feel like a genuine "moment", not a routine occurrence.
- No more reports of "I cleared boss without taking a hit by chaining 6s back-to-back".

