import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Recovery escape hatch: visit `/?fresh=1` to nuke service workers + caches.
// Useful for installed PWAs that are stuck on an old build.
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

  // Strip the query param and reload to a clean state
  const url = new URL(window.location.href);
  url.searchParams.delete("fresh");
  window.location.replace(url.pathname + url.search + url.hash);
  return true;
}

maybeHardReset().then((reset) => {
  if (reset) return; // page is reloading
  createRoot(document.getElementById("root")!).render(<App />);
});
