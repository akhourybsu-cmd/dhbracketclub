

# Premium Visual Overhaul Plan — DH Club

## Overview
Elevate DH Club from "polished dark app" to "luxury sports arena experience" across five dimensions: color refinement, motion design, micro-interactions, sound design, and visual texture. The goal is a feel comparable to premium apps like Apple Fitness+, Nike SNKRS, or ESPN's dark mode.

---

## 1. Color & Gradient Refinement

**What changes:**
- Introduce richer ambient glows with multi-color layering (primary blue + accent teal blended radials behind hero sections)
- Add a subtle warm highlight color (`--premium-warm: 28 80% 58%`) for gold accents on achievements and winners
- Upgrade card backgrounds with a faint noise/grain texture overlay for depth (CSS-only, no images)
- Refine the glass-card system: add a second inner highlight edge (bottom-left to top-right diagonal shine)
- Add animated gradient borders on focused/active cards using `conic-gradient` rotation

**Files:** `src/index.css`, `tailwind.config.ts`

---

## 2. Motion & Animation System Upgrade

**What changes:**
- **Page transitions**: Add route-level `AnimatePresence` with shared layout animations via Framer Motion so pages slide/fade between each other
- **Staggered list reveals**: All list sections (dashboard cards, ranking items, draft picks) animate in with cascading delays and spring physics
- **Card interactions**: Cards scale slightly on press (already have `btn-press`), add a subtle parallax tilt on hover (desktop) using CSS `perspective` + `rotateX/rotateY`
- **Number counting**: Stat values (leaderboard scores, pick counts) animate up from 0 using a counting animation
- **Confetti/particle burst**: On bracket submission, ranking submission, or draft completion — trigger a brief celebratory particle effect
- **Skeleton loading upgrade**: Replace flat shimmer with a wave-style shimmer that sweeps more dramatically

**Files:** `src/App.tsx` (route wrapper), `src/index.css`, `tailwind.config.ts`, `src/components/EnrichedItemCard.tsx`, new `src/components/PageTransition.tsx`, new `src/components/Confetti.tsx`

---

## 3. Sound Design System

**What changes:**
- Create a lightweight `useSoundEffect` hook that plays short audio cues using the Web Audio API (no external libraries needed)
- Sound events:
  - **Tap/select**: Soft click (bracket pick, poll vote, nav tap)
  - **Success**: Bright chime (bracket submitted, ranking saved, draft pick confirmed)
  - **Error**: Low thud (validation error)
  - **Achievement**: Ascending tone (completing a bracket, winning position)
  - **Draft turn notification**: Subtle alert ping when it's your turn
- All sounds generated programmatically via `OscillatorNode` + `GainNode` — no audio files needed
- Add a sound toggle in Profile settings (persisted to localStorage), defaulting to ON
- Respect `prefers-reduced-motion` — disable sounds when reduced motion is preferred

**Files:** New `src/hooks/useSoundEffect.ts`, `src/pages/ProfilePage.tsx` (settings toggle), integration points in `BracketEntryPage`, `DraftDetailPage`, `RankingDetailPage`, `PollDetailPage`, `AppLayout` (nav)

---

## 4. Premium Visual Textures & Polish

**What changes:**
- **Noise grain overlay**: Add a full-viewport CSS noise texture (tiny SVG data URI filter) at ~2% opacity for that premium matte feel
- **Frosted glass nav**: Upgrade mobile bottom nav and desktop sidebar with stronger glassmorphism (backdrop blur + saturation + subtle inner border glow)
- **Glowing active states**: Active nav items get a soft underglow animation, not just color change
- **Premium badge treatments**: Gold/Silver/Bronze rank badges get metallic gradient fills instead of flat semi-transparent backgrounds
- **Card hover lift**: Enhance existing `hover-lift` with a subtle ambient shadow color shift (blue-tinted shadow on hover)
- **Input focus glow**: Form inputs get a smooth primary-colored ring glow on focus
- **Championship mode glow**: Enhance the final round bracket with animated gold edge borders

**Files:** `src/index.css`, `src/components/AppLayout.tsx`, `src/components/EnrichedItemCard.tsx`

---

## 5. Micro-Interaction Details

**What changes:**
- **Pull-to-refresh feel**: Add a subtle scale bounce when data refreshes
- **Haptic-style feedback**: On mobile, use `navigator.vibrate` for short pulses on key actions (pick selection, submission) — with sound toggle controlling this too
- **Badge/pill animations**: Status pills animate in with a pop-scale when they change state
- **Scroll-linked effects**: Page header shrinks slightly and gains a border-bottom blur as user scrolls down
- **Toast upgrades**: Custom-styled sonner toasts with module-specific accent colors and icons (green for success, gold for achievements)

**Files:** `src/components/AppLayout.tsx`, `src/hooks/useSoundEffect.ts`, `src/components/ui/sonner.tsx`, integration across action pages

---

## Technical Approach

| Area | Method | Dependencies |
|------|--------|-------------|
| Page transitions | Framer Motion `AnimatePresence` + `motion.div` wrapper around `<Routes>` | Already installed |
| Sound effects | Web Audio API (`AudioContext`, `OscillatorNode`) | None — browser native |
| Noise texture | Inline SVG `<filter>` as CSS `background-image` data URI | None |
| Confetti | Lightweight canvas-based particle system (~50 lines) | None |
| Haptic feedback | `navigator.vibrate()` API | None — browser native |
| Animated gradients | CSS `@property` + `conic-gradient` | None |
| Number counting | Framer Motion `useMotionValue` + `useTransform` | Already installed |

No new npm packages required. Everything builds on existing Framer Motion + CSS capabilities.

---

## Implementation Order

1. Color & texture foundation (CSS variables, noise overlay, gradient upgrades)
2. Card & component visual polish (glass effects, metallic badges, input glows)
3. Sound design system (hook + integration)
4. Animation upgrades (page transitions, staggered reveals, confetti)
5. Micro-interactions (haptics, scroll-linked headers, toast styling)

