const CACHE_NAME = 'handyman-v1.2.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg'
];

const CACHE_STRATEGIES = {
  static: 'cache-first',
  api: 'network-first',
  fonts: 'cache-first',
  images: 'cache-first'
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(networkFirstStrategy(event.request));
      return;
    }
    
    if (url.pathname.match(/\.(woff2?|ttf|eot)$/)) {
      event.respondWith(cacheFirstStrategy(event.request, 'fonts'));
      return;
    }
    
    if (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico)$/)) {
      event.respondWith(cacheFirstStrategy(event.request, 'images'));
      return;
    }
  }

  if (url.origin === 'https://fonts.googleapis.com' || 
      url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(cacheFirstStrategy(event.request, 'fonts'));
    return;
  }

  event.respondWith(networkFirstStrategy(event.request));
});

async function cacheFirstStrategy(request: Request, cacheName: string = CACHE_NAME): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    const fetchPromise = fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => cached);
    
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstStrategy(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    
    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/favicon.svg',
      badge: payload.badge || '/favicon.svg',
      image: payload.image,
      tag: payload.tag,
      data: payload.data,
      requireInteraction: payload.requireInteraction ?? true,
      silent: payload.silent ?? false,
      vibrate: payload.vibrate ?? [200, 100, 200],
      timestamp: payload.timestamp ?? Date.now(),
      actions: payload.actions
    };

    event.waitUntil(
      self.registration.showNotification(payload.title, options)
    );
  } catch (error) {
    console.error('[SW] Push error:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data || {};
  
  let url = data.url || '/';
  
  if (action === 'pay' && data.url) {
    url = data.url;
  } else if (action === 'recharge' && data.url) {
    url = data.url;
  } else if (action === 'view' && data.url) {
    url = data.url;
  } else if (action === 'chat' && data.url) {
    url = data.url;
  } else if (action === 'rate' && data.url) {
    url = data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  console.log('[SW] Notificación cerrada:', data.tag);
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'sync-tracking') {
    event.waitUntil(syncTracking());
  } else if (event.tag === 'sync-payments') {
    event.waitUntil(syncPayments());
  }
});

async function syncMessages(): Promise<void> {
  console.log('[SW] Sincronizando mensajes offline...');
}

async function syncTracking(): Promise<void> {
  console.log('[SW] Sincronizando tracking...');
}

async function syncPayments(): Promise<void> {
  console.log('[SW] Sincronizando pagos...');
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-sync') {
    event.waitUntil(performDailySync());
  }
});

async function performDailySync(): Promise<void> {
  console.log('[SW] Sync diario ejecutado');
  await fetch('/api/sync/daily', { method: 'POST' }).catch(() => {});
}

declare const self: ServiceWorkerGlobalScope;