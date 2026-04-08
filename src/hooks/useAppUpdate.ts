import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

/**
 * Detects when a new version of the app is available,
 * shows a toast notification, then refreshes after a short delay.
 * Checks for updates every 15 seconds and on tab focus.
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
      toast('🔄 New version available', {
        description: 'Updating now — the app will refresh in a moment.',
        duration: 4000,
      });
      // Give the toast a moment to display, then activate the new SW and reload
      const timer = setTimeout(() => {
        updateServiceWorker(true);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [needRefresh, updateServiceWorker]);
}
