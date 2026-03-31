import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Forces the app to refresh when a new service worker is available.
 * On update detection, it activates the new SW and reloads the page automatically.
 * Checks for updates every 15 seconds for fast rollouts.
 * Also checks on visibility change (tab/app foregrounded).
 */
export function useAppUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      // Poll for SW updates every 15 seconds
      setInterval(() => {
        registration.update();
      }, 15 * 1000);

      // Also check when the app is foregrounded
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update();
        }
      });
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      // Force update: activate the new service worker and reload
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);
}
