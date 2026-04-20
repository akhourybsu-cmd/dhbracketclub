

## Rune Delve — clarity, diagonals, instructions, input polish

### Issues confirmed

**1. "Game ended after killing one enemy" (perception bug)**
DB inspection of the user's run shows: `enemies_defeated=1, turns_used=10, dungeon_cleared=false`. The run actually exhausted all 10 turns — it did NOT trigger an early clear. The bug is **UX**: the game silently navigates to results with no "Out of turns" / "Defeat" moment, so it feels like the kill ended the run. There is no end-of-run confirmation screen, no animation, no message.

**2. Diagonal chains not allowed** — `boardEngine.isAdjacent` enforces orthogonal-only (`dr + dc === 1`).

**3. No in-game instructions** — Home page has a tiny "Today's objective" line; nothing teaches rune meanings, classes, abilities, scoring, or controls.

**4. Input feel** — works, but no audio feedback on add, no clear "released too short" toast, no visual chain trail between connected runes.

---

### Fixes

**A. End-of-run clarity (`RuneDelvePlayPage.tsx`)**
- Replace silent auto-navigate with a brief in-page **"Run Complete" overlay** showing one of three outcomes: "Dungeon Cleared!", "Defeated!", or "Out of Turns" with final stats and a "View Results" button. Auto-advance after 2.5s OR on tap.
- Fix the turn counter math so it never reads `Turn 11/10` and shows `Turn X/10` correctly through the final move.

**B. Diagonal chains (`src/lib/runedelve/boardEngine.ts`)**
- Change `isAdjacent` to allow 8-direction adjacency: `dr <= 1 && dc <= 1 && (dr+dc) > 0`. Update the inline comment.
- No DB or scoring changes needed — chains just become easier to form, which the new How-To-Play page will explain.

**C. New "How to Play" sheet (`src/components/runedelve/HowToPlaySheet.tsx`)**
- Mobile-first bottom Sheet (uses existing shadcn `Sheet`) with collapsible sections:
  - **Goal** — defeat enemies in 10 turns, score points
  - **Controls** — drag through 3+ matching runes (orthogonal OR diagonal), release to resolve
  - **Rune Colors** — Red ⚔️ Attack, Blue 💧 Mana, Green 🌿 Heal, Gold 🛡️ Guard, with damage/heal scaling formulas
  - **Your Class** — passive + ability (rendered dynamically from `classConfig` for the user's class)
  - **Scoring** — exact formula breakdown
  - **Streaks & XP** — how progression works (cosmetic only, fairness preserved)
- Trigger: a prominent "How to Play" button on `RuneDelveHomePage` AND a small (?) icon top-right on `RuneDelvePlayPage`.
- First-time auto-open: if `localStorage.rune_delve_seen_help` is falsy, auto-open on first Home visit and set the flag.

**D. Input feel polish (`RuneBoard.tsx` + `RuneCell.tsx`)**
- Slightly stronger haptic on each new rune added (already 8ms → bump to 12ms; add a sharper 25ms vibration on release for valid chain).
- Add a subtle scale + glow pulse on each cell as it joins the chain (Framer Motion `whileTap`-style, already partially there — strengthen).
- Show the chain effect preview live above the board: e.g. "🔴 Attack · 24 dmg" updating as user drags, so input feels reactive.
- Toast a friendly "Need 3+ runes" only when user releases a 1- or 2-rune drag (avoids silent dead-input feeling).
- Add a soft "click" sound via existing `useSoundEffect` on each cell add, and a "success" tone on a valid release.

---

### Files touched

| File | Change |
|---|---|
| `src/lib/runedelve/boardEngine.ts` | `isAdjacent` → 8-direction |
| `src/components/runedelve/RuneBoard.tsx` | Live chain-preview label, stronger haptics, sound hooks, "need 3+" toast on short release |
| `src/components/runedelve/RuneCell.tsx` | Stronger selected-state animation |
| `src/components/runedelve/HowToPlaySheet.tsx` | **New** — mobile bottom sheet with full instructions |
| `src/pages/RuneDelveHomePage.tsx` | "How to Play" CTA + first-visit auto-open |
| `src/pages/RuneDelvePlayPage.tsx` | (?) help icon, end-of-run overlay with outcome label, fixed turn counter |

### Out of scope
- No DB schema changes.
- No scoring formula changes (diagonals don't change scoring math).
- No combat-engine logic changes — the original "completed after 1 kill" report was a UX perception issue, not a logic bug (verified via DB).

### Manual test checklist
- Drag a diagonal 3-chain → resolves correctly.
- Release a 2-rune drag → friendly "Need 3+" toast, no submit.
- Finish a run by exhausting turns → "Out of Turns" overlay, then results.
- Finish by defeating all enemies → "Dungeon Cleared!" overlay with confetti hand-off.
- First visit to `/rune-delve` opens How-to-Play once, never again.
- Open How-to-Play from play page (?) icon — pauses no state, dismisses cleanly.

