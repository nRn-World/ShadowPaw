/**
 * Shadow Paw - the hero cat as a sprite atlas.
 *
 * Draws transparent frames baked from the CC0 Vuena cat model with the same
 * feet-origin contract as the vector catSprite, so every caller - the game,
 * the shop preview and the attract loop - shows the same character.
 *
 * The sprite bake keeps the model's real `idle`, `run` and `jump` animation
 * clips. Skins are honoured by tinting the baked fur toward the skin colour
 * while preserving the model's shading and glossy eyes.
 *
 * Source and bake command: `public/models/vuena/animal_cat.glb` and
 * `node scripts/render-cat-sprites.mjs`. See ASSET_LICENSES.md.
 */

const URL = 'sprites/cat_idle_1.png';
// Four samples of the model's real run clip at the gameplay three-quarter
// angle. They cycle while the cat is grounded and moving, so the legs move
// instead of the old single-pose bob.
const RUN_URLS = [
  'sprites/cat_run_frame_0.png',
  'sprites/cat_run_frame_1.png',
  'sprites/cat_run_frame_2.png',
  'sprites/cat_run_frame_3.png',
];
const JUMP_URL = 'sprites/cat_jump_1.png';
const RUN_ORDER = [0, 1, 2, 3];
const RUN_FPS = 12;

export interface AtlasCatOpts {
  /** Skin colour from the shop; tints the baked fur. */
  color: string;
  /** Skin accent; tints the neon lines and the muzzle flash. */
  accent?: string;
  t: number;
  running: boolean;
  jumping: boolean;
  grounded?: boolean;
  vy?: number;
  facing?: 1 | -1;
  speed?: number;
  phase?: number;
  dashing?: boolean;
  hurt?: boolean;
  shooting?: boolean;
  /** Draw the baked art in its original colours, with no skin tint. */
  original?: boolean;
  /** Drawn width in pixels; the height follows the atlas aspect. */
  w?: number;
}

interface Tight {
  img: HTMLCanvasElement;
  /** Transparent margins inside the raw PNG. */
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Tight art size and the forward face point, normalised 0..1 inside it. */
  width: number;
  height: number;
  muzzleX: number;
  muzzleY: number;
}

let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
let tight: Tight | null = null;
let jumpTight: Tight | null = null;
/** Running strides, filled in as each frame decodes; may lag `tight` briefly. */
const runTights: (Tight | null)[] = RUN_URLS.map(() => null);
let runStarted = false;
const waiters: Array<() => void> = [];
/** Tinted copies keyed by `tag_color_accent` (tag names the pose). */
const tinted = new Map<string, HTMLCanvasElement>();

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Fallback matte for un-baked copies of the art: the raw render ships with no
 * alpha channel - the "transparent" background is a baked-in grey checkerboard.
 * Build the matte on a half-size copy: flood fill in from the border over both
 * checker shades, then close the dither holes the flood leaves behind (a
 * cleared neighbourhood votes a pixel background). The cat's own greys are
 * chromatic or enclosed by fur, so they survive both passes. Half size keeps
 * the pixel math cheap and doubles as a light blur on the matte edge. The
 * baked atlas (scripts/bake-cat-atlas.mjs) already carries real alpha, so this
 * only runs when the PNG arrives without one.
 */
const knockOutChecker = (data: Uint8ClampedArray, w: number, h: number) => {
  const at = (x: number, y: number) => (y * w + x) * 4;
  const lum = (i: number) => (data[i] + data[i + 1] + data[i + 2]) / 3;
  // The checker ships as two grey squares per cell, so the background lives on
  // two luminance bands. Find them from a histogram of the border ring rather
  // than min/max, which anti-aliased cat edges would stretch too wide.
  const hist = new Uint32Array(256);
  const addEdge = (i: number) => {
    const l = Math.round(clamp(lum(i), 0, 255));
    hist[l]++;
  };
  for (let x = 0; x < w; x++) {
    addEdge(at(x, 0));
    addEdge(at(x, h - 1));
  }
  for (let y = 0; y < h; y++) {
    addEdge(at(0, y));
    addEdge(at(w - 1, y));
  }
  // Smooth the histogram so a one-bin spike cannot outrank a real band.
  const smooth = new Float64Array(256);
  for (let l = 0; l < 256; l++) {
    let s = 0;
    let n = 0;
    for (let d = -2; d <= 2; d++) {
      const k = l + d;
      if (k >= 0 && k < 256) {
        s += hist[k];
        n++;
      }
    }
    smooth[l] = s / n;
  }
  let bandA = -1;
  for (let l = 8; l < 248; l++) {
    if (smooth[l] >= smooth[l - 1] && smooth[l] >= smooth[l + 1] && smooth[l] > 0) {
      if (bandA < 0 || smooth[l] > smooth[bandA]) bandA = l;
    }
  }
  let bandB = -1;
  for (let l = 8; l < 248; l++) {
    if (l === bandA || Math.abs(l - bandA) < 6) continue;
    if (smooth[l] >= smooth[l - 1] && smooth[l] >= smooth[l + 1] && smooth[l] > 0) {
      if (bandB < 0 || smooth[l] > smooth[bandB]) bandB = l;
    }
  }
  if (bandA < 0) return;
  const nearBand = (l: number) =>
    Math.abs(l - bandA) <= 20 || (bandB >= 0 && Math.abs(l - bandB) <= 20);
  const isBg = (i: number) => {
    const l = lum(i);
    if (!nearBand(l)) return false;
    // The checker is neutral grey; anything with a colour cast is the cat's
    // own art (green neon, the teal blaster, warm fur shading).
    const spread = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    return spread < 28;
  };
  const bg = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isBg(at(x, y))) {
      bg[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // Hole closing: the checker dithers, so single kept pixels sit inside
  // cleared seas. One dilate + one erode seals the dither gaps without
  // eating into the cat: growth is only allowed on pixels that match the
  // checker tones tightly, and the erode hands the boundary back.
  const matches = (p: number) => isBg(p * 4);
  let grown = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (bg[p]) {
        grown[p] = 1;
        continue;
      }
      if (!matches(p)) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const qx = x + dx;
          const qy = y + dy;
          if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
          if (bg[qy * w + qx]) n++;
        }
      }
      if (n >= 3) grown[p] = 1;
    }
  }
  bg.set(grown);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (!bg[p]) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (bg[(y + dy) * w + (x + dx)]) n++;
        }
      }
      if (n < 8) bg[p] = 0;
    }
  }
  for (let p = 0; p < w * h; p++) {
    if (bg[p]) data[p * 4 + 3] = 0;
  }
};

/** Resolves immediately when the atlas is already usable. Kicks the load. */
export const whenCatAtlasReady = (): Promise<void> => {
  loadCatAtlas();
  return state === 'ready' || state === 'failed' ? Promise.resolve() : new Promise((res) => waiters.push(res));
};

export const catAtlasReady = () => state === 'ready' && !!tight;

/**
 * Resolve the drawn art and its tight box. The offline bake already knocked
 * the checkerboard out into a real alpha channel, so use the PNG untouched at
 * full resolution; only an un-baked (opaque-corner) copy goes through the
 * runtime matte fallback.
 */
const buildMatte = (src: HTMLImageElement): Tight | null => {
  const sampler = document.createElement('canvas');
  sampler.width = 1;
  sampler.height = 1;
  const sctx = sampler.getContext('2d', { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(src, 0, 0, 1, 1, 0, 0, 1, 1);
  const needsMatte = sctx.getImageData(0, 0, 1, 1).data[3] > 200;

  // Half size only for the fallback: cheaper pixel math and a softer matte edge.
  const scale = needsMatte ? 0.5 : 1;
  const w = Math.max(1, Math.round(src.naturalWidth * scale));
  const h = Math.max(1, Math.round(src.naturalHeight * scale));
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, w, h);
  if (needsMatte) {
    const imageData = ctx.getImageData(0, 0, w, h);
    knockOutChecker(imageData.data, w, h);
    ctx.putImageData(imageData, 0, 0);
  }

  // Tight box over the alpha, sampled at a quarter size to stay cheap.
  const pw = Math.max(1, Math.floor(w / 4));
  const ph = Math.max(1, Math.floor(h / 4));
  const probe = document.createElement('canvas');
  probe.width = pw;
  probe.height = ph;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  if (!pctx) return null;
  pctx.drawImage(canvas, 0, 0, pw, ph);
  const data = pctx.getImageData(0, 0, pw, ph).data;
  let minX = pw;
  let minY = ph;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      if (data[(y * pw + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const sx = w / pw;
  const sy = h / ph;
  const left = minX * sx;
  const top = minY * sy;
  const right = w - (maxX + 1) * sx;
  const bottom = h - (maxY + 1) * sy;
  return {
    img: canvas,
    left,
    top,
    right,
    bottom,
    width: w - left - right,
    height: h - top - bottom,
    // The new model has no weapon; shots leave from the nose as a small
    // in-world muzzle flash, keeping the existing shooting mechanic readable.
    muzzleX: 0.9,
    muzzleY: 0.45,
  };
};

/** Decode one image URL and resolve with its tight box (or null on failure). */
const loadTight = (url: string, cb: (t: Tight | null) => void) => {
  const img = new Image();
  img.onload = () => {
    try {
      cb(buildMatte(img));
    } catch {
      // A tainted canvas or a missing 2D context only costs this frame.
      cb(null);
    }
  };
  img.onerror = () => cb(null);
  img.src = url;
};

/** Kick the four running strides. They fill `runTights` independently; the
    game falls back to the idle stance until a given frame has decoded. */
const loadRunFrames = () => {
  if (runStarted) return;
  runStarted = true;
  RUN_URLS.forEach((url, i) => loadTight(url, (t) => { runTights[i] = t; }));
};

export const loadCatAtlas = () => {
  if (state !== 'idle') return;
  state = 'loading';
  loadRunFrames();
  loadTight(JUMP_URL, (t) => { jumpTight = t; });
  loadTight(URL, (t) => {
    tight = t;
    state = t ? 'ready' : 'failed';
    waiters.splice(0).forEach((res) => res());
  });
};

/**
 * A tinted copy of the atlas for one skin. A multiply pass darkens toward the
 * skin colour, then a `color` blend pass carries the hue into the white fur -
 * multiply alone leaves the baked whites nearly untouched, so every skin reads
 * as the same cat. The accent wash relights the neon lines. All passes keep the
 * alpha channel untouched.
 *
 * The tint colours are pre-clipped to the cat's silhouette (a source-in fill of
 * the art's own alpha) before they are blended in. That way the blend passes
 * only ever touch pixels the cat actually occupies, so they cannot paint the
 * transparent margins into a solid rectangle around it.
 */
const getTinted = (src: Tight, color: string, accent: string, tag: string, original = false) => {
  const key = original ? `${tag}_original` : `${tag}_${color}_${accent}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  // Cap the working size; the game never draws the atlas bigger than this.
  const scale = Math.min(1, 512 / src.width);
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(src.img, src.left, src.top, src.width, src.height, 0, 0, w, h);
  // The original skin keeps the baked art exactly as drawn - no blend passes.
  if (original) {
    tinted.set(key, canvas);
    return canvas;
  }

  // A flat colour shaped exactly like the cat, used as the blend source.
  const silhouette = (fill: string) => {
    const layer = document.createElement('canvas');
    layer.width = w;
    layer.height = h;
    const lctx = layer.getContext('2d');
    if (!lctx) return null;
    lctx.drawImage(src.img, src.left, src.top, src.width, src.height, 0, 0, w, h);
    lctx.globalCompositeOperation = 'source-in';
    lctx.fillStyle = fill;
    lctx.fillRect(0, 0, w, h);
    return layer;
  };
  const fur = silhouette(color);
  const neon = silhouette(accent);
  if (!fur || !neon) return null;

  // Multiply darkens the colored fur toward the skin tone while the `color`
  // pass retints the white patches - together every skin reads at a glance,
  // even in a 90px shop thumbnail, without flattening the baked shading.
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.35;
  ctx.drawImage(fur, 0, 0);
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = 0.5;
  ctx.drawImage(fur, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.1;
  ctx.drawImage(neon, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  tinted.set(key, canvas);
  return canvas;
};

/**
 * Pick which baked frame the cat should show for a set of motion flags, so the
 * renderer and the muzzle helper always agree on the same pose. The jump
 * frame is preferred in the air; the run samples are used only on the ground.
 */
const chooseFrame = (
  moving: boolean,
  air: boolean,
  dashing: boolean,
  t: number,
): { src: Tight; tag: string } => {
  if (air && jumpTight) return { src: jumpTight, tag: 'jump' };
  if (moving && !air && !dashing) {
    const fi = RUN_ORDER[Math.floor(t * RUN_FPS) % RUN_ORDER.length];
    const rt = runTights[fi];
    if (rt) return { src: rt, tag: `run${fi}` };
  }
  return { src: tight as Tight, tag: 'idle' };
};

/**
 * Where the blaster muzzle is, in world-space pixel offsets from the cat's
 * anchor (the point passed to drawCatAtlasSprite: horizontal centre, feet).
 * Returns null before the atlas has decoded. `dx` is already signed by facing
 * and `dyUp` is how far above the paw line the barrel sits, so the caller can
 * spawn a bullet exactly where the muzzle flash appears.
 */
export const getCatMuzzle = (
  o: { facing?: 1 | -1; moving?: boolean; air?: boolean; dashing?: boolean; t: number; w?: number },
): { dx: number; dyUp: number } | null => {
  if (state !== 'ready' || !tight) return null;
  const { src } = chooseFrame(!!o.moving, !!o.air, !!o.dashing, o.t);
  const w = o.w ?? 64;
  const h = (w * src.height) / src.width;
  const facing = o.facing === -1 ? -1 : 1;
  return {
    dx: facing * (w * (src.muzzleX - 0.5)),
    dyUp: h * (1 - src.muzzleY),
  };
};

/**
 * Draw the atlas cat standing on (x, y) - the paws - facing right by default.
 * Returns false when the atlas is not (or will never be) available, so the
 * caller can fall back to the vector cat.
 */
export const drawCatAtlasSprite = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  o: AtlasCatOpts,
): boolean => {
  loadCatAtlas();
  if (state !== 'ready' || !tight) return false;

  const accent = o.accent ?? '#2bee79';

  const w = o.w ?? 64;
  const facing = o.facing === -1 ? -1 : 1;
  const air = o.jumping || o.grounded === false;
  const moving = o.running || Math.abs(o.speed ?? 0) > 0.35;
  const phase = o.phase ?? o.t * 11;

  // While grounded and moving, cycle the baked run samples so the legs
  // actually move; use the model's jump pose in the air and fall back to idle
  // only while a frame is still decoding.
  const { src, tag } = chooseFrame(moving, air, o.dashing ?? false, o.t);

  const art = getTinted(src, o.color, accent, tag, o.original);
  if (!art) return false;
  const h = (w * src.height) / src.width;

  // Poses from cheap transforms on the chosen art.
  let bob = 0;
  let tilt = 0;
  let scaleX = 1;
  let scaleY = 1;
  if (air) {
    // Nose down on the way up, nose level on the way down - a leap, not a flip.
    tilt = o.vy != null ? clamp(-o.vy * 0.008, -0.09, 0.07) : -0.05;
    bob = -h * 0.02;
  } else if (o.dashing) {
    tilt = -0.12;
    scaleX = 1.06;
    scaleY = 0.94;
  } else if (tag !== 'idle') {
    // The stride frames carry the leg motion; a whisper of bob keeps it lively
    // without fighting the artwork.
    bob = -Math.abs(Math.sin(o.t * RUN_FPS * Math.PI)) * h * 0.015;
    tilt = -0.02;
  } else if (moving) {
    bob = -Math.abs(Math.sin(phase)) * h * 0.03;
    tilt = -0.03 + Math.sin(phase * 2) * 0.015;
  } else {
    // Idle breath.
    const breath = 1 + Math.sin(o.t * 2.2) * 0.012;
    scaleY = breath;
    scaleX = 2 - breath;
    bob = Math.sin(o.t * 2.2) * h * 0.006;
  }

  ctx.save();
  if (o.hurt) ctx.globalAlpha = 0.85;
  ctx.translate(x, y);
  ctx.scale(facing * scaleX, scaleY);
  ctx.rotate(tilt);
  ctx.drawImage(art, -w / 2, -h + bob, w, h);

  // The Vuena idle clip is sampled from the model itself, so the baked
  // expression is kept intact instead of covering the eyes with a hard-coded
  // lid rectangle from the former cat art.
  ctx.restore();

  if (o.shooting) {
    // The shot point is the model's nose; mirror it with the facing so the
    // existing blaster mechanic remains visible without adding a weapon mesh.
    const mx = x + facing * (w * (src.muzzleX - 0.5));
    const my = y - h * (1 - src.muzzleY) + bob;
    const flash = h * (0.09 + Math.sin(o.t * 60) * 0.02);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,214,140,0.92)';
    ctx.beginPath();
    ctx.arc(mx, my, flash, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(mx + facing * flash * 0.5, my, flash * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return true;
};
