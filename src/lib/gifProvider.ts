// DH Club — Tenor GIF provider
//
// Thin client for Tenor v2 (Google). No backend storage: GIFs are sent
// as message content like any other image URL — the existing
// IMAGE_EXT_RE pattern in MessageBubble auto-renders them inline via
// ChatAttachmentImage's legacy public-URL branch.
//
// Content filter is set to `low` per club guidance: allows G/PG-13/R
// (mature themes, mild profanity), excludes explicit/NSFW. Tenor's
// rating scale: high=G, medium=G+PG-13, low=G+PG-13+R, off=everything.
//
// API key comes from VITE_TENOR_API_KEY. If unset, the picker degrades
// gracefully with a friendly "not configured" message — no crash.

const API = 'https://tenor.googleapis.com/v2';
const KEY = (import.meta.env.VITE_TENOR_API_KEY as string | undefined) ?? '';
const CLIENT_KEY = 'dh_club';
const CONTENT_FILTER = 'low' as const;
// tinygif (~100KB) for the picker grid, mediumgif (~500KB) for sending.
// We deliberately avoid the full `gif` format which can be 5–20MB.
const MEDIA_FILTER = 'tinygif,mediumgif';
const PAGE_LIMIT = '24';

export interface GifResult {
  /** Tenor ID — stable per GIF, useful as React key. */
  id: string;
  /** Best-effort title from Tenor (often "" — fallback to description). */
  title: string;
  /** Small animated preview used in the picker grid. */
  previewUrl: string;
  /** Medium animated URL actually sent to the chat. */
  fullUrl: string;
  /** Native dimensions of the preview (used for aspect-ratio in the grid). */
  width: number;
  height: number;
}

export function isGifProviderConfigured(): boolean {
  return KEY.length > 0;
}

type TenorMediaFormat = { url: string; dims: [number, number]; size: number };

type TenorResponse = {
  results?: Array<{
    id: string;
    title?: string;
    content_description?: string;
    media_formats?: Record<string, TenorMediaFormat>;
  }>;
  next?: string;
};

function mapResults(raw: TenorResponse): GifResult[] {
  if (!raw.results) return [];
  const out: GifResult[] = [];
  for (const r of raw.results) {
    const tiny = r.media_formats?.tinygif;
    const medium = r.media_formats?.mediumgif;
    if (!tiny?.url || !medium?.url) continue;
    out.push({
      id: r.id,
      title: r.title || r.content_description || 'GIF',
      previewUrl: tiny.url,
      fullUrl: medium.url,
      width: tiny.dims?.[0] ?? 200,
      height: tiny.dims?.[1] ?? 150,
    });
  }
  return out;
}

async function tenorFetch(
  endpoint: '/featured' | '/search',
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<TenorResponse> {
  const qs = new URLSearchParams({
    key: KEY,
    client_key: CLIENT_KEY,
    contentfilter: CONTENT_FILTER,
    media_filter: MEDIA_FILTER,
    limit: PAGE_LIMIT,
    ...params,
  });
  const res = await fetch(`${API}${endpoint}?${qs.toString()}`, { signal });
  if (!res.ok) throw new Error(`Tenor responded ${res.status}`);
  return res.json();
}

/** Tenor's curated trending feed — shown when the search box is empty. */
export async function fetchTrendingGifs(signal?: AbortSignal): Promise<GifResult[]> {
  if (!isGifProviderConfigured()) return [];
  const data = await tenorFetch('/featured', {}, signal);
  return mapResults(data);
}

/** Keyword search. Pass an AbortSignal to cancel debounced in-flight requests. */
export async function searchGifs(query: string, signal?: AbortSignal): Promise<GifResult[]> {
  if (!isGifProviderConfigured() || !query.trim()) return [];
  const data = await tenorFetch('/search', { q: query.trim() }, signal);
  return mapResults(data);
}
