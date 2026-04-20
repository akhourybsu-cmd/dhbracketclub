

## Root cause: missing foreign keys to `profiles`

The lore tables have **zero foreign keys** in the DB. The hooks query embedded relationships:
- `useLoreContributions`: `select('*, profiles:user_id(...)')`
- `useLoreEntries`: `select('*, profiles:created_by(...), reactions:lore_reactions(...), contributions:lore_contributions(count)')`
- `useLoreEntry`: same embedding

Without FKs, PostgREST returns `PGRST200` (relationship not found). On INSERT with `.select('*, profiles:user_id(...)')`, the row IS inserted but the response errors → `mutateAsync` throws → toast says "Could not save" → user perceives it as broken.

This explains why the first user can't add contributions, and likely why the entries list/detail also misbehave.

## Fix (single migration)

Add the missing FKs so PostgREST can embed:

```sql
alter table public.lore_entries
  add constraint lore_entries_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete cascade;

alter table public.lore_contributions
  add constraint lore_contributions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade,
  add constraint lore_contributions_lore_id_fkey
  foreign key (lore_id) references public.lore_entries(id) on delete cascade;

alter table public.lore_reactions
  add constraint lore_reactions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade,
  add constraint lore_reactions_lore_id_fkey
  foreign key (lore_id) references public.lore_entries(id) on delete cascade;
```

Cascade deletes ensure removing a lore entry or user cleans up contributions/reactions.

## Out of scope
- No code changes needed — hooks already use the correct embed syntax; they just need the DB to expose the relationships.
- No RLS changes — policies are already correct.

