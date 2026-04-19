// Push notification handler for the service worker
// This file is imported by the PWA service worker
//
// SW_VERSION: bump this string to force the browser to detect a SW change
// and trigger an update on installed PWAs (Android/iOS).
const SW_VERSION = '2026-04-19-bootstrap-probe';
self.__SW_VERSION = SW_VERSION;

// Take control immediately on install so updates apply without waiting
self.addEventListener('install', () => {
  self.skipWaiting();
});

// On activation: nuke ALL caches (including old workbox precaches) and claim clients.
// This ensures the bootstrap probe in index.html sees a fresh /version.json.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name).catch(() => false)));
      await self.clients.claim();
    })()
  );
});

// NEVER intercept /version.json — it must always hit the network so the
// bootstrap probe in index.html can detect new deploys.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === '/version.json') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => new Response('{}', { headers: { 'content-type': 'application/json' } })));
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const tag = data.tag || 'dh-chat-' + (data.data?.url || 'default');

    // Check for existing notification with same tag to build a count
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
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
