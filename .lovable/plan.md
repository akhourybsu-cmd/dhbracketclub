

# Comprehensive Mobile App Audit Report

## Overall Assessment
The app is well-architected with strong mobile-first patterns: safe-area handling, dynamic viewport heights, keyboard-aware nav hiding, and a cohesive design system. However, there are several issues that affect professionalism and functionality.

## Issues Found

### 1. Text Overflow / Truncation Issues
- **DraftDetailPage line 1192-1199**: The participant name + streak badge row uses `truncate` on a flex container with inline elements, which can cause the streak badge to get clipped on narrow screens (390px viewport)
- **CompetePage standings table**: The standings card rows pack rank, name, stats, and expand chevron tightly — on narrow viewports the stats text can overflow
- **DashboardPage line 574**: Draft topic text uses `truncate` correctly, but the status pill + dismiss button can push the text container too narrow

### 2. Missing `min-w-0` Flex Containment
Several flex rows rely on `truncate` but the parent flex item lacks `min-w-0`, which means `truncate` won't work on some browsers:
- `DraftDetailPage` line 1191: result row name container
- `CompetePage` standings rows
- Activity feed items in DashboardPage

### 3. Inconsistent Touch Targets
- **DraftDetailPage** dispute Flag button (line 1261-1268): `p-1.5` = 30px touch target, below the 44px minimum recommended for mobile. Same issue with dismiss X buttons throughout DashboardPage
- Pick edit/delete icons on draft picks may be too small for comfortable mobile tapping

### 4. Light Mode Polish Issues
- The `light` class CSS defines its own color palette but several inline `style=` attributes use hardcoded HSL values from dark mode assumptions (e.g., `hsl(var(--gold) / 0.15)`) — these generally work but some contrast ratios may be weak in light mode
- The noise grain overlay is dark-mode only (correct), but the `body::before` z-index of 9999 could interfere with modals in edge cases

### 5. Chat Page Keyboard Handling
- The chat viewport calculation (line 45-48) subtracts `72px` for the bottom nav when keyboard is closed. If the nav height changes (e.g., safe area variations), this could cause a small gap or overlap. The nav is actually `4rem` (64px) + safe area, not exactly 72px.

### 6. Accessibility Gaps
- Several interactive elements use `<div>` or `<span>` without `role="button"` or keyboard handlers (e.g., standings row expand, result expand in DraftDetailPage)
- Missing `aria-label` on icon-only buttons (Flag, X dismiss, edit/delete icons)

### 7. Empty State Handling
- FeedPage and EventsPage show loading skeletons but if the fetch returns empty data, the empty state could be more polished
- No pull-to-refresh pattern on any page (common mobile expectation)

### 8. Performance Concerns
- DashboardPage is 766 lines with 6+ parallel Supabase queries on mount — could benefit from query batching or waterfall prevention
- `AnimatePresence` with `key={location.pathname}` on all routes means every navigation triggers exit/enter animations, which can feel sluggish on low-end devices

## Fixes to Apply

### Priority 1 — Visual Bugs (Affects Professionalism)
1. **Add `min-w-0` to all flex text containers** that use `truncate` — prevents text overflow on narrow screens
2. **Increase touch targets** on Flag, dismiss, and edit buttons to minimum 44px
3. **Fix chat height calculation** to use actual nav height (4.5rem) instead of hardcoded 72px

### Priority 2 — Accessibility
4. **Add `aria-label` props** to icon-only buttons (Flag, X, edit, delete)
5. **Add keyboard handlers** to clickable divs that expand/collapse content

### Priority 3 — Polish
6. **Improve empty states** on Feed and Events pages with illustrations/CTAs
7. **Ensure light mode contrast** is adequate for all inline-styled elements

## Files to Modify
1. `src/pages/DraftDetailPage.tsx` — flex containment, touch targets, aria labels
2. `src/pages/DashboardPage.tsx` — flex containment, touch targets
3. `src/pages/CompetePage.tsx` — standings overflow fix, touch targets
4. `src/pages/ChatPage.tsx` — fix nav height constant
5. `src/pages/FeedPage.tsx` — empty state polish
6. `src/pages/EventsPage.tsx` — empty state polish

