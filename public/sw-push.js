// Push notification handler for the service worker
// This file is imported by the PWA service worker

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/pwa-icon-512.png',
      badge: '/pwa-icon-512.png',
      data: data.data || {},
      vibrate: [100, 50, 100],
      tag: 'dh-chat-' + (data.data?.url || 'default'),
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'DH', options)
    );
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
