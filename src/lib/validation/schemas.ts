/**
 * Shared Zod schemas for user-supplied content.
 *
 * Use these on any client form that creates/edits user content. Edge functions
 * that accept the same payloads should mirror these limits in Deno-Zod.
 *
 * Rules:
 *  - All free-text fields are length-bounded to defeat absurd payloads.
 *  - `.trim()` is applied so whitespace-only submissions don't pass.
 *  - Enum-like fields (statuses, visibility) live in their own schemas to
 *    keep them discoverable.
 */
import { z } from 'zod';

/** Generic short-name field (club, channel, topic, title). */
export const shortName = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(80, 'Too long (max 80 chars)');

/** Display name for a user profile. */
export const displayName = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(40, 'Too long (max 40 chars)');

/** Mid-length single-line description (e.g. event subtitle). */
export const tagline = z
  .string()
  .trim()
  .max(160, 'Too long (max 160 chars)')
  .optional()
  .or(z.literal(''));

/** Long-form body (post, comment, event description, draft topic). */
export const longBody = z
  .string()
  .trim()
  .max(8_000, 'Too long (max 8,000 chars)');

/** Required long-form body (post body). */
export const requiredLongBody = longBody.min(1, 'Required');

/** Comment / reply body (shorter ceiling than posts). */
export const commentBody = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(2_000, 'Too long (max 2,000 chars)');

/** Poll question. */
export const pollQuestion = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(160, 'Too long (max 160 chars)');

/** A single poll option. */
export const pollOption = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(80, 'Too long (max 80 chars)');

/** A single ranking item. */
export const rankingItem = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(120, 'Too long (max 120 chars)');

/** Invite/club join code (alphanumeric + dash, case-insensitive). */
export const joinCode = z
  .string()
  .trim()
  .min(4, 'Too short')
  .max(64, 'Too long')
  .regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers, and dashes only');

/** Plain URL (no javascript:, vbscript:, data:, etc.). */
export const safeUrl = z
  .string()
  .trim()
  .url('Invalid URL')
  .max(2_048, 'URL too long')
  .refine((u) => /^https?:\/\//i.test(u), 'Only http/https URLs allowed');

/** Helpers ---------------------------------------------------------------- */

/**
 * Parse with a schema and return either the validated value or the first
 * error message. Convenient for inline form validation without throwing.
 */
export function safeParse<T>(schema: z.ZodSchema<T>, value: unknown):
  | { ok: true; value: T }
  | { ok: false; error: string } {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid input' };
}
