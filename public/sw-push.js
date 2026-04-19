// Push notification handler for the service worker
// This file is imported by the PWA service worker
//
// SW_VERSION: bump this string to force the browser to detect a SW change
// and trigger an update on installed PWAs (Android/iOS).
const SW_VERSION = '2025-04-19-2';
self.__SW_VERSION = SW_VERSION;

// Take control immediately on install so updates apply without waiting
self.addEventListener('install', () => {
  self.skipWaiting();
});

// On activation, clear ALL old caches to prevent stale data
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Keep only workbox-precache caches (they're versioned)
          if (!cacheName.includes('workbox-precache')) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
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
