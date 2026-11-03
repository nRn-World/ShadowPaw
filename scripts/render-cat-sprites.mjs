/**
 * Bakes the toon cat sculpt into a sprite sheet for the game canvas.
 *
 * The game runs on Canvas 2D, so the 3D model cannot be drawn live without
 * dragging WebGL into every frame. Instead this script renders the model once
 * from a few angles and writes PNGs that the game just blits with drawImage:
 *
 *   public/sprites/cat_<pose>_<angle>.png
 *       pose:  idle | run | jump
 *       angle: -3..4   (8 steps around the character, 45 degrees apart)
 *
 * Angle 0 faces right (the direction the sprite is drawn in), so the game can
 * flip it with ctx.scale(-1, 1) exactly like the hand-drawn cat.
 *
 * Usage: node scripts/render-cat-sprites.mjs
 * Requires the three.js dependency and a local Chrome. Deterministic: the same
 * model always produces the same pixels.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = join(ROOT, 'public', 'models', 'toon_cat_free.glb');
const OUT = join(ROOT, 'public', 'sprites');
const PORT = 4321;
const SIZE = 256;
const ANGLES = [-3, -2, -1, 0, 1, 2, 3, 4];
const POSES = ['idle', 'run', 'jump'];
// Camera height per pose, in units of the model radius. Running leans a little
// forward and jumping is seen from below so the jump still reads in the air.
const POSE_TILT = { idle: 0.18, run: 0.22, jump: -0.12 };

if (!existsSync(MODEL)) {
  console.error(`Model missing: ${MODEL}`);
  process.exit(1);
}

const { executablePath: chromePath } = await resolveExecutable();

// A tiny page that imports three.js from node_modules and exposes a render
// function the harness calls once per sprite.
const PAGE = `<!doctype html><html><body style="margin:0;background:transparent">
<script type="importmap">{"imports":{"three":"/nm/three/build/three.module.js","three/addons/":"/nm/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SIZE = ${SIZE};
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
const hemi = new THREE.HemisphereLight(0xbfe9ff, 0x1a2a20, 1.5);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(1.2, 2.2, 2.4); scene.add(key);
const rim = new THREE.DirectionalLight(0x2bee79, 3.2); rim.position.set(-1.6, 1.0, -2); scene.add(rim);
const fill = new THREE.DirectionalLight(0xff9fbf, 1.1); fill.position.set(0, 0.2, -1.5); scene.add(fill);

const gltf = await new GLTFLoader().loadAsync('/model.glb');
const model = gltf.scene;
const box = new THREE.Box3().setFromObject(model);
const centre = box.getCenter(new THREE.Vector3());
const sphere = box.getBoundingSphere(new THREE.Sphere());
model.position.sub(centre);
const group = new THREE.Group();
group.add(model);
// The sculpt ships in centimetres (radius ~322), so scale it to a unit sphere;
// otherwise the camera ends up past its far plane and renders nothing.
group.scale.setScalar(1 / sphere.radius);
scene.add(group);

// One baked walk cycle drives every pose; each pose is a frozen frame of it.
const clip = gltf.animations[0];
const POSE_TIME = { idle: 0, run: 0.25, jump: 0.5 };
const mixer = new THREE.AnimationMixer(model);
const action = mixer.clipAction(clip);
action.play();

// The sprite is blitted at hitbox size, so crop tight: the bounding sphere
// includes the outstretched tail and would leave the cat looking small.
const distance = (1 / Math.sin((camera.fov * Math.PI) / 360)) * 0.9;

window.renderSprite = async (angleIndex, tilt, pose) => {
  mixer.setTime(clip.duration * POSE_TIME[pose]);
  // 0 turns the model so its right side faces the camera.
  const a = (angleIndex * Math.PI) / 4;
  group.rotation.y = a;
  camera.position.set(0, distance * tilt, distance);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
};
window.__ready = true;
</script></body></html>`;

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE);
      return;
    }
    if (url.pathname === '/model.glb') {
      res.writeHead(200, { 'Content-Type': 'model/gltf-binary' }).end(await readFile(MODEL));
      return;
    }
    // three.js modules straight from node_modules; addon files are flat.
    if (url.pathname.startsWith('/nm/')) {
      const rel = url.pathname.slice(4);
      const file = rel.startsWith('three/addons/')
        ? join(ROOT, 'node_modules', 'three', 'examples', 'jsm', rel.slice('three/addons/'.length))
        : join(ROOT, 'node_modules', rel);
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
      return;
    }
    res.writeHead(404).end('not found');
  } catch (err) {
    res.writeHead(404).end(String(err));
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir(OUT, { recursive: true });
  await new Promise((r) => server.listen(PORT, r));

  const chrome = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=9341',
    `--user-data-dir=${join(tmpdir(), 'shadow-paw-sprite-profile')}`,
    '--no-first-run', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=400,400',
    'about:blank',
  ], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 80 && !target; i++) {
    await sleep(250);
    try {
      target = (await (await fetch('http://127.0.0.1:9341/json/list')).json()).find((t) => t.type === 'page');
    } catch { /* starting */ }
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

  for (let i = 0; i < 80; i++) {
    if (await evaluate('!!window.__ready').catch(() => false)) break;
    await sleep(250);
  }
  if (!(await evaluate('!!window.__ready'))) throw new Error('The renderer never became ready.');

  let written = 0;
  for (const pose of POSES) {
    for (const angle of ANGLES) {
      const dataUrl = await evaluate(`window.renderSprite(${angle}, ${POSE_TILT[pose]}, '${pose}')`);
      const base64 = String(dataUrl).split(',')[1];
      const name = `cat_${pose}_${angle}.png`;
      await writeFile(join(OUT, name), Buffer.from(base64, 'base64'));
      written++;
    }
  }

  ws.close();
  chrome.kill();
  console.log(`Wrote ${written} sprites to public/sprites/`);
}

main()
  .then(() => {
    server.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error(`Sprite render failed: ${err.message}`);
    server.close();
    process.exit(1);
  });
