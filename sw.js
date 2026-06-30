// Service Worker for 「别忘」PWA
// Handles background notifications and offline caching

const CACHE = 'biewang-v1';
const ASSETS = ['./', './index.html', './manifest.json'];

// Install — cache core assets
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache-first for static, network-first for everything else
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});

// Handle notification click — focus or open the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      if (windows.length) return windows[0].focus();
      return clients.openWindow('./index.html');
    })
  );
});

// Handle periodic background sync for reminder checks
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-reminders') {
    e.waitUntil(checkAndNotify());
  }
});

// Check stored tasks and fire notifications
async function checkAndNotify() {
  // Service workers can't access localStorage directly.
  // Instead, the main app posts task data via MessageChannel.
  // This is a fallback — the main app's setInterval is the primary reminder mechanism.
  const windows = await clients.matchAll({ type: 'window' });
  if (windows.length) {
    windows[0].postMessage({ type: 'CHECK_REMINDERS' });
  }
}

// Listen for messages from the main app
self.addEventListener('message', e => {
  if (e.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, tag, delay } = e.data;
    // Schedule a notification after delay (ms)
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        tag,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="40" fill="%230f0f0f"/><text x="96" y="120" font-size="100" text-anchor="middle">🔔</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="40" fill="%23ff6b35"/><text x="96" y="120" font-size="100" text-anchor="middle">📋</text></svg>',
        vibrate: [200, 100, 200, 100, 400],
        requireInteraction: true,
        actions: [
          { action: 'start', title: '✅ 开始做' },
          { action: 'delay', title: '⏰ 推迟' }
        ],
        data: { taskId: tag }
      });
    }, delay || 0);
  }
});
