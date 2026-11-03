// Probe: can the level be completed at the quota (not all fish)?
import { launchBrowser } from './browser.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.locator('button', { hasText: /Play now/i }).first().click();
await page.waitForTimeout(3500);

const cfg = await page.evaluate(() => {
  const g = window.__SP;
  return { goal: g.fishGoal, fishes: g.fishes.length, levelLength: g.levelLength, pw: g.player.width, jerry: Math.round(g.jerry.x), lw: g.jerry.width };
});
console.log('config:', JSON.stringify(cfg));

// Mark exactly `goal` fish collected (the first ones), teleport near Jerry.
await page.evaluate(() => {
  const g = window.__SP;
  g.fishes.forEach((f, i) => { if (i < g.fishGoal) f.collected = true; });
  g.player.x = g.jerry.x - 260;
});
await page.waitForTimeout(300);

await page.keyboard.down('ArrowRight');
await page.waitForTimeout(3500);
await page.keyboard.up('ArrowRight');

const after = await page.evaluate(() => {
  const g = window.__SP;
  return {
    running: !!g.running, x: Math.round(g.player.x), vx: +g.player.velocityX.toFixed(2),
    flags: g.fishes.filter((f) => f.collected).length, goal: g.fishGoal,
    warning: !!g.showFishWarning,
    overlay: document.body.innerText.match(/NICELY DONE|LEVEL \d+ CLEARED|COLLECT \d+ MORE/i)?.[0] || null,
  };
});
console.log('at jerry:', JSON.stringify(after));
await page.screenshot({ path: 'tmp-atlas-test/quota-end.png' });
await browser.close();
