

## Drafts — let non-competitors spectate playoff matchups

### What's already true (and what isn't)

Good news: any signed-in member can already open `/drafts/:id` for any draft, including playoff matches. RLS is open and the detail page renders for everyone. The pick-history, results, podium, and report sections already display fine for non-participants.

The actual gaps for the playoff use case:

1. **Setup-phase playoff drafts show a "Join Draft" button to non-participants.** A spectator could accidentally insert themselves into, say, a Semifinal between the #2 and #3 seeds and break the bracket.
2. **No "Spectating" framing.** A non-competitor opening a live playoff draft sees the same "Waiting for [other player]" banner the competitors see, with no signal that they're watching a match they aren't in.
3. **No discovery surface for playoff matches** beyond the bracket on the Compete page. That's actually fine — but the bracket's "Open Draft" link should be the canonical entry point and should always work for everyone (it does).

### Fix (small, surgical)

**A) Suppress the Join Draft button on playoff drafts.**
- In `DraftDetailPage`, derive `isPlayoffDraft` from `seasonEntries` (already loaded via `useSeasonEntries(season?.id)`) — `seasonEntries.find(e => e.draft_id === draftId)?.is_playoff === true`.
- Only render the "Join Draft" button when `!isParticipant && user && !isPlayoffDraft`. Regular drafts keep the open join behavior; playoff matchups are competitor-locked.

**B) Add a clear "Spectating" badge for non-participants on any draft.**
- Below the topic header, when `!isParticipant && user`, render a small pill: "👁 Spectating" (muted styling, no glow). One-line addition near the season badge area around line 770.
- For playoff drafts specifically, the pill reads: "👁 Spectating Playoff Match".

**C) Soften the live-turn banner for spectators.**
- The current "Waiting for [Name]" copy is correct, but for spectators we make the banner non-arena (no edge glow even when reading the host's own draft) — already true since `arena-edge` is gated on `isMyTurn`. No change needed; just verifying.
- Hide the report-trigger CTA for non-participants when the draft is complete (line 1352 already gates `isParticipant && !autoTriggered`). Verified — no change needed.

**D) Spectator-safe pick history.**
- The pick-list already hides edit/repick buttons for non-participants who aren't `canManage` (line 1031: `(canManage || pick.user_id === user?.id)`). Verified — no change needed.
- Dispute button is already gated to `isParticipant` (line 1260). Verified — no change needed.

### What this does NOT change

- **No RLS changes.** Reads were already open to all authenticated members.
- **No new routes.** Spectators use the existing `/drafts/:id` page.
- **No discovery feed changes.** The Compete page playoff bracket and the Drafts list both already link out to detail; spectators click in the same way competitors do.
- **No effect on regular (non-playoff) drafts** — Join button stays.

### Files touched

- `src/pages/DraftDetailPage.tsx`
  - Compute `isPlayoffDraft = !!seasonEntry?.is_playoff`.
  - Wrap the existing `!isParticipant && user` Join button in `&& !isPlayoffDraft`.
  - Add a spectator pill under the season badge when `!isParticipant && user`, with playoff-aware copy.

### Verification

- Open a playoff Semifinal draft as a non-competitor → no Join button, "👁 Spectating Playoff Match" pill, full read-only access to picks/timer/results.
- Open the same draft as one of the seeded competitors → no pill, normal pick UX.
- Open a regular (non-playoff) draft as a non-participant → Join button still appears, pill reads "👁 Spectating".
- Bracket "Open Draft" link from Compete page → opens correctly for any signed-in member.

