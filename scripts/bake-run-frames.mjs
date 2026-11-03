/**
 * Bakes the 2x2 running-cat sheet into four clean RGBA frames.
 *
 * The generated art (public/cat_run_sheet.jpg) ships with the "transparent"
 * background baked in as a grey checkerboard and four poses packed into one
 * image. This runs the same flood-fill matte the game uses, finds the empty
 * gutters that separate the poses, crops each to its tight box, and writes
 * public/cat_run_0.png .. cat_run_3.png so the runtime only has to load and
 * cycle finished frames.
 *
 * Usage: node scripts/bake-run-frames.mjs   (dev server must run on :3000)
 */
import { launchBrowser } from './browser.mjs';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
// The generated sheet lives in the project's art folder; copy it into public/
// just long enough to load it same-origin, then remove it so the 750 KB source
// never ships in the build.
const SHEET_SRC = '3D/cat_character_sprite/Gemini_Generated_Image_kjq6ugkjq6ugkjq6.jpg';
const SHEET_TMP = 'public/cat_run_sheet.jpg';
const SHEET = './cat_run_sheet.jpg';
fs.copyFileSync(SHEET_SRC, SHEET_TMP);

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
// Same-origin so the canvas stays readable (getImageData would throw otherwise).
await page.goto(BASE, { waitUntil: 'domcontentloaded' });

const frames = await page.evaluate(async (sheetUrl) => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Load the sheet.
  const img = new Image();
  img.src = sheetUrl;
  await img.decode();

  // Work at half size: cheaper pixel math, softer matte edge, and small enough
  // for the game (the cat never draws bigger than ~90px).
  const scale = 0.5;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  // --- Checkerboard knockout (flood fill from the border over both grey
  //     checker shades, then close the dither holes the flood leaves behind).
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const at = (x, y) => (y * w + x) * 4;
  const lum = (i) => (d[i] + d[i + 1] + d[i + 2]) / 3;
  const hist = new Uint32Array(256);
  const addEdge = (i) => {
    const spread = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    if (spread > 12) return;
    hist[clamp(Math.round(lum(i)), 0, 255)]++;
  };
  for (let x = 0; x < w; x++) { addEdge(at(x, 0)); addEdge(at(x, h - 1)); }
  for (let y = 0; y < h; y++) { addEdge(at(0, y)); addEdge(at(w - 1, y)); }
  const smooth = new Float64Array(256);
  for (let l = 0; l < 256; l++) {
    let s = 0, n = 0;
    for (let o = -2; o <= 2; o++) { const k = l + o; if (k >= 0 && k < 256) { s += hist[k]; n++; } }
    smooth[l] = s / n;
  }
  let bandA = -1;
  for (let l = 8; l < 248; l++) if (smooth[l] >= smooth[l - 1] && smooth[l] >= smooth[l + 1] && smooth[l] > 0) if (bandA < 0 || smooth[l] > smooth[bandA]) bandA = l;
  let bandB = -1;
  for (let l = 8; l < 248; l++) { if (l === bandA || Math.abs(l - bandA) < 6) continue; if (smooth[l] >= smooth[l - 1] && smooth[l] >= smooth[l + 1] && smooth[l] > 0) if (bandB < 0 || smooth[l] > smooth[bandB]) bandB = l; }
  const nearBand = (l) => Math.abs(l - bandA) <= 20 || (bandB >= 0 && Math.abs(l - bandB) <= 20);
  const isBg = (i) => {
    if (!nearBand(lum(i))) return false;
    const spread = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    return spread < 28;
  };
  const bg = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isBg(at(x, y))) { bg[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  for (let pass = 0; pass < 2; pass++) {
    const grown = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (bg[p]) { grown[p] = 1; continue; }
      if (!isBg(at(x, y))) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const qx = x + dx, qy = y + dy;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        if (bg[qy * w + qx]) n++;
      }
      if (n >= 3) grown[p] = 1;
    }
    bg.set(grown);
  }
  // Eat the dashed checker residue the soft drop-shadow leaves around the paws:
  // clear any leftover checker pixel that touches the cleared sea. Iterating a
  // few times peels the strip back layer by layer, while greys fully enclosed
  // by the cat (the helmet, the eyes) never touch the sea and so survive.
  for (let iter = 0; iter < 4; iter++) {
    const clear = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (bg[p] || !isBg(at(x, y))) continue;
      let nb = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const qx = x + dx, qy = y + dy;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        if (bg[qy * w + qx]) nb++;
      }
      if (nb >= 1) clear[p] = 1;
    }
    let any = false;
    for (let p = 0; p < w * h; p++) if (clear[p]) { bg[p] = 1; any = true; }
    if (!any) break;
  }
  for (let p = 0; p < w * h; p++) d[p * 4 + 3] = bg[p] ? 0 : 255;

  // --- Find the gutters that split the 2x2 grid: the column / row with the
  //     least opaque ink near the middle of the sheet.
  const colAlpha = new Int32Array(w);
  const rowAlpha = new Int32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = d[(y * w + x) * 4 + 3];
    colAlpha[x] += a; rowAlpha[y] += a;
  }
  const argmin = (arr, lo, hi) => { let bi = lo, bv = Infinity; for (let i = lo; i < hi; i++) if (arr[i] < bv) { bv = arr[i]; bi = i; } return bi; };
  const vx = argmin(colAlpha, Math.round(w * 0.35), Math.round(w * 0.65));
  const hy = argmin(rowAlpha, Math.round(h * 0.35), Math.round(h * 0.65));

  const tightIn = (cx0, cy0, cx1, cy1) => {
    let minX = cx1, minY = cy1, maxX = cx0, maxY = cy0;
    for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    return [minX, minY, maxX, maxY];
  };

  // --- Crop each quadrant to its tight box and emit a PNG.
  const cells = [
    [0, 0, vx, hy], [vx, 0, w, hy],
    [0, hy, vx, h], [vx, hy, w, h],
  ];
  const out = [];
  for (const [cx0, cy0, cx1, cy1] of cells) {
    let [minX, minY, maxX, maxY] = tightIn(cx0, cy0, cx1, cy1);
    // The soft drop-shadow sits on the checker below the paws and survives the
    // grey-key because the shadow darkens it off the checker bands. The game
    // paints its own ground shadow, so clear achromatic mid-grey pixels in the
    // lower part of the pose, then re-tighten so the paws stay on the baseline.
    const shadowTop = minY + Math.round((maxY - minY) * 0.55);
    for (let y = shadowTop; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const spread = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (spread < 24 && l >= 48 && l <= 140) d[i + 3] = 0;
    }
    [minX, minY, maxX, maxY] = tightIn(cx0, cy0, cx1, cy1);
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    out.push({ cell: [minX, minY, cw, ch], canvas: c });
  }
  ctx.putImageData(data, 0, 0);
  for (const { cell, canvas: c } of out) {
    const [minX, minY, cw, ch] = cell;
    c.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
  }
  const urls = out.map(({ canvas: c }) => ({ url: c.toDataURL('image/png'), w: c.width, h: c.height }));
  return { frames: urls, vx, hy, w, h };
}, SHEET);

console.log(`sheet ${frames.w}x${frames.h}  split vx=${frames.vx} hy=${frames.hy}`);
frames.frames.forEach((f, i) => console.log(`  frame ${i}: ${f.w}x${f.h}`));

for (let i = 0; i < frames.frames.length; i++) {
  const b64 = frames.frames[i].url.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(`public/cat_run_${i}.png`, Buffer.from(b64, 'base64'));
}
console.log('wrote public/cat_run_0.png .. cat_run_3.png');

fs.rmSync(SHEET_TMP, { force: true });
await browser.close();
