

# Rune Delve — Fantasy Typography + Contrast Sweep

A focused polish pass that (1) audits Rune Delve for any dark-on-dark text, (2) lifts low-contrast labels to fantasy-readable levels, and (3) introduces a dedicated **fantasy display typeface** for titles, chapter names, hero names, level cues, and HUD identity — so Rune Delve reads like a real fantasy game inside DH Club.

## What you'll get

1. **A fantasy display font** (Cinzel — engraved Roman serif, perfect for arcane/dungeon titles) loaded alongside the existing Plus Jakarta Sans, scoped to Rune Delve only via a `.font-rd-display` utility and applied to display-level text. Body copy stays Plus Jakarta Sans for readability.
2. **Audited text contrast** — every Rune Delve text class lifted to a minimum of `text-foreground/80` (≈WCAG AA on `--rd-stone`). No more `/60`, `/65`, `/70` for primary information; secondary metadata moves to `/75`+. The `--muted-foreground` override in `.rd-mode` bumped from 64% → 70% lightness for an extra pass.
3. **Fixed "white-on-translucent" weak spots** — the Armory active class tab, the bonus-objective pill (`text-accent-foreground` white-on-translucent-teal which reads muddy), and the level-map "Next" pill all get explicit high-contrast pairings.
4. **Boot screen + HUD typography upgrade** — the "Rune Delve" boot title, chapter name, hero name in HUD, and chapter pills all use the new display font for a cohesive fantasy identity.

## Where the fantasy font is applied

| Surface | Element |
|---|---|
| Boot screen | "◆ Rune Delve ◆" eyebrow, chapter name title |
| HUD | Hero name |
| Home page | Chapter name title, "Forge your hero" header, hero name in snapshot card |
| Level Map | Chapter pills, "Chapter N" label |
| Hero page | Hero name, class title, cosmetic title |
| Results page | "Victory" / "Defeat" headline, level cleared title |
| Shop / Armory | Page titles, tier names |
| Leaderboard | "Campaign Leaders" title, hero names in rows |

Body copy, stats, numeric readouts, button labels, helper text, tooltips, and form fields all stay in Plus Jakarta Sans — the fantasy font is reserved for display moments so readability never suffers.

## Contrast fixes (specific)

- **`.rd-mode` muted-foreground**: 150 14% 64% → 150 14% 70%
- **Armory tab inactive state**: `text-foreground/85` → `text-foreground/95` + bump font weight to extrabold
- **Bonus pill on Play page**: change `color: var(--accent-foreground)` (white-on-teal-translucent) to high-contrast `hsl(var(--accent))` text on darker bg
- **Stat strip labels** (DMG/KILLS/CHAIN): `text-foreground/60` → `text-foreground/85`
- **Level map locked levels**: lift `text-muted-foreground` against locked dark tile from current to brighter helper
- **Relic card descriptions**: `text-muted-foreground` reads dim → use new lifted muted (auto-fixed by `.rd-mode` override)
- **Shop tier-locked subtext** + **Hero page passive/ability text**: dim secondary text bumped via the muted lift
- **Empty state text** in Armory ("No relics yet"): `text-foreground/70` → `text-foreground/90`

## Technical approach

- **`index.html`**: extend the Google Fonts preload/stylesheet to include `Cinzel:wght@500;600;700` — single extra family, ~12KB woff2.
- **`tailwind.config.ts`**: add `fontFamily.display: ['Cinzel', 'Plus Jakarta Sans', 'serif']` so we get a `font-display` utility (or use a `.font-rd-display` class to keep it scoped).
- **`src/index.css`**: add a `.font-rd-display` utility (`font-family: 'Cinzel', serif; letter-spacing: 0.01em`) and bump `.rd-mode { --muted-foreground: 150 14% 70%; }`. Add a small helper class `.rd-title` that combines display font + tight tracking + subtle text-shadow for headline use.
- **Page edits** — apply `font-rd-display` / `rd-title` to the specific headlines listed above; replace low-opacity foreground utilities with the lifted scale.

## Files

**Edited**
- `index.html` — add Cinzel to font link
- `tailwind.config.ts` — register `display` font family
- `src/index.css` — add `.font-rd-display` + `.rd-title` utilities, bump muted-foreground inside `.rd-mode`
- `src/components/runedelve/RuneDelveBoot.tsx` — title + eyebrow use display font
- `src/components/runedelve/RuneDelveHUD.tsx` — hero name uses display font
- `src/pages/RuneDelveHomePage.tsx` — chapter title, hero snapshot name, "Forge your hero" headline
- `src/pages/RuneDelveLevelMapPage.tsx` — chapter pills + page header
- `src/pages/RuneDelveHeroPage.tsx` — hero name, class title, cosmetic title; passive/ability contrast lift
- `src/pages/RuneDelvePlayPage.tsx` — bonus-pill contrast fix, stat-strip label lift
- `src/pages/RuneDelveResultsPage.tsx` — outcome headline, level title
- `src/pages/RuneDelveShopPage.tsx` — page title, tier-locked banner contrast
- `src/pages/RuneDelveArmoryPage.tsx` — page title, tab + empty-state contrast
- `src/pages/RuneDelveLeaderboardPage.tsx` — section title, hero names
- `src/components/runedelve/RelicCard.tsx` — relic name uses display font

## Out of scope

- No changes to gameplay, layout structure, or component composition.
- No font swap on body copy, stats, buttons, or helper text — only display moments.
- No changes outside `/rune-delve/*` — Cinzel is loaded globally (cheap) but only applied via the scoped utility.

