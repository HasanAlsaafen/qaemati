// B4: offline fallback only -- NOT full offline menu browsing. A menu's
// content changes whenever its owner edits it, so caching /m/:slug pages
// themselves would risk serving a stale menu (wrong prices, items marked
// available that no longer are) with no way for a visitor to tell it's
// stale. Scope is deliberately just "a friendly offline page instead of
// the browser's own network-error page," plus the static shell (CSS/JS/
// icon) so that offline page actually renders styled.
// Bump the version whenever the strategy below changes so old caches are
// deleted on activate.
const CACHE_NAME = 'qaemati-shell-v2';
const PRECACHE_URLS = ['/offline', '/css/app.css', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Page navigations: network first (menus must always be fresh), fall
  // back to the precached offline page when the network is unreachable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline')),
    );
    return;
  }

  // The shell is only a fallback for the offline page. The stylesheet is
  // network first: the file is not content hashed, so serving a cached copy
  // first would keep returning visitors on an old stylesheet after every
  // deploy, against new HTML. The cache is used only when the network fails.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy));
          return response;
        })
        .catch(() => caches.match(url.pathname)),
    );
  }
});
