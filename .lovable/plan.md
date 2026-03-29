

# Rebrand to "DH" with Bold Monogram Logo & Green+Charcoal Palette

## Overview
Rename from "DH Club" / "DH Bracket Club" to just **"DH"** everywhere. Generate a new bold monogram logo using AI image generation. Shift the entire color palette from electric blue to **emerald green + charcoal**.

---

## Phase 1: Generate New Logo

Use the AI image generation skill to create a bold "DH" monogram:
- Prompt: Clean, bold typographic "DH" monogram, geometric and minimal, emerald green on transparent/dark background, suitable for app icon
- Generate at 512×512 for PWA icon and in-app use
- Save to `src/assets/dh-monogram.png` (overwrite), `public/pwa-icon-512.png`, `public/favicon.png`

## Phase 2: Color Palette — Green + Charcoal

Update all three theme blocks (`:root`, `.dark`, `.light`) in `src/index.css`:

| Token | Old (blue) | New (green) |
|-------|-----------|-------------|
| `--primary` | `217 91% 60%` | `152 72% 46%` |
| `--primary-glow` | `217 100% 72%` | `152 80% 56%` |
| `--ring` | `217 91% 60%` | `152 72% 46%` |
| `--background` | `225 28% 4%` | `160 10% 5%` |
| `--card` | `225 20% 8%` | `160 8% 8%` |
| `--secondary` | `225 16% 12%` | `160 8% 12%` |
| `--muted` | `225 16% 14%` | `160 8% 14%` |
| `--border` | `225 14% 13%` | `160 8% 13%` |
| `--input` | `225 16% 11%` | `160 8% 11%` |
| `--surface*` | `225 xx% xx%` | `160 xx% xx%` |

Update all gradient tokens, shadow-glow references, and sidebar tokens to use green hues (152°) instead of blue (217°). Update `.light` mode equivalents similarly.

Update `index.html` and `vite.config.ts` theme_color to new charcoal hex value (~`#0D100E`).

## Phase 3: Rename All Text References

Across ~12 files, replace:

| Old | New |
|-----|-----|
| `DH Bracket Club` | `DH` |
| `DH Club` | `DH` |
| `<span>DH</span><span> Club</span>` | `DH` (single element) |
| `Private Social Hub` | `Compete With Your Crew` |
| `DH Club Member` | `DH Member` |
| `Manage your DH Club account` | `Manage your DH account` |

**Files to update:**
- `src/pages/LandingPage.tsx` — header, hero brand text
- `src/pages/AuthPage.tsx` — logo alt text, title
- `src/pages/ResetPasswordPage.tsx` — logo alt, title
- `src/pages/DashboardPage.tsx` — hero logo, welcome text
- `src/pages/ProfilePage.tsx` — subtitle, footer branding
- `src/pages/NotFound.tsx` — alt text
- `src/components/AppLayout.tsx` — sidebar branding (line 116-120)
- `index.html` — `<title>`, OG/Twitter meta tags
- `vite.config.ts` — PWA manifest `name`, `short_name`, `description`
- `supabase/functions/suggest-items/index.ts` — system prompt reference

## Phase 4: Landing Page Glow Updates

Update inline `style` gradients in `LandingPage.tsx` and `AuthPage.tsx` from blue (`217`) to green (`152`) hue values to match the new palette.

## Technical Notes
- All CSS variable changes cascade automatically through `hsl(var(--primary))` usage in Tailwind
- No database, backend, or structural changes needed
- The import name `dhMonogram` stays the same (just the file content changes)
- Logo generation uses `google/gemini-3.1-flash-image-preview` via the AI gateway skill

