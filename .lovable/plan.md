

# Rune Delve Home — Decluttering Pass

The home screen now has 12+ stacked tiles (Continue, Daily, Quests, Hero, Leaderboard, How-to-Play, Codex, Loadout, Shop, Armory, Bestiary, History, Hero link). Time to organize without losing access to anything.

## Goal

Reduce vertical scroll, group related entries, and keep the **Continue** + **Daily** + **Quests** trio (the daily ritual) prominent and untouched at the top.

## New layout (top → bottom)

```text
┌──────────────────────────────────────┐
│  CONTINUE BANNER  (chapter, CTA)     │   ← unchanged, hero of page
├──────────────────────────────────────┤
│  TODAY                               │   ← new section header
│  ┌──────────────┬──────────────┐     │
│  │ Daily ⭐⭐    │ Quests ⚑ 2   │     │   ← side-by-side compact tiles
│  └──────────────┴──────────────┘     │
├──────────────────────────────────────┤
│  HERO SNAPSHOT  (avatar + XP + lvl)  │   ← unchanged
├──────────────────────────────────────┤
│  CAMPAIGN LEADERS  (top 3 + you)     │   ← unchanged
├──────────────────────────────────────┤
│  ▾ Gear & Progression   (collapsed)  │   ← single collapsible group
│     · Active Loadout                 │
│     · Shop                           │
│     · Armory                         │
│     · Bestiary                       │
│     · History                        │
│     · Hero details                   │
├──────────────────────────────────────┤
│  ▾ Help & Reference     (collapsed)  │   ← single collapsible group
│     · How to Play                    │
│     · Codex                          │
└──────────────────────────────────────┘
```

Visible-on-load tiles drop from **12+ → 5**. Everything else is one tap away inside a labeled drawer.

## Design rules

- **Section headers**: tiny uppercase eyebrow (`TODAY`, `EXPLORE`, `REFERENCE`) with a thin divider — visually separates the daily ritual from utilities without adding chrome.
- **Daily + Quests**: collapsed into a 2-column compact pair under TODAY. Each shows just an icon, label, status badge (⭐⭐ / "2 ready"), and chevron. Modifier chips move into the Daily detail page (already exists). Saves ~140px.
- **Collapsible groups** ("Gear & Progression", "Help & Reference"): use the existing `Collapsible` primitive. Each group is a `glass-card` with a header row (icon + label + chevron that rotates on open). Persist open/closed state in `localStorage` per group so power users keep them open.
- **Inside collapsed groups**: list-style rows (icon · label · chevron), not separate cards — denser, scannable, mirrors how Settings screens work in iOS.
- **Hero snapshot + Leaderboard**: keep as-is. They are glanceable and earn their slot.
- Default state on first visit: both groups **collapsed** (clean first impression). Once a user opens a group, it stays open across sessions.

## Technical notes

- Single file edit: `src/pages/RuneDelveHomePage.tsx`.
- Add a small `<Section>` helper component (local to file) for the eyebrow + divider.
- Add a `<HomeGroup>` helper that wraps `Collapsible` + persists `open` state via `localStorage` key `rd_home_group_<id>`.
- Daily + Quests compact tiles: extract their content into a smaller card variant (icon row, single status line, no modifier chips). Move modifier chip preview to the Daily page header.
- Footer trio (Bestiary / History / Hero) and the Shop/Armory pair fold into the **Gear & Progression** group as list rows.
- How to Play + Codex pair folds into the **Help & Reference** group.
- No new dependencies; `@/components/ui/collapsible.tsx` is already available.
- No data/hook changes — pure presentational refactor.

