import { toast } from 'sonner';

// ─── Content Types ───
export type ShareableContentType =
  | 'ranking'
  | 'poll'
  | 'draft'
  | 'bracket'
  | 'event'
  | 'post'
  | 'pool';

interface ShareContentConfig {
  label: string;
  pathPrefix: string;
  verb: string;
}

const CONTENT_CONFIG: Record<ShareableContentType, ShareContentConfig> = {
  ranking:  { label: 'Ranking',    pathPrefix: '/rankings',              verb: 'Check out this ranking' },
  poll:     { label: 'Poll',       pathPrefix: '/polls',                 verb: 'Vote in this poll' },
  draft:    { label: 'Draft',      pathPrefix: '/drafts',                verb: 'Join this draft' },
  bracket:  { label: 'Bracket',    pathPrefix: '/pools',                 verb: 'Check out this bracket' },
  event:    { label: 'Event',      pathPrefix: '/events',                verb: 'Check out this event' },
  post:     { label: 'Post',       pathPrefix: '/posts',                 verb: 'Check out this post' },
  pool:     { label: 'Pool',       pathPrefix: '/pools',                 verb: 'Join this bracket pool' },
};

// ─── Link Generation ───
// Canonical public origin. Update if you change the primary custom domain.
const PUBLISHED_ORIGIN = 'https://dryhorse.app';

function getShareOrigin(): string {
  // Always use the published URL for share links so recipients
  // never land on preview/dev domains or old cached versions
  return PUBLISHED_ORIGIN;
}

export function generateShareLink(
  contentType: ShareableContentType,
  id: string,
  extra?: { poolId?: string }
): string {
  const base = getShareOrigin();
  if (contentType === 'bracket' && extra?.poolId) {
    return `${base}/pools/${extra.poolId}/bracket/${id}`;
  }
  const config = CONTENT_CONFIG[contentType];
  return `${base}${config.pathPrefix}/${id}`;
}

// ─── Share Text Generation ───
export function generateShareText(
  contentType: ShareableContentType,
  title: string,
  _description?: string
): string {
  const config = CONTENT_CONFIG[contentType];
  return `${config.verb} on DH Club: ${title}`;
}

// ─── Share Payload ───
export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export function buildSharePayload(
  contentType: ShareableContentType,
  id: string,
  title: string,
  options?: { description?: string; poolId?: string }
): SharePayload {
  const url = generateShareLink(contentType, id, options);
  const text = generateShareText(contentType, title, options?.description);
  return { title: `${CONTENT_CONFIG[contentType].label}: ${title}`, text, url };
}

// ─── Native Share / Fallback ───
export async function shareContent(payload: SharePayload): Promise<'shared' | 'copied' | 'failed'> {
  // Try native share sheet
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (err: any) {
      // User cancelled — not an error
      if (err?.name === 'AbortError') return 'failed';
    }
  }

  // Fallback: copy to clipboard
  return copyShareLink(payload.url);
}

export async function copyShareLink(url: string): Promise<'copied' | 'failed'> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied!');
    return 'copied';
  } catch {
    toast.error('Failed to copy link');
    return 'failed';
  }
}

export async function copyShareTextWithLink(text: string, url: string): Promise<'copied' | 'failed'> {
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast.success('Copied to clipboard!');
    return 'copied';
  } catch {
    toast.error('Failed to copy');
    return 'failed';
  }
}

// ─── Auth Redirect Helpers ───
const REDIRECT_KEY = 'dh_post_auth_redirect';

export function saveIntendedDestination(path: string) {
  try {
    sessionStorage.setItem(REDIRECT_KEY, path);
  } catch { /* noop */ }
}

export function getAndClearIntendedDestination(): string | null {
  try {
    const path = sessionStorage.getItem(REDIRECT_KEY);
    if (path) sessionStorage.removeItem(REDIRECT_KEY);
    return path;
  } catch {
    return null;
  }
}

export function getContentTypeLabel(contentType: ShareableContentType): string {
  return CONTENT_CONFIG[contentType].label;
}
