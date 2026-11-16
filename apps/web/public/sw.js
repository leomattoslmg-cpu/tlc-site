// Service worker do TLC: só recebe notificações push e abre o portal ao tocar nelas.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (_) {
    d = {};
  }
  e.waitUntil(
    self.registration.showNotification(d.titulo || 'TLC Ponta Porã', {
      body: d.texto || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: d.url || '/portal/avisos' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/portal';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
