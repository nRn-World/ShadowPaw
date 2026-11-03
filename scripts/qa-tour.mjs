/**
 * Full QA tour: every view, a real run, error capture.
 * Usage: node scripts/qa-tour.mjs  (dev server must run on :3000)
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = 'screenshots/qa-tour';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const warnings = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
  if (m.type() === 'warning') warnings.push(`[warn] ${m.text().slice(0, 160)}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => errors.push(`[reqfail] ${r.url().slice(-60)} ${r.failure()?.errorText}`));

const shot = async (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const click = async (re, label) => {
  try {
    await page.locator('button', { hasText: re }).first().click({ timeout: 5000 });
  } catch (e) {
    errors.push(`[click-fail] ${label || re}`);
  }
  await page.waitForTimeout(650);
};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot('01-home');

// --- Menu views -------------------------------------------------------------
await click(/Chapters/i, 'chapters');
await shot('02-chapters');
await click(/Shop/i, 'shop');
await shot('03-shop-upgrades');
// buy first upgrade if affordable state renders
await click(/SKINS/i, 'shop-skins');
await shot('04-shop-skins');
await click(/PERKS/i, 'shop-perks');
await shot('05-shop-perks');
await click(/Quests/i, 'quests');
await shot('06-quests');
await click(/Leaderboard/i, 'leaderboard');
await shot('07-leaderboard');
// settings lives in the footer of the home view - go home first
await click(/Home/i, 'home-before-settings');
await click(/Settings/i, 'settings');
await shot('08-settings-maybe');
await click(/Home/i, 'home');

// --- How to play (footer or menu) -------------------------------------------
await click(/How to play|Så spelar du/i, 'howto');
await shot('09-howto');
await click(/Home/i, 'home2');

// --- A real run ---------------------------------------------------------------
await click(/Play now/i, 'play-now');
await shot('10-level-intro');
await page.waitForTimeout(3200); // countdown / intro dismiss
await shot('11-run-start');

const snap = () => page.evaluate(() => {
  const g = window.__SP;
  if (!g) return null;
  return {
    level: g.level, running: !!g.running, lives: g.lives,
    x: Math.round(g.player?.x), y: Math.round(g.player?.y),
    onGround: g.player?.onGround, collected: g.totalCollectedInLevel, goal: g.fishGoal,
    ammo: g.ammo, coins: g.coinsThisLevel, dist: g.jerry ? Math.round((g.jerry.x - g.player.x) / 40) : -1,
    enemies: g.enemies?.length, boss: !!g.boss, timer: Math.round(g.levelTimer || 0),
  };
});
console.log('start:', JSON.stringify(await snap()));

// run right + jump + shoot for a while
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await page.keyboard.press('Space'); // double jump
  await page.keyboard.press('KeyF'); // shoot
  await page.waitForTimeout(500);
}
await page.keyboard.up('ArrowRight');
await shot('12-run-mid');
console.log('mid:', JSON.stringify(await snap()));

// dash
await page.keyboard.down('ArrowRight');
await page.keyboard.press('ShiftLeft');
await page.waitForTimeout(900);
await page.keyboard.up('ArrowRight');
await shot('13-dash');

// pause / resume
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await shot('14-pause');
console.log('paused-state:', JSON.stringify(await snap()));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// keep running to reach the goal (a slow start or wasted jumps need headroom)
const cleared = () => page.evaluate(() => /CLEARED|NIVÅ CLEARED|CLEARAD/i.test(document.body.innerText));
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  await page.keyboard.press('Space');
  const s = await snap();
  if (!s || !s.running || await cleared()) break;
  if (s.collected >= s.goal && s.dist < 5) break;
}
await page.keyboard.up('ArrowRight');

// A missed fish is recoverable by design - run back left, then forward again.
let s = await snap();
if (s && s.running && s.collected < s.goal) {
  for (let pass = 0; pass < 2 && s.collected < s.goal; pass++) {
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(6000);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    await page.keyboard.down('ArrowRight');
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(500);
      await page.keyboard.press('Space');
      const t = await snap();
      if (!t || !t.running || await cleared()) break;
      if (t.collected >= t.goal && t.dist < 5) break;
    }
    await page.keyboard.up('ArrowRight');
    s = await snap();
  }
}
await page.waitForTimeout(800);
await shot('15-run-end');
console.log('end:', JSON.stringify(await snap()));

// level complete? advance
await click(/Next level|Nästa nivå|Continue|Fortsätt/i, 'next-level');
await page.waitForTimeout(1500);
await shot('16-after-next');

// --- Mobile viewport ----------------------------------------------------------
await page.setViewportSize({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.waitForTimeout(900);
await shot('17-mobile-home');
await page.setViewportSize({ width: 844, height: 390, isMobile: true, hasTouch: true });
await page.waitForTimeout(900);
await shot('18-mobile-landscape');

console.log('\n=== ERRORS (' + errors.length + ') ===');
errors.forEach((e) => console.log(e));
console.log('\n=== WARNINGS (' + warnings.length + ') ===');
warnings.slice(0, 20).forEach((w) => console.log(w));
await browser.close();
