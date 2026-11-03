// Reproduce the stuck-at-end situation: run right, then try to finish.
import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.locator('button', { hasText: /Play now/i }).first().click();
await page.waitForTimeout(3500);

const snap = () => page.evaluate(() => {
  const g = window.__SP;
  if (!g) return null;
  return {
    x: Math.round(g.player.x), y: Math.round(g.player.y), vx: +g.player.velocityX?.toFixed(2), vy: +g.player.velocityY?.toFixed(2),
    onGround: g.player.onGround, jumps: g.player.jumps ?? g.player.jumpsUsed, ammo: g.ammo,
    collected: g.totalCollectedInLevel, goal: g.fishGoal, running: !!g.running,
    fishesLeft: g.fishes ? g.fishes.filter((f) => !f.collected).length : -1,
    nextFishX: g.fishes ? Math.round(Math.min(...g.fishes.filter((f) => !f.collected).map((f) => f.x))) : -1,
  };
});

// run right until near the end
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  await page.keyboard.press('Space');
  const s = await snap();
  if (s && s.x > 2800) break;
}
await page.keyboard.up('ArrowRight');
console.log('at end:', JSON.stringify(await snap()));

// try a careful double jump repeatedly for 12 seconds
for (let i = 0; i < 12; i++) {
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.press('Space');
  await page.waitForTimeout(180);
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(250);
}
console.log('after tries:', JSON.stringify(await snap()));
await page.screenshot({ path: 'screenshots/qa-tour/19-stuck-repro.png' });
await browser.close();
