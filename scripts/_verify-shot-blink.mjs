// TEMP: verify (a) bullets spawn at the blaster muzzle, (b) the idle cat blinks.
import { launchBrowser } from './browser.mjs';
import fs from 'node:fs';

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

const grab = async (name) => {
  const du = await page.evaluate(() => {
    const s = [...document.querySelectorAll('canvas')].find((c) => c.width === 1280);
    const g = window.__SP, p = g.player;
    const sx = p.x - g.scrollX + p.width / 2; // face centre on screen
    const feet = p.y + p.height;
    const crop = document.createElement('canvas');
    const cw = 90, ch = 60, zoom = 7;
    crop.width = cw * zoom; crop.height = ch * zoom;
    const c = crop.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(s, sx - cw / 2, feet - ch + 6, cw, ch, 0, 0, cw * zoom, ch * zoom);
    return crop.toDataURL('image/png');
  });
  fs.writeFileSync(name, Buffer.from(du.split(',')[1], 'base64'));
};

// --- (a) muzzle origin -------------------------------------------------------
await page.keyboard.press('KeyF');
await page.waitForTimeout(30);
const m = await page.evaluate(() => {
  const g = window.__SP, p = g.player, b = g.bullets[g.bullets.length - 1];
  return {
    bx: b.x, by: b.y,
    cx: p.x + p.width / 2, cy: p.y + p.height / 2, feet: p.y + p.height,
    facing: p.facing,
  };
});
console.log('bullet vs body:', JSON.stringify(m));
console.log('  dx from centre =', (m.bx - m.cx).toFixed(1), ' (expect ~ +28*facing)');
console.log('  dy below centre =', (m.by - m.cy).toFixed(1), ' (expect +, toward mouth)');

// --- (b) blink ---------------------------------------------------------------
// Wait for a NON-blink moment, grab; then wait for the blink peak, grab.
const waitFrac = (target) => page.evaluate((tgt) => new Promise((res) => {
  const CY = 3.6;
  const check = () => {
    const ph = ((Date.now() / 1000) % CY + CY) % CY;
    const want = tgt === 'peak' ? ph < 0.12 : ph > 0.6 && ph < 1.2;
    if (want) res(); else setTimeout(check, 16);
  };
  check();
}), target);

await waitFrac('open');
await grab('screenshots/_blink_open.png');
await waitFrac('peak');
await grab('screenshots/_blink_closed.png');

await browser.close();
console.log('wrote blink_open / blink_closed');
