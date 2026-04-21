

## Fix relic upgrade RLS error

**Root cause**: `rune_delve_relic_unlocks` only has policies for SELECT and INSERT. The `useUpgradeRelic` mutation tries to UPDATE the `rank` column, but with no UPDATE policy, RLS blocks the write and returns 0 rows. `.single()` then throws "Cannot coerce the result to a single JSON object".

### Fix

**1. Migration — add UPDATE policy**

```sql
CREATE POLICY "Users update own relics"
ON public.rune_delve_relic_unlocks
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

Scoped to the owner only — users can only bump the rank on their own relics. Matches the pattern of the existing INSERT/SELECT policies.

**2. Defensive: swap `.single()` → `.maybeSingle()` in `useUpgradeRelic`**

In `src/hooks/useRelicCollection.ts`, change the update's `.single()` to `.maybeSingle()` and throw a clearer error if no row comes back. This way, any future RLS or row-mismatch issue surfaces as "Upgrade failed — please retry" instead of the cryptic Postgres coercion message.

### How we'll know it worked

- Tap an owned relic in the Shop → tap "Upgrade to R2" → toast confirms, rank pip fills to R2, shard balance drops by the cost.
- No "Cannot coerce…" error.
- Trying to upgrade someone else's relic (not possible from UI, but tested via direct query) is still blocked by RLS.

