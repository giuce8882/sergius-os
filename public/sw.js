const CACHE_NAME = 'sergiu-os-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// Notification click → focus/open the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow('/');
    })
  );
});

// Fire a notification on demand (sent from main thread)
self.addEventListener('message', e => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, icon } = e.data;
    self.registration.showNotification(title, {
      body,
      icon: icon || '/pwa-icon-512.png',
      badge: '/pwa-icon.png',
      tag: tag || 'sergiu-os',
      requireInteraction: false,
      vibrate: [100, 50, 100]
    });
  }

  // Schedule a future notification inside the SW
  if (e.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, tag, delayMs } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/pwa-icon-512.png',
        badge: '/pwa-icon.png',
        tag: tag || 'sergiu-os-scheduled',
        requireInteraction: false,
        vibrate: [100, 50, 100]
      });
    }, delayMs);
  }
});

// Future: handle push from OneSignal/FCM
self.addEventListener('push', e => {
  const data = e.data?.json() || { title: 'Sergiu OS', body: 'You have a new alert' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-icon-512.png',
      badge: '/pwa-icon.png',
      tag: data.tag || 'push',
      data: data
    })
  );
});
