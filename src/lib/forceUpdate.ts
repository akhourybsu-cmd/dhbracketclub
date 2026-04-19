/**
 * Nuclear update: unregister every service worker, delete every cache,
 * then hard-reload. Does NOT depend on the existing SW behaving correctly.
 */
export async function nukeAndReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
  } catch (e) {
    console.error('SW unregister failed:', e);
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch (e) {
    console.error('Cache clear failed:', e);
  }

  // Cache-bust the navigation so even an aggressive HTTP cache misses
  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString());
  window.location.replace(url.toString());
}

/**
 * Fetch the deployed build id from /version.json, bypassing every cache layer.
 * Returns null on failure (offline, 404, etc.) so callers can no-op.
 */
export async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.buildId === 'string' ? data.buildId : null;
  } catch {
    return null;
  }
}
