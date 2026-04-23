

## Playoff Drafts — tournament-grade visual treatment

Make playoff drafts impossible to mistake for a regular draft. Right now the only signal a draft is a playoff match is a small gold "Season Draft #N" pill on the detail page — every other surface (Drafts list, Dashboard, header chrome) treats it identically to a freeform draft. We'll layer in a distinctive **Tournament** visual identity that scales from list rows up to the full detail header.

### Visual language

A new "Tournament" treatment built on the existing palette so it stays on-brand:
- **Primary accent**: gold (`hsl(var(--gold))`) — already the league color — paired with a deeper amber gradient stop to push contrast vs regular drafts.
- **Accent shape**: a rotated `Trophy`/`Swords` icon and a tournament-bracket motif (✦ + chevron rails) used only on playoff drafts.
- **Glow + edge**: amber outer glow (`box-shadow: 0 0 18px hsl(45 93% 52% / 0.25)`) + a 2px gold left border on cards, plus the existing `arena-edge` shimmer reused with the gold variant (`var(--gradient-arena-edge-gold)`).
- **Round-aware label**: every pill that says "Setup / In Progress / Complete" gets a leading round chip — `PLAY-IN`, `SEMIFINAL`, `FINALS G1/G2/G3`, `BRONZE`. Pulled from `playoff_round` + `match_number` on `draft_playoff_matches`.

### Where it shows up

**1) `DraftsListPage.tsx` — list rows**
- Add `playoffMatchByDraft` lookup (one query: `draft_playoff_matches` filtered to `draft_id I