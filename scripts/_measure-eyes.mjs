// TEMP: measure the cat's eye position precisely, in tight-box normalised coords.
import { launchBrowser } from './browser.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const browser = await launchBrowser();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const isRunning = () => page.evaluate(() => !!(window.__SP && window.__SP.running));
let started = false;
for (let a = 0; a < 4 && !started; a++) {
  try { await page.locator('button', { hasText: /Play now|Spela nu/i }).first().click({ timeout: 4000 }); } catch {}
  for (let w = 0; w < 20 && !started; w++) { await page.waitForTimeout(300); started = await isRunning(); }
}
if (!started) { await browser.close(); throw new Error('no gameplay'); }
await page.waitForTimeout(3600);

const res = await page.evaluate(async () => {
  // 1. Real tight box of the idle art (alpha bbox), same as buildMatte.
  const img = new Image();
  img.src = 'cat_character.png';
  await img.decode();
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = iw; c.height = ih;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const id = cx.getImageData(0, 0, iw, ih).data;
  let l = iw, t = ih, r = -1, b = -1;
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    if (id[(y * iw + x) * 4 + 3] > 8) {
      if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y;
    }
  }
  const tw = r - l + 1, th = b - t + 1;

  // 2. Find the yellow-green eyes in the bright source PNG (the night scene
  //    dims the composited canvas too much to colour-key there). Normalised in
  //    the same tight box the renderer uses for the muzzle and the lid.
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, n = 0;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    const i = (y * iw + x) * 4, rr = id[i], gg = id[i + 1], bb = id[i + 2];
    if (gg > 150 && rr > 140 && bb < 120 && gg >= rr - 20 && gg > bb + 60) {
      n++;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return {
    iw, ih, tightW: tw, tightH: th, aspect: (tw / th).toFixed(3),
    eyePixels: n,
    ex0: (((minX - l) / tw)).toFixed(3), ex1: (((maxX - l) / tw)).toFixed(3),
    ey0: (((minY - t) / th)).toFixed(3), ey1: (((maxY - t) / th)).toFixed(3),
  };
});
console.log(JSON.stringify(res, null, 2));
await browser.close();
