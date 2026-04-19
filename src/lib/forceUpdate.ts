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

// ---------- Live probe state (read by Admin Hub diagnostics) ----------

export type ProbeOutcome = 'ok' | 'mismatch' | 'network-failed' | 'invalid-json' | 'never';

export interface ProbeState {
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  lastOutcome: ProbeOutcome;
  lastRemoteBuildId: string | null;
  attempts: number;
  successes: number;
  failures: number;
}

const probeState: ProbeState = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastOutcome: 'never',
  lastRemoteBuildId: null,
  attempts: 0,
  successes: 0,
  failures: 0,
};

const listeners = new Set<(s: ProbeState) => void>();

export function getProbeState(): ProbeState {
  return { ...probeState };
}

export function subscribeProbeState(cb: (s: ProbeState) => void): () => void {
  listeners.add(cb);
  cb({ ...probeState });
  return () => listeners.delete(cb);
}

function emit() {
  const snapshot = { ...probeState };
  listeners.forEach((cb) => {
    try { cb(snapshot); } catch { /* noop */ }
  });
}

/**
 * Fetch the deployed build id from /version.json, bypassing every cache layer.
 * Uses `cache: 'reload'` (more reliably honored on Android Chrome than
 * `no-store`) plus a query-string buster.
 * Returns null on failure (offline, 404, etc.) so callers can no-op.
 */
export async function fetchRemoteBuildId(): Promise<string | null> {
  probeState.lastAttemptAt = Date.now();
  probeState.attempts += 1;

  try {
    const req = new Request(`/version.json?t=${Date.now()}`, {
      cache: 'reload',
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
    });
    const res = await fetch(req);
    if (!res.ok) {
      probeState.lastOutcome = 'network-failed';
      probeState.failures += 1;
      console.warn('[update-probe] non-OK response:', res.status);
      emit();
      return null;
    }
    const data = await res.json();
    const buildId = typeof data?.buildId === 'string' ? data.buildId : null;
    if (!buildId) {
      probeState.lastOutcome = 'invalid-json';
      probeState.failures += 1;
      emit();
      return null;
    }
    probeState.lastRemoteBuildId = buildId;
    probeState.lastSuccessAt = Date.now();
    probeState.successes += 1;
    const local = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
    probeState.lastOutcome = buildId === local ? 'ok' : 'mismatch';
    console.info('[update-probe]', probeState.lastOutcome, 'remote=', buildId, 'local=', local);
    emit();
    return buildId;
  } catch (err) {
    probeState.lastOutcome = 'network-failed';
    probeState.failures += 1;
    console.warn('[update-probe] fetch failed:', err);
    emit();
    return null;
  }
}
