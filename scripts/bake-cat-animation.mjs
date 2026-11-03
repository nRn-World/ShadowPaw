/**
 * Bakes an animated cat model into walk-cycle sprite frames.
 *
 * Source: public/models/toon_cat_free.glb (Toon Cat FREE by Omabuarts Studio,
 * CC BY 4.0). The model has a 36-bone rig and one 0.833 s loop that covers a
 * full walk cycle of all four legs.
 *
 * Output: public/sprites/cat_walk_<n>.png - 8 evenly spaced poses around the
 * loop, seen in profile facing right. The game flips them to face left and
 * picks the frame from the player's speed, so the legs really move.
 *
 * Usage: node scripts/bake-cat-animation.mjs
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = join(ROOT, 'public', 'models', 'toon_cat_free.glb');
const OUT = join(ROOT, 'public', 'sprites');
const PORT = 4322;
const FRAMES = 8;
const SIZE = 256;

if (!existsSync(MODEL)) {
  console.error(`Model missing: ${MODEL}`);
  process.exit(1);
}

const chromePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean).find((p) => existsSync(p));
if (!chromePath) {
  console.error('Chrome not found. Set CHROME_PATH.');
  process.exit(1);
}

const PAGE = `<!doctype html><html><body style="margin:0">
<script type="importmap">{"imports":{"three":"/nm/three/build/three.module.js","three/addons/":"/nm/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(${SIZE}, ${SIZE});
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1.5, 3, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0x2bee79, 1.6); rim.position.set(-2, 1, -2); scene.add(rim);

const gltf = await new GLTFLoader().loadAsync('/model.glb');
const model = gltf.scene;
const mixer = new THREE.AnimationMixer(model);
const clip = gltf.animations[0];
const action = mixer.clipAction(clip);
action.play();

// Centre the sculpt at the origin, otherwise the camera stares at empty space.
const box = new THREE.Box3().setFromObject(model);
const centre = box.getCenter(new THREE.Vector3());
model.position.sub(centre);
const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).length() / 2);

const camera = new THREE.PerspectiveCamera(30, 1, 0.001, 1000);
const distance = (sphere.radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.15;
camera.position.set(0, 0, distance);
camera.lookAt(0, 0, 0);

window.clipInfo = { name: clip.name, duration: clip.duration };
window.renderFrame = async (index, total) => {
  mixer.setTime((clip.duration * index) / total);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
};
window.debugInfo = async () => {
  mixer.setTime(0);
  renderer.render(scene, camera);
  const data = new Uint8Array(${SIZE} * ${SIZE} * 4);
  const gl = renderer.getContext();
  gl.readPixels(0, 0, ${SIZE}, ${SIZE}, gl.RGBA, gl.UNSIGNED_BYTE, data);
  let bright = 0, opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] + data[i + 1] + data[i + 2] > 30) bright++;
    if (data[i + 3] > 10) opaque++;
  }
  return { bright, opaque, sphereRadius: sphere.radius, distance, box: { min: box.min.toArray(), max: box.max.toArray() } };
};
window.__ready = true;
</script></body></html>`;

const MIME = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE);
    if (url.pathname === '/model.glb') return res.writeHead(200, { 'Content-Type': 'model/gltf-binary' }).end(await readFile(MODEL));
    if (url.pathname.startsWith('/nm/')) {
      const rel = url.pathname.slice(4);
      const file = rel.startsWith('three/addons/')
        ? join(ROOT, 'node_modules', 'three', 'examples', 'jsm', rel.slice('three/addons/'.length))
        : join(ROOT, 'node_modules', rel);
      return res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    }
    res.writeHead(404).end('not found');
  } catch (err) {
    res.writeHead(404).end(String(err));
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = join(ROOT, '.bake-profile');

async function main() {
  await mkdir(OUT, { recursive: true });
  await rm(PROFILE, { recursive: true, force: true });
  await new Promise((r) => server.listen(PORT, r));

  const chrome = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=9342', `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=400,400', 'about:blank',
  ], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 80 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch('http://127.0.0.1:9342/json/list')).json()).find((t) => t.type === 'page'); } catch { /* starting */ }
  }
  if (!target) throw new Error('Could not attach to Chrome');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
    return r.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: `http://localhost:${PORT}/` });

  for (let i = 0; i < 100; i++) {
    if (await evaluate('!!window.__ready').catch(() => false)) break;
    await sleep(250);
  }
  if (!(await evaluate('!!window.__ready'))) throw new Error('Renderer never became ready');

  const info = await evaluate('window.clipInfo');
  console.log(`Clip: ${info.name} (${info.duration.toFixed(3)} s)`);
  const dbg = await evaluate('window.debugInfo()');
  console.log(`Frame 0 check: ${dbg.bright} lit / ${dbg.opaque} opaque px, radius ${dbg.sphereRadius.toFixed(4)}, distance ${dbg.distance.toFixed(3)}`);

  for (let i = 0; i < FRAMES; i++) {
    const dataUrl = await evaluate(`window.renderFrame(${i}, ${FRAMES})`);
    await writeFile(join(OUT, `cat_walk_${i}.png`), Buffer.from(String(dataUrl).split(',')[1], 'base64'));
  }

  ws.close();
  chrome.kill();
  console.log(`Wrote ${FRAMES} walk frames to public/sprites/`);
}

main()
  .then(async () => {
    server.close();
    await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(`Bake failed: ${err.message}`);
    server.close();
    await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
    process.exit(1);
  });
