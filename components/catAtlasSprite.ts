/**
 * Shadow Paw - the hero cat as a sprite atlas.
 *
 * Draws the baked 3D character render (public/cat_character.png) with the
 * same feet-origin contract as the vector catSprite, so every caller - the
 * game, the shop preview and the attract loop - can swap between the two
 * without knowing which one is on screen.
 *
 * The atlas ships as one standing pose, so the poses are carried by cheap
 * transforms: an idle breath, a run bob, a nose-down/nose-up tilt in the air.
 * Skins are honoured by tinting the baked art toward the skin colour and
 * pushing the neon accents toward the skin accent, which keeps the original
 * shading instead of flattening the sprite to a silhouette.
 */

const URL = 'cat_character.png';
// Four running strides baked from the generated sheet (scripts/bake-run-frames
// .mjs). They are written on one shared canvas with the paws on one shared
// baseline, so the only thing that changes between them is the leg positions -
// the cat cannot grow, shrink or hop between frames.
const RUN_URLS = ['cat_run_0.png', 'cat_run_1.png', 'cat_run_2.png', 'cat_run_3.png'];

/**
 * Cycle order, in gait phase.
 *
 * Reading the sheet's four poses as a stride: 1 is the full extension (front
 * paws reaching, hind paws driving back), 2 is the gather (legs under the
 * body), 3 is the reach-through and 0 is the plant. Cycling them in that order
 * makes the legs sweep continuously instead of chattering between two similar
 * stances, which is what the old order did - it alternated a stance with
 * itself and killed the sense of speed.
 */
const RUN_ORDER = [1, 2, 3, 0];

/**
 * How far the cat travels per full stride, in world pixels, at the reference
 * sprite width. Cadence is driven by DISTANCE, not by a fixed frame rate:
 * advancing one stride per travelled distance is what stops the paws from
 * skating on the ground when the cat speeds up or slows down, and it is the
 * single biggest reason a sprite run reads as real or as a slideshow.
 *
 * Tuned so the paw contact points move at roughly the same rate as the world
 * scrolls past at normal run speed.
 */
const STRIDE_PX = 26;
/** Cadence clamp, in strides per second, so a crawl still animates and a dash
 *  does not strobe. */
const MIN_CADENCE = 2.2;
const MAX_CADENCE = 11;

/**
 * Accumulated gait phase, integrated from distance travelled.
 *
 * This has to be stateful: the renderer only knows the instantaneous speed, so
 * deriving the frame from `t * speed` directly makes the phase jump backwards
 * whenever the speed changes, and the cat visibly stutters. Advancing a phase
 * accumulator by `speed * dt` keeps the cycle continuous through acceleration.
 */
let gaitPhase = 0;
let gaitLastT = 0;
const advanceGait = (t: number, speed: number, runW: number): number => {
  const dt = gaitLastT ? Math.min(0.1, Math.max(0, t - gaitLastT)) : 0;
  gaitLastT = t;
  // World px travelled per second, relative to the sprite's drawn width.
  const pxPerSec = Math.abs(speed) * (runW / 66);
  const stridePx = STRIDE_PX * (runW / 66);
  let cadence = stridePx > 0 ? pxPerSec / stridePx : MIN_CADENCE;
  cadence = Math.min(MAX_CADENCE, Math.max(MIN_CADENCE, cadence));
  gaitPhase = (gaitPhase + cadence * dt) % RUN_ORDER.length;
  return gaitPhase;
};

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
  /** Tight art size and the blaster muzzle, normalised 0..1 inside it. */
  width: number;
  height: number;
  muzzleX: number;
  muzzleY: number;
}

let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
let tight: Tight | null = null;
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
    // The blaster muzzle sits at the far right of the art, a little above the
    // gun's lower edge; measured off the baked pose.
    muzzleX: 0.925,
    muzzleY: 0.47,
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
    game falls back to the single stance until a given frame has decoded. */
/**
 * Per-frame blaster muzzle, measured from the artwork by the bake step.
 *
 * The four strides do not hold the gun in the same place - the reach-through
 * frames carry it further forward than the gathered ones - so a single
 * hard-coded position put the muzzle flash next to the barrel on some frames
 * and through it on others. The manifest carries the real position per frame;
 * the constant below is only a fallback for an older build without it.
 */
const RUN_MANIFEST_URL = 'cat_run_manifest.json';
let runMuzzles: Array<{ muzzleX: number; muzzleY: number } | null> = RUN_URLS.map(() => null);

const loadRunFrames = () => {
  if (runStarted) return;
  runStarted = true;
  RUN_URLS.forEach((url, i) => loadTight(url, (t) => {
    if (!t) return;
    const m = runMuzzles[i];
    if (m) {
      t.muzzleX = m.muzzleX;
      t.muzzleY = m.muzzleY;
    }
    runTights[i] = t;
  }));
  // Fetch the manifest first; if it lands after a frame has decoded, patch that
  // frame in place (Tight objects are shared, so the values take effect on the
  // next draw).
  fetch(RUN_MANIFEST_URL)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !Array.isArray(data.frames)) return;
      runMuzzles = data.frames.map((f: { muzzleX: number; muzzleY: number }) => ({
        muzzleX: f.muzzleX,
        muzzleY: f.muzzleY,
      }));
      runTights.forEach((t, i) => {
        const m = runMuzzles[i];
        if (t && m) {
          t.muzzleX = m.muzzleX;
          t.muzzleY = m.muzzleY;
        }
      });
    })
    .catch(() => {
      /* older build without a manifest: the baked constants still apply */
    });
};

export const loadCatAtlas = () => {
  if (state !== 'idle') return;
  state = 'loading';
  loadRunFrames();
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
 * renderer and the muzzle helper always agree on the same pose. Falls back to
 * the single stance while running frames decode, or when idle/airborne/dashing.
 */
const chooseFrame = (
  moving: boolean,
  air: boolean,
  dashing: boolean,
  phase: number,
): { src: Tight; tag: string; step: number } => {
  if (moving && !air && !dashing) {
    const step = Math.floor(phase) % RUN_ORDER.length;
    const fi = RUN_ORDER[step];
    const rt = runTights[fi];
    if (rt) return { src: rt, tag: `run${fi}`, step };
  }
  return { src: tight as Tight, tag: 'idle', step: 0 };
};

/**
 * Where the blaster muzzle is, in world-space pixel offsets from the cat's
 * anchor (the point passed to drawCatAtlasSprite: horizontal centre, feet).
 * Returns null before the atlas has decoded. `dx` is already signed by facing
 * and `dyUp` is how far above the paw line the barrel sits, so the caller can
 * spawn a bullet exactly where the muzzle flash appears.
 */
export const getCatMuzzle = (
  o: {
    facing?: 1 | -1;
    moving?: boolean;
    air?: boolean;
    dashing?: boolean;
    t: number;
    w?: number;
    speed?: number;
  },
): { dx: number; dyUp: number } | null => {
  if (state !== 'ready' || !tight) return null;
  const w = o.w ?? 64;
  // Same accumulator as the renderer, so the muzzle follows the pose actually
  // on screen instead of a parallel guess.
  const phase = advanceGait(o.t, o.speed ?? 0, w);
  const { src } = chooseFrame(!!o.moving, !!o.air, !!o.dashing, phase);
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

  // While grounded and moving, cycle the baked strides so the legs actually
  // run; otherwise fall back to the single stance (idle, air, dash, or the
  // frames not having decoded yet).
  const gaitSpeed = Math.abs(o.speed ?? 0);
  const phaseGait = advanceGait(o.t, gaitSpeed, w);
  const { src, tag, step } = chooseFrame(moving, air, o.dashing ?? false, phaseGait);

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
    // The stride frames carry the leg motion. The vertical travel comes from
    // the gait cycle itself: the body dips at the two contact steps and lifts
    // through the gather, so the bounce is locked to the legs instead of
    // free-running against them.
    const stridePhase = (phaseGait % RUN_ORDER.length) / RUN_ORDER.length;
    bob = -Math.abs(Math.sin(stridePhase * Math.PI * 2)) * h * 0.022;
    // A small forward pitch that peaks at the extension frames sells the drive
    // from the hind legs.
    tilt = -0.014 - Math.cos(stridePhase * Math.PI * 2) * 0.012;
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

  // Blink: in the idle stance, periodically drop a strip of the cat's own
  // forehead fur down over the eyes. Because the lid is sampled from the same
  // (already tinted) art it matches every skin automatically, and it lives in
  // the sprite's own transform so it mirrors with the facing. Only in the
  // stance - the running strides move the head too much to track the eyes.
  if (tag === 'idle') {
    const CYCLE = 3.6;
    const LEN = 0.16;
    const ph = ((o.t % CYCLE) + CYCLE) % CYCLE;
    if (ph < LEN) {
      const close = Math.sin(Math.PI * (ph / LEN)); // 0 -> 1 -> 0
      const aw = art.width;
      const ah = art.height;
      const ex0 = 0.63;
      const ex1 = 0.87; // eye band, normalised inside the tight art
      const ey0 = 0.4;
      const ey1 = 0.6;
      const lidTop = 0.28; // helmet/forehead strip just above the eyes, used as the lid
      const dh = (ey1 - ey0) * h * close;
      const sh = (ey0 - lidTop) * ah;
      if (dh > 0.6 && sh > 0.6) {
        ctx.drawImage(
          art,
          ex0 * aw, lidTop * ah, (ex1 - ex0) * aw, sh,
          -w / 2 + ex0 * w, -h + bob + ey0 * h, (ex1 - ex0) * w, dh,
        );
      }
    }
  }
  ctx.restore();

  if (o.shooting) {
    // The muzzle sits on the right edge of the baked pose; mirror it with the
    // facing so the flash stays on the gun when the cat turns around.
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
