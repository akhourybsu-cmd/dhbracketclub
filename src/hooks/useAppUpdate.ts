import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Forces the app to refresh when a new service worker is available.
 * On update detection, it activates the new SW and reloads the page automatically.
 * Also checks for updates every 60 seconds.
 */
export function useAppUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      // Poll for SW updates every 60 seconds
      setInterval(() => {
        registration.update();
      }, 60 * 1000);
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
