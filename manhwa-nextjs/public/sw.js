const VERSION = '2026-11-21-2';
const STATIC_CACHE = `mi-static-${VERSION}`;
const HTML_CACHE = 'mi-pages-v2';
const API_CACHE = 'mi-public-api-v1';
const OFFLINE_URL = '/offline';
const HTML_MAX_AGE = 24 * 60 * 60 * 1000;
const HTML_MAX_ENTRIES = 50;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const request = new Request(new URL(OFFLINE_URL, self.location.origin), {
        headers: { Accept: 'text/html' },
      });
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Offline page returned HTTP ${response.status}.`);
      const cache = await caches.open(HTML_CACHE);
      await cache.put(request, await addCacheMetadata(response, 0));
    } catch (error) {
      console.warn('No se pudo preparar la página offline durante la instalación del service worker.', error);
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const obsolete = cacheNames.filter((name) => name.startsWith('mi-')
      && ![STATIC_CACHE, HTML_CACHE, API_CACHE].includes(name));
    for (const legacy of ['manhwa-images-v5', 'mi-images-v1', 'mi-pages-v1']) {
      if (cacheNames.includes(legacy) && !obsolete.includes(legacy)) obsolete.push(legacy);
    }
    await Promise.all(obsolete.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))));
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'https:' && url.origin !== self.location.origin) return;

  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.mode === 'navigate' && request.headers.get('accept')?.includes('text/html')) {
    if (url.origin !== self.location.origin || isPrivatePath(url.pathname)) return;
    if (isChapterPath(url.pathname)) {
      event.respondWith(onlineOnlyPage(request));
      return;
    }
    if (request.headers.has('cookie')) return;
    event.respondWith(networkFirstPage(event, request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname === '/api/popular-home' && !request.headers.has('cookie')) {
    event.respondWith(staleWhileRevalidate(event, request, API_CACHE));
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || 'Hay un capítulo nuevo disponible.' };
  }

  const title = String(payload.title || 'Manhwa Imperial').slice(0, 100);
  const options = {
    body: String(payload.body || 'Hay un capítulo nuevo disponible.').slice(0, 300),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: safeLocalPath(payload.url) },
    tag: payload.tag || 'manhwa-imperial-chapter',
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(safeLocalPath(event.notification.data?.url), self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});

function isPrivatePath(pathname) {
  return /^\/(?:api|auth|register|login|perfil|profile|user-profile|users)(?:\/|$)/i.test(pathname)
    || /(?:analytics|collect|tracking)/i.test(pathname);
}

function isChapterPath(pathname) {
  return /^\/(?:en\/)?manhwa\/[^/]+\/(?:capitulo|chapter)\/[^/]+(?:\/|$)/i.test(pathname)
    || /^\/nsfw\/[^/]+\/capitulo\/[^/]+(?:\/|$)/i.test(pathname)
    || /^\/chapter-reader(?:\/|$)/i.test(pathname);
}

function safeLocalPath(value) {
  try {
    const url = new URL(value || '/home', self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/home';
  } catch {
    return '/home';
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.status === 200 && response.type !== 'opaque') {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstPage(event, request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.status === 200 && response.type !== 'opaque' && !response.headers.has('set-cookie')) {
      event.waitUntil(cachePage(request, response.clone()));
    }
    return response;
  } catch {
    const cached = await getFreshCachedPage(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return offlineResponse();
  } finally {
    clearTimeout(timeout);
  }
}

async function onlineOnlyPage(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch {
    return (await caches.match(OFFLINE_URL)) || offlineResponse();
  }
}

function offlineResponse() {
  return new Response('Sin conexión. Los capítulos solo se pueden leer con conexión.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function cachePage(request, response) {
  const cache = await caches.open(HTML_CACHE);
  await cache.put(request, await addCacheMetadata(response, 0));
  const keys = await cache.keys();
  if (keys.length > HTML_MAX_ENTRIES) {
    await Promise.all(keys.slice(0, keys.length - HTML_MAX_ENTRIES).map((key) => cache.delete(key)));
  }
}

async function getFreshCachedPage(request) {
  const cache = await caches.open(HTML_CACHE);
  const response = await cache.match(request);
  if (!response) return null;
  const cachedAt = Number(response.headers.get('x-mi-cached-at'));
  if (!cachedAt || Date.now() - cachedAt > HTML_MAX_AGE) {
    await cache.delete(request);
    return null;
  }
  return response;
}

async function addCacheMetadata(response, bytes) {
  const headers = new Headers(response.headers);
  headers.set('x-mi-cached-at', String(Date.now()));
  if (bytes > 0) headers.set('x-mi-cache-bytes', String(bytes));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function staleWhileRevalidate(event, request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (response.status === 200 && response.type !== 'opaque') {
      await cache.put(request, await addCacheMetadata(response.clone(), 0));
    }
    return response;
  });
  event.waitUntil(refresh.catch(() => undefined));
  if (cached) return cached;
  return refresh;
}
