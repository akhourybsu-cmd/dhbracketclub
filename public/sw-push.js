// DH service worker — single file that handles two phases:
//
// 1) SELF-DESTRUCT phase: when an old install's SW (which `importScripts`'d
//    this file) refetches it, this script unregisters the SW, wipes ALL
//    caches, and reloads every open client. This breaks installs that are
//    stuck on a stale Workbox-precached index.html.
//
// 2) PUSH-ONLY phase: when the page registers `/sw-push.js` directly as the
//    SW (no Workbox wrapper), it serves only push + notificationclick
//    handlers. No fetch listener, no caching. The app shell is always
//    fetched fresh from the network.
//
// The phase is determined by whether this script was loaded via importScripts
// (old SW) vs registered directly. We detect "old SW" by checking for the
// presence of workbox globals.

const SW_VERSION = '2026-04-19-self-destruct-v2';
self.__SW_VERSION = SW_VERSION;

const isLegacyWorkboxSW =
  typeof self.workbox !== 'undefined' ||
  typeof self.__WB_MANIFEST !== 'undefined' ||
  typeof self.__WB_DISABLE_DEV_LOGS !== 'undefined';

if (isLegacyWorkboxSW) {
  // === SELF-DESTRUCT PHASE ===
  // Old Workbox SW imported us. Nuke everything.
  self.addEventListener('install', (event) => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((n) => caches.delete(n).catch(() => false)));
        } catch (e) {
          console.error('[sw-push self-destruct] cache wipe failed:', e);
        }
        try {
          await self.registration.unregister();
        } catch (e) {
          console.error('[sw-push self-destruct] unregister failed:', e);
        }
        try {
          const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of clientsList) {
            try {
              const u = new URL(client.url);
              u.searchParams.set('_sw_killed', Date.now().toString());
              client.navigate(u.toString());
            } catch (e) {
              // Fallback: postMessage to client
              try { client.postMessage({ type: 'SW_KILLED' }); } catch {}
            }
          }
        } catch (e) {
          console.error('[sw-push self-destruct] client reload failed:', e);
        }
      })()
    );
  });

  // Don't intercept anything during the brief self-destruct window.
} else {
  // === PUSH-ONLY PHASE ===
  // We are the standalone SW. Only handle push + notificationclick.
  self.addEventListener('install', () => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
      const data = event.data.json();
      const tag = data.tag || 'dh-chat-' + (data.data?.url || 'default');

      const showPromise = self.registration.getNotifications({ tag }).then((existing) => {
        let body = data.body || '';
        let count = 1;

        if (existing.length > 0) {
          const prev = existing[0];
          const prevCount = prev.data?.messageCount || 1;
          count = prevCount + 1;
          body = `${count} new messages`;
        }

        const options = {
          body,
          icon: data.icon || '/pwa-icon-512.png',
          badge: '/pwa-icon-512.png',
          data: { ...(data.data || {}), messageCount: count },
          vibrate: [100, 50, 100],
          tag,
          renotify: true,
        };

        return self.registration.showNotification(data.title || 'DH', options);
      });

      event.waitUntil(showPromise);
    } catch (e) {
      console.error('Push event error:', e);
    }
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/chat';

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
    );
  });
}
