import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

/**
 * Detects when a new version of the app is available,
 * shows a toast notification, then refreshes after a short delay.
 * Aggressively checks: immediately on mount, every 10s, on focus,
 * on visibility change, and when the network comes back online.
 */
export function useAppUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      const checkForUpdate = () => {
        registration.update().catch(() => {
          // Silently ignore network errors during update checks
        });
      };

      // Immediate check on registration (don't wait for first poll)
      checkForUpdate();

      // Poll for SW updates every 10 seconds while foregrounded
      setInterval(checkForUpdate, 10 * 1000);

      // Check when the app is foregrounded (visibility change)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate();
        }
      });

      // iOS Safari fires `focus` more reliably than visibilitychange
      // when returning from a backgrounded PWA
      window.addEventListener('focus', checkForUpdate);

      // Check when the network comes back online — common on mobile
      window.addEventListener('online', checkForUpdate);
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast('🔄 New version available', {
        description: 'Updating now — the app will refresh in a moment.',
        duration: 2000,
      });
      // Short delay so the toast registers, then activate the new SW and reload
      const timer = setTimeout(() => {
        updateServiceWorker(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [needRefresh, updateServiceWorker]);
}
