/**
 * Real offline check for the production build.
 *
 * The desktop browser used for manual QA reports every cache entry as 0 bytes
 * (it returns empty bodies from Cache Storage for files it served from the
 * renderer), so "is the cache filled?" cannot be answered there. This script
 * asks Chrome itself over the DevTools protocol instead:
 *
 *   1. serve dist/ on a throwaway port
 *   2. load it once so the service worker installs and precaches
 *   3. cut the network (chrome.devtools > Page.emulateNetworkConditions offline)
 *   4. reload and require the game to render
 *
 * Usage: node scripts/verify-offline.mjs [--chrome <path>]
 * Exit code 0 means the installed app really works with no connection.
 */
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// fileURLToPath handles Windows drive letters correctly; URL.pathname gives
// "/D:/..." and would make every read fail.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = 4319;
const PROFILE = join(ROOT, '.offline-check-profile');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
};

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html is missing. Run `npm run build` first.');
  process.exit(1);
}

const { executablePath: chromePath } = await resolveExecutable();

// ---------------------------------------------------------------- static server
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let file = join(DIST, normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''));
  if (url.pathname.endsWith('/')) file = join(file, 'index.html');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    // Unknown paths behave like the SPA host: hand back the shell.
    try {
      const body = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  }
});

const cleanup = async () => {
  await new Promise((r) => server.close(r)).catch(() => {});
  await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
};

// ---------------------------------------------------------------- CDP client
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      const waiter = this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(msg.error.message));
      else waiter.resolve(msg.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || 'evaluation failed');
    return res.result.value;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await new Promise((resolve) => server.listen(PORT, resolve));

  const chrome = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=9333',
    `--user-data-dir=${PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank',
  ], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
      target = list.find((t) => t.type === 'page');
    } catch {
      // Chrome is still starting.
    }
  }
  if (!target) throw new Error('Could not attach to Chrome.');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const appUrl = `http://localhost:${PORT}/`;
  const results = [];

  // 1. First visit: installs the worker and precaches the build.
  await cdp.send('Page.navigate', { url: appUrl });
  await sleep(6000);
  const first = await cdp.evaluate(`(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { controlled: !!navigator.serviceWorker.controller, active: !!reg?.active, cached: (await caches.keys()).length };
  })()`);
  results.push(['first visit', first.controlled && first.active, JSON.stringify(first)]);

  // Reload once so the running page is controlled by the worker (the first
  // navigation is not, by spec).
  await cdp.send('Page.navigate', { url: appUrl });
  await sleep(5000);
  const controlled = await cdp.evaluate(`(async () => {
    // Give the cache writes started by this load a moment to settle.
    await new Promise(r => setTimeout(r, 2500));
    return { controlled: !!navigator.serviceWorker.controller };
  })()`);
  results.push(['worker controls the page', !!controlled.controlled, JSON.stringify(controlled)]);

  // 2. Cut the network completely, then reload.
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await cdp.send('Page.navigate', { url: appUrl });
  await sleep(6000);

  const offline = await cdp.evaluate(`(() => ({
    title: document.title,
    hasPlay: /PLAY NOW|PLAY/i.test(document.body.innerText),
    bodyLength: document.body.innerText.length,
  }))()`);
  results.push(['offline: game renders', offline.hasPlay && offline.bodyLength > 200, JSON.stringify(offline)]);

  // 3. Start a level offline: proves the game code itself came from the cache.
  const played = await cdp.evaluate(`(async () => {
    const button = [...document.querySelectorAll('button')].find(b => /PLAY NOW/i.test(b.textContent || ''));
    if (!button) return { started: false, reason: 'no play button' };
    button.click();
    await new Promise(r => setTimeout(r, 4000));
    return { started: !!window.__SP, level: window.__SP?.level ?? null, running: !!window.__SP?.running };
  })()`);
  results.push(['offline: a level starts', played.started && played.working !== false, JSON.stringify(played)]);

  ws.close();
  chrome.kill();
  await sleep(500);

  let failed = 0;
  console.log('\nOffline verification\n');
  for (const [name, ok, detail] of results) {
    if (!ok) failed++;
    console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${name}\n         ${detail}`);
  }
  console.log('');
  if (failed) console.error(`${failed} check(s) failed.`);
  else console.log('All offline checks passed: the installed game runs with no connection.');
  return failed ? 1 : 0;
}

main()
  .then(async (code) => {
    await cleanup();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(`Offline verification error: ${err.message}`);
    await cleanup();
    process.exit(1);
  });
