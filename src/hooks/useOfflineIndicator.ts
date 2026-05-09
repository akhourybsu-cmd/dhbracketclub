import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Friendly online/offline toast. No caching, no fallback page —
 * just lets the user know connectivity is gone so they understand
 * why data isn't loading.
 */
export function useOfflineIndicator() {
  useEffect(() => {
    let toastId: string | number | null = null;

    const onOffline = () => {
      if (toastId !== null) return;
      toastId = toast('You\u2019re offline', {
        description: 'Some content may be unavailable until you reconnect.',
        duration: Infinity,
      });
    };
    const onOnline = () => {
      if (toastId !== null) {
        toast.dismiss(toastId);
        toastId = null;
        toast.success('Back online');
      }
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) onOffline();

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);
}
