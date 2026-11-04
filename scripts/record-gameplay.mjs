/**
 * Record a clean gameplay clip for the home-page hero video.
 *
 * Instead of screencasting the whole browser (which bakes in the menu and
 * letterboxing), this drives a real run and captures the *game canvas itself*
 * with captureStream + MediaRecorder. The result is a tight, perfectly framed
 * 16:9 clip of pure gameplay, downloaded straight into public/.
 *
 * Usage: node scripts/record-gameplay.mjs   (dev server must run on :3000)
 *
 * Important: the checked-in public/gameplay-loop.webm is a baked asset, not a
 * live view. Any change to the sky / background art (sun, moon, skyline,
 * atmosphere) must be followed by re-recording this clip, otherwise the LIVE
 * RUN card on the start screen keeps showing the old artwork.
 */
import { launchBrowser } from './browser.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const FINAL = path.join('public', 'gameplay-loop.webm');
const CLIP_SECONDS = Number(process.env.CLIP_SECONDS || 16);
// The hero shows this small, so capture at 480p and a modest bitrate: a couple
// of megabytes instead of fifteen, with no visible loss at card size.
const OUT_W = 854;
const OUT_H = 480;
const BITRATE = Number(process.env.BITRATE || 1_400_000);

fs.mkdirSync('public', { recursive: true });

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));

const isRunning = () => page.evaluate(() => !!(window.__SP && window.__SP.running));

// --- Get to a running level 1 ------------------------------------------------
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// Click "Play now", retrying until the game loop is actually live. A single
// click can land before the hero buttons are wired, which previously left the
// recording stuck on the menu.
let started = false;
for (let attempt = 0; attempt < 4 && !started; attempt++) {
  try {
    await page.locator('button', { hasText: /Play now|Spela nu/i }).first().click({ timeout: 4000 });
  } catch {
    /* button not ready yet - retry */
  }
  for (let w = 0; w < 20 && !started; w++) {
    await page.waitForTimeout(300);
    started = await isRunning();
  }
}
if (!started) {
  await browser.close();
  throw new Error('Could not enter gameplay (window.__SP.running never became true).');
}
// Let the intro card / countdown clear so the clip opens on live play.
await page.waitForTimeout(3600);

// --- Start capturing the game canvas ----------------------------------------
// Blit the 1280x720 game canvas onto a smaller offscreen canvas and record
// that stream, so the file stays light without a second transcode pass.
await page.evaluate(
  ({ w, h, bitrate }) => {
    const src = [...document.querySelectorAll('canvas')].find((c) => c.width === 1280);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    let raf = 0;
    const blit = () => {
      octx.drawImage(src, 0, 0, w, h);
      raf = requestAnimationFrame(blit);
    };
    blit();
    const stream = out.captureStream(30);
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    window.__REC = { rec, chunks, stop: () => cancelAnimationFrame(raf) };
    rec.start();
  },
  { w: OUT_W, h: OUT_H, bitrate: BITRATE },
);

// --- The performance ---------------------------------------------------------
// A readable push to the right: hop often (crates + enemies), fire on a
// staggered cadence (shows shooting), collect fish along the way.
const beat = 300;
const frames = Math.round((CLIP_SECONDS * 1000) / beat);
await page.keyboard.down('ArrowRight');
for (let i = 0; i < frames; i++) {
  await page.waitForTimeout(beat);
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  await page.keyboard.press('Space');
  if (i % 2 === 0) await page.keyboard.press('KeyF');
  if (!(await isRunning())) break; // cleared or died: stop pushing
}
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(300);

// --- Stop, bundle and download the webm -------------------------------------
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.evaluate(async () => {
    const { rec, chunks, stop } = window.__REC;
    stop();
    const done = new Promise((r) => (rec.onstop = r));
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gameplay-loop.webm';
    document.body.appendChild(a);
    a.click();
  }),
]);
await download.saveAs(FINAL);
await browser.close();

const bytes = fs.statSync(FINAL).size;
if (errors.length) console.log('page errors:', errors.slice(0, 5));
console.log(`Recorded ${FINAL} (${(bytes / 1024 / 1024).toFixed(2)} MB, ~${CLIP_SECONDS}s clip)`);
