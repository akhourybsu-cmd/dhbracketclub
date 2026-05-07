/**
 * Chat attachment helpers — supports legacy public URLs and new private bucket
 * with on-demand signed URLs (cached in memory).
 *
 * Sentinel scheme for private attachments stored inside message content:
 *   lovable-private://chat-attachments-private/<storage-path>
 *
 * Legacy messages keep using the original Supabase public URL untouched.
 */
import { supabase } from '@/integrations/supabase/client';

export const PRIVATE_BUCKET = 'chat-attachments-private';
export const PRIVATE_URL_PREFIX = `lovable-private://${PRIVATE_BUCKET}/`;
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_BEFORE_MS = 5 * 60 * 1000; // refresh when within 5 min of expiry

type CacheEntry = { url: string; expiresAt: number; inflight?: Promise<string | null> };
const cache = new Map<string, CacheEntry>();

export function isPrivateAttachmentUrl(url: string): boolean {
  return url.startsWith(PRIVATE_URL_PREFIX);
}

export function pathFromPrivateUrl(url: string): string | null {
  if (!isPrivateAttachmentUrl(url)) return null;
  return url.slice(PRIVATE_URL_PREFIX.length);
}

export function buildPrivateAttachmentUrl(path: string): string {
  return `${PRIVATE_URL_PREFIX}${path}`;
}

/**
 * Resolve a chat attachment URL for rendering.
 *  - Legacy public URLs → returned unchanged.
 *  - Private sentinel URLs → resolved to a short-lived signed URL (cached).
 *  - Returns null if signing fails (caller can show error/retry state).
 */
export async function resolveAttachmentUrl(url: string): Promise<string | null> {
  if (!isPrivateAttachmentUrl(url)) return url;
  const path = pathFromPrivateUrl(url);
  if (!path) return null;

  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt - now > REFRESH_BEFORE_MS) {
    return cached.url;
  }
  if (cached?.inflight) return cached.inflight;

  const inflight = (async () => {
    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      cache.delete(path);
      return null;
    }
    cache.set(path, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    });
    return data.signedUrl;
  })();

  cache.set(path, { url: cached?.url ?? '', expiresAt: cached?.expiresAt ?? 0, inflight });
  const result = await inflight;
  const entry = cache.get(path);
  if (entry) delete entry.inflight;
  return result;
}

/** Force-invalidate a cached signed URL (e.g. after a 403 from CDN). */
export function invalidateAttachmentUrl(url: string) {
  const path = pathFromPrivateUrl(url);
  if (path) cache.delete(path);
}
