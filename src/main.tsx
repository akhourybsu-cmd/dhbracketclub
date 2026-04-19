import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { fetchRemoteBuildId } from "./lib/forceUpdate";

// Recovery escape hatch: visit `/?fresh=1` to nuke service workers + caches.
async function maybeHardReset() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("fresh")) return false;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.error("Hard reset failed:", e);
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("fresh");
  window.location.replace(url.pathname + url.search + url.hash);
  return true;
}

// Register our minimal push-only service worker. Skips iframes/preview hosts
// to avoid interfering with the Lovable editor preview.
function registerPushSW() {
  if (!("serviceWorker" in navigator)) return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const isPreviewHost =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.app") &&
      window.location.hostname.includes("id-preview--");

  if (isInIframe || isPreviewHost) return;

  // Defer registration so the bootstrap probe in index.html has time to evict
  // any legacy Workbox SWs first.
  window.addEventListener("load", () => {
    setTimeout(() => {
      navigator.serviceWorker
        .register("/sw-push.js", { scope: "/" })
        .catch((err) => console.warn("[sw-push] register failed:", err));
    }, 1500);
  });
}

maybeHardReset().then((reset) => {
  if (reset) return;
  // Fire one immediate version probe at boot so cold launches detect
  // a new build instantly (instead of waiting for the 30s interval).
  void fetchRemoteBuildId();
  createRoot(document.getElementById("root")!).render(<App />);
  registerPushSW();
});
