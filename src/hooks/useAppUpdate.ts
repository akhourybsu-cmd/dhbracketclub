import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { fetchRemoteBuildId, nukeAndReload } from '@/lib/forceUpdate';

const CHECK_INTERVAL_MS = 30 * 1000;
const AUTO_NUKE_DELAY_MS = 10 * 1000;

/**
 * Universal update detector. Independent of the service worker — fetches
 * /version.json (no-store) and compares against the build id baked into
 * this JS bundle. On mismatch: prominent toast + auto nuke after 10s.
 */
export function useAppUpdate() {
  const location = useLocation();
  const localBuildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
  const promptedRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const triggerUpdate = () => {
      if (promptedRef.current) return;
      promptedRef.current = true;

      toast('🚀 New version available', {
        description: 'Updating in 10 seconds — tap to update now.',
        duration: AUTO_NUKE_DELAY_MS,
        action: {
          label: 'Update now',
          onClick: () => {
            if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
            void nukeAndReload();
          },
        },
      });

      autoTimerRef.current = setTimeout(() => {
        void nukeAndReload();
      }, AUTO_NUKE_DELAY_MS);
    };

    const check = async () => {
      if (cancelled || promptedRef.current) return;
      const remote = await fetchRemoteBuildId();
      if (cancelled || !remote) return;
      // Only prompt when both ids look like real build stamps and differ.
      if (remote !== localBuildId && localBuildId !== 'dev' && remote !== 'dev') {
        triggerUpdate();
      }
    };

    // Initial check + interval
    void check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
    };
    // localBuildId is constant for the lifetime of this bundle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Probe on every route change too — cheap and catches stuck installs.
  useEffect(() => {
    if (promptedRef.current) return;
    void (async () => {
      const remote = await fetchRemoteBuildId();
      if (!remote) return;
      if (remote !== localBuildId && localBuildId !== 'dev' && remote !== 'dev') {
        if (promptedRef.current) return;
        promptedRef.current = true;
        toast('🚀 New version available', {
          description: 'Updating in 10 seconds — tap to update now.',
          duration: AUTO_NUKE_DELAY_MS,
          action: {
            label: 'Update now',
            onClick: () => {
              if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
              void nukeAndReload();
            },
          },
        });
        autoTimerRef.current = setTimeout(() => {
          void nukeAndReload();
        }, AUTO_NUKE_DELAY_MS);
      }
    })();
  }, [location.pathname, localBuildId]);
}
