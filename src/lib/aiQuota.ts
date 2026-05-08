/**
 * Friendly user-facing message for AI rate-limit (HTTP 429) responses
 * coming back from supabase.functions.invoke.
 *
 * supabase-js surfaces non-2xx as a FunctionsHttpError; the parsed body is
 * usually still present on `data`. We check both shapes defensively.
 */
export function isAiRateLimited(data: unknown, error: unknown): boolean {
  if (data && typeof data === 'object' && (data as any).error === 'Rate limit reached') return true;
  const msg = (error as any)?.message || '';
  if (typeof msg === 'string' && msg.toLowerCase().includes('rate limit')) return true;
  const status = (error as any)?.context?.response?.status;
  if (status === 429) return true;
  return false;
}

export const AI_RATE_LIMIT_MESSAGE = "You've hit the AI helper limit for now. Try again in a bit.";
