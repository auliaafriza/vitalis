/**
 * Vitalis service worker.
 *
 * Written by hand rather than generated, because the caching rules here are
 * the interesting part and a generated one would hide them:
 *
 *   - Navigations: network first, falling back to the cached shell, then to
 *     /offline. A tracker that shows a browser error page when the train goes
 *     into a tunnel is a tracker people stop opening.
 *   - Static build output (/_next/static): cache first — those URLs are
 *     content-hashed, so a cached copy can never be stale.
 *   - Supabase API traffic: never cached. Health data must not be served from
 *     a stale cache, and cached auth responses are a security problem.
 */

const VERSION = 'vitalis-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/offline';

const SHELL_ASSETS = [OFFLINE_URL, '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin (Supabase, fonts, anything else): let the network handle it.
  if (url.origin !== self.location.origin) return;

  // Auth routes must always hit the network.
  if (url.pathname.startsWith('/auth/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    // Keep the last good copy of each page for offline use.
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return (
      offline ??
      new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}
