/**
 * Registers the offline worker that makes the installed app usable without a
 * connection.
 *
 * Only the production build registers one. In development Vite serves a new
 * module graph on every edit, and a worker caching those files would hand the
 * next reload yesterday's code. A query flag lets a production build be tested
 * on localhost on purpose (`?sw=1`), since `isSecureContext` already holds there.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const isDevHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  const forced = new URLSearchParams(window.location.search).get('sw') === '1';
  if (!window.isSecureContext) return;
  if (isDevHost && !forced) return;

  // The worker lives next to the app so it can also cover GitHub Pages, where
  // the site is served from a sub-path.
  const url = new URL('sw.js', document.baseURI).href;

  const register = () => {
    navigator.serviceWorker.register(url).catch(() => {
      // A failed registration only costs offline mode; the game itself works.
    });
  };

  // Registered immediately, not on `load`. This runs after the first render,
  // where `load` has usually already fired - a listener added for a past event
  // never runs, and the whole app would silently have no offline support.
  // The worker defers its downloads until the page is idle, so this costs the
  // first paint nothing.
  register();
}
