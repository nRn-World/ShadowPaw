/* Shadow Paw service worker.
 *
 * Goals, in order of importance:
 *  1. Never serve a stale build. The app shell is network-first with a short
 *     timeout, so a new deploy shows up on the next launch while a missing
 *     connection still opens the cached copy.
 *  2. Work completely offline after the first visit: the built JS/CSS (hashed,
 *     so never stale) and the music are cached and served without asking the
 *     network.
 *  3. Nothing here may throw in a way that breaks the page.
 */
// Bump when the caching rules change, not on every release: the shell itself is
// network-first, so a new deploy is picked up without touching this string.
const VERSION = 'shadow-paw-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const MEDIA_CACHE = `${VERSION}-media`;

// Page loads wait this long for the network before considering the cache.
const NAV_TIMEOUT_MS = 4000;
// After that, how long a late answer may take before the cache is used.
const LATE_NETWORK_MS = 10000;

// The bare minimum for the app to open with no connection at all.
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

/**
 * Everything the page actually needs, read from index.html. The build hashes
 * file names, so a static list would go stale on every deploy; asking the live
 * HTML keeps the precache correct without a build step.
 */
async function collectPrecacheUrls() {
  const urls = new Set(SHELL);
  try {
    const response = await fetch('./index.html', { cache: 'no-store' });
    if (response.ok) {
      const html = await response.text();
      for (const match of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)) {
        urls.add(match[1]);
      }
    }
  } catch {
    // Offline install is a nice-to-have; the shell list still covers the basics.
  }
  return [...urls];
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const urls = await collectPrecacheUrls();
      // Promise.allSettled: one broken file must not abort the whole install.
      await Promise.allSettled(urls.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Store `response` under `requestKey`, resetting `response` so the page can
 * still read it.
 *
 * The caller must await this inside `event.waitUntil`/`respondWith`. A
 * fire-and-forget `cache.put()` is cancelled when the worker starts handling the
 * next event, which stored every file bigger than the in-memory body buffer as
 * a 0-byte entry: the entry existed, so the page looked cached, but offline the
 * script came back empty and the game did not start.
 */
async function store(cache, requestKey, response) {
  try {
    await cache.put(requestKey, response);
  } catch {
    // A failed write only costs the offline copy of one file.
  }
}

/**
 * Read a stored response without disturbing the stored copy.
 *
 * `cache.match()` hands out the single stored body. Matching a second time for
 * the same URL gives the browser a fresh stream, so a read never leaves the
 * entry drained for the next visit.
 */
async function readCached(cache, request) {
  const hit = await cache.match(request, { ignoreSearch: true });
  if (!hit) return null;
  return cache.match(hit.url, { ignoreSearch: true });
}

/**
 * Network first, falling back to the cache when the network is slow or gone.
 * Returns a Response whose body has not been consumed, so a copy is stored for
 * the next visit.
 */
async function networkFirst(request, timeoutMs = 0) {
  const cache = await caches.open(SHELL_CACHE);
  const fromCache = async () => {
    const cached = await readCached(cache, request);
    if (cached) return cached;
    // A navigation with nothing cached for its exact URL still gets the app
    // shell, which is what lets any stored link open while offline.
    if (request.mode === 'navigate') {
      const url = new URL(request.url);
      return (
        (await readCached(cache, `${url.origin}${url.pathname}`)) ||
        (await readCached(cache, `${url.origin}/index.html`))
      );
    }
    return null;
  };

  const network = fetch(request);

  // Fast path: no timeout, just wait for the answer and cache it properly.
  if (!timeoutMs) {
    let response;
    try {
      response = await network;
    } catch (err) {
      const cached = await fromCache();
      if (cached) return cached;
      throw err;
    }
    if (response.ok) {
      // Cloning keeps one stream for the cache and one for the page; both are
      // awaited here, inside respondWith, so neither is cancelled.
      const copy = response.clone();
      await store(cache, request, copy);
    }
    return response;
  }

  // Navigation: a slow connection must not leave a blank page, but a proxy or
  // hotspot that answers 5xx is not the app either - both fall back to cache.
  let timer = 0;
  try {
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const winner = await Promise.race([network.catch(() => null), timeout]);

    if (winner && winner.ok) {
      const copy = winner.clone();
      await store(cache, request, copy);
      return winner;
    }
    if (winner && !winner.ok) {
      const cached = await fromCache();
      if (cached) return cached;
      return winner;
    }

    // A slow network is not a dead one: if the copy arrives shortly after the
    // timeout, use it rather than the stale cache.
    const late = await Promise.race([
      network.catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), LATE_NETWORK_MS)),
    ]);
    if (late && late.ok) {
      const copy = late.clone();
      await store(cache, request, copy);
      return late;
    }
    return (await fromCache()) || late;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Cache first. Used for audio and hashed build assets: neither changes for a
    given URL, so the cache can be trusted without asking the network. */
async function cacheFirst(request) {
  const isAsset = /\/assets\//.test(new URL(request.url).pathname);
  const cache = await caches.open(isAsset ? SHELL_CACHE : MEDIA_CACHE);
  const cached = await readCached(cache, request);
  if (cached) return cached;

  const response = await fetch(request);
  // Only keep successful full responses; a partial 206 cannot be replayed.
  if (response && response.ok && response.status === 200) {
    const copy = response.clone();
    await store(cache, request, copy);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Same-origin only: anything else (analytics, CDNs) keeps the default path.
  if (url.origin !== self.location.origin) return;

  if (
    request.destination === 'audio' ||
    request.destination === 'video' ||
    /\.(mp3|webm|mp4|m4a|ogg)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, NAV_TIMEOUT_MS));
    return;
  }

  // Built assets carry a content hash, so the cache entry can never go stale.
  // Serving them cache-first means the second load never waits on the network,
  // and the game still opens completely offline.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font' || request.destination === 'image') {
    event.respondWith(networkFirst(request));
  }
});
