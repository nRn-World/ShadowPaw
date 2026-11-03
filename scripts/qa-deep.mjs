/**
 * Deep QA: seeded save -> boss level, purchases, settings, game over, home demo.
 * Usage: node scripts/qa-deep.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const OUT = 'screenshots/qa-deep';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const shot = async (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const clickText = async (re) => {
  const el = page.locator('button', { hasText: re }).first();
  try { await el.click({ timeout: 4000 }); await page.waitForTimeout(600); return true; }
  catch { console.log('no button:', String(re)); return false; }
};

// --- Seed a rich save ---------------------------------------------------------
// The app writes its default save on mount, so wait for that before seeding -
// seeding first would just be overwritten.
await page.goto(BASE);
await page.waitForFunction(() => localStorage.getItem('shadow_paw_progress_v2'), null, { timeout: 8000 });
await page.evaluate(() => {
  const key = 'shadow_paw_progress_v2';
  const saved = JSON.parse(localStorage.getItem(key) || '{}');
  Object.assign(saved, {
    coins: 5000,
    totalCoinsEarned: 5000,
    xp: 3000,
    level: 12,
    campaignLevel: 5,
    unlockedSkins: ['default', 'ember', 'frost', 'shadow', 'aurora'],
    stats: {
      totalEnemiesDefeated: 80, totalFishCollected: 350, totalDeaths: 4,
      perfectLevels: 2, bestCombo: 12, bossesDefeated: 2, shadowPasses: 3,
    },
  });
  localStorage.setItem(key, JSON.stringify(saved));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(5000); // let the atlas decode fully
await shot('01-home-atlas-loaded');

// --- Settings -----------------------------------------------------------------
const settingsOk = await page.locator('text=/^\\s*Settings\\s*$/i').first().click({ timeout: 3000 }).then(() => true).catch(() => false);
await page.waitForTimeout(700);
await shot('02-settings');
console.log('settings link clicked:', settingsOk);

// --- Shop purchase flow ---------------------------------------------------------
await clickText(/Home/i);
await clickText(/Shop/i);
await page.waitForTimeout(500);
// buy the first upgrade
const buyBtn = page.locator('button').filter({ hasText: /500/ }).first();
if (await buyBtn.count()) { await buyBtn.click().catch(() => {}); await page.waitForTimeout(600); }
await shot('03-shop-bought');
await clickText(/SKINS/i);
await page.waitForTimeout(400);
// equip ember
await page.locator('button, [role="button"], div.cursor-pointer').filter({ hasText: /Ember/i }).first().click().catch(() => {});
await page.waitForTimeout(700);
await shot('04-shop-ember');

// --- Boss level 5 ----------------------------------------------------------------
await clickText(/Home/i);
await clickText(/Chapters/i);
await page.waitForTimeout(500);
await shot('05-chapters-unlocked');
// click level 5 tile
await page.locator('button').filter({ hasText: /^5/ }).first().click().catch(async () => {
  await clickText(/Continue/i);
});
await page.waitForTimeout(1200);
await shot('06-boss-intro');
await page.waitForTimeout(4000); // intro + arena
// fight: run right, jump, shoot repeatedly
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  await page.keyboard.press('Space');
  await page.keyboard.press('KeyF');
}
await page.keyboard.up('ArrowRight');
await shot('07-boss-fight');
const bossState = await page.evaluate(() => {
  const g = window.__SP;
  return g ? { running: !!g.running, lives: g.lives, boss: g.boss ? { hp: g.boss.hp, phase: g.boss.phase } : null, x: Math.round(g.player.x) } : null;
});
console.log('boss state:', JSON.stringify(bossState));

// --- Game over: force lives low and take hits ------------------------------------
await page.evaluate(() => { if (window.__SP) { window.__SP.lives = 1; window.__SP.player.invincible = false; window.__SP.player.invincibleTimer = 0; } });
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(4000);
await page.keyboard.up('ArrowRight');
await shot('08-gameover-or-run');
const goState = await page.evaluate(() => ({ running: !!window.__SP?.running, lives: window.__SP?.lives }));
console.log('after hits:', JSON.stringify(goState));

console.log('\n=== ERRORS (' + errors.length + ') ===');
errors.forEach((e) => console.log(e));
await browser.close();
