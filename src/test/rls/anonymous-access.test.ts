/**
 * RLS Guard Suite — anonymous access
 *
 * Hits the live Lovable Cloud backend with the publishable (anon) key and
 * asserts that anonymous callers are blocked from reading or writing
 * sensitive tables. This is a regression net for the privacy matrix in
 * `docs/PRIVACY_MATRIX.md`.
 *
 * Notes on Postgres RLS semantics:
 *  - SELECT under RLS returns an empty result set when no policy matches —
 *    it does NOT raise an error. So we assert `data.length === 0`.
 *  - INSERT/UPDATE/DELETE return an error (`42501`/RLS violation) when no
 *    policy permits the operation.
 *
 * If a test fails, the policy on that table changed in a way that exposes
 * data to anonymous users. Update the policy, the matrix, AND this test.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wnurxuvwljjbwmtoeqnm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudXJ4dXZ3bGpqYndtdG9lcW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjYwNzIsImV4cCI6MjA4OTIwMjA3Mn0.XH-Bjn-RuCC7q2YJI-F9m4McBwE5aSZyRJcZMzI0vuc";

// Tables that MUST return zero rows for an anonymous reader.
// Public-by-design tables (profiles, nexus_sigils, etc.) are intentionally absent.
const ANON_READ_DENIED = [
  "messages",
  "channels",
  "channel_categories",
  "channel_read_states",
  "drafts",
  "draft_picks",
  "draft_participants",
  "draft_results",
  "draft_pick_disputes",
  "events",
  "event_rsvps",
  "event_comments",
  "polls",
  "poll_votes",
  "posts",
  "post_comments",
  "rankings",
  "ranking_submissions",
  "lockbox_locks",
  "lockbox_guesses",
  "lockbox_attempts",
  "lockbox_scores",
  "notification_preferences",
  "push_subscriptions",
  "invite_codes",
  "club_members",
  "admin_audit_log",
  "admin_notes",
  "nfl_picks",
  "pw_entries",
  "pw_picks",
] as const;

// Tables anon MUST NOT insert into. We send a syntactically-valid-ish payload;
// RLS should reject before any constraint check matters.
const ANON_WRITE_DENIED: Array<{ table: string; row: Record<string, unknown> }> = [
  { table: "messages", row: { channel_id: "00000000-0000-0000-0000-000000000000", user_id: "00000000-0000-0000-0000-000000000000", content: "rls-test" } },
  { table: "posts", row: { user_id: "00000000-0000-0000-0000-000000000000", body: "rls-test" } },
  { table: "polls", row: { created_by: "00000000-0000-0000-0000-000000000000", question: "rls-test" } },
  { table: "drafts", row: { creator_id: "00000000-0000-0000-0000-000000000000", title: "rls-test" } },
  { table: "events", row: { created_by: "00000000-0000-0000-0000-000000000000", title: "rls-test" } },
  { table: "invite_codes", row: { code: "RLS-TEST-XYZ", created_by: "00000000-0000-0000-0000-000000000000" } },
  { table: "club_members", row: { club_id: "00000000-0000-0000-0000-000000000000", user_id: "00000000-0000-0000-0000-000000000000", role: "member" } },
  { table: "user_roles", row: { user_id: "00000000-0000-0000-0000-000000000000", role: "admin" } },
  { table: "admin_audit_log", row: { actor_id: "00000000-0000-0000-0000-000000000000", action: "rls-test" } },
  { table: "notification_preferences", row: { user_id: "00000000-0000-0000-0000-000000000000" } },
  { table: "push_subscriptions", row: { user_id: "00000000-0000-0000-0000-000000000000", endpoint: "https://example.com/x", p256dh: "x", auth: "x" } },
  { table: "profiles", row: { id: "00000000-0000-0000-0000-000000000000", display_name: "rls-test" } },
];

let anon: SupabaseClient;

beforeAll(() => {
  anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

describe("RLS — anonymous SELECT returns empty", () => {
  for (const table of ANON_READ_DENIED) {
    it(`${table}: anon sees no rows`, async () => {
      const { data, error } = await anon.from(table).select("*").limit(5);
      // We tolerate either an explicit error OR an empty result set.
      if (error) {
        // Acceptable: permission-denied style error.
        expect(error.code === "42501" || error.message.toLowerCase().includes("permission")).toBe(true);
        return;
      }
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBe(0);
    }, 15_000);
  }
});

describe("RLS — anonymous INSERT is blocked", () => {
  for (const { table, row } of ANON_WRITE_DENIED) {
    it(`${table}: anon insert rejected`, async () => {
      const { data, error } = await anon.from(table).insert(row as never).select();
      // Insert MUST fail. Either an RLS violation (42501) or any error is acceptable;
      // what is NOT acceptable is a successful insert returning data.
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    }, 15_000);
  }
});
