import { launchBrowser } from './browser.mjs';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = 'screenshots/playtest';
fs.mkdirSync(OUT, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/01-home.png` });

// Start the campaign from the hero CTA.
await page.getByRole('button', { name: /PLAY NOW/i }).first().click();
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}/02-level-intro.png` });
await page.waitForTimeout(2600);

// Run right, jump, shoot and dash.
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(900);
await page.keyboard.press('Space');
await page.waitForTimeout(250);
await page.keyboard.press('Space');
await page.waitForTimeout(1200);
await page.keyboard.press('KeyF');
await page.waitForTimeout(600);
await page.keyboard.press('ShiftLeft');
await page.waitForTimeout(1200);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/03-running.png` });

const state = await page.evaluate(() => {
  const g = window.__SP;
  if (!g) return null;
  return {
    level: g.level,
    type: g.levelType,
    scrollX: Math.round(g.scrollX),
    player: {
      x: Math.round(g.player.x),
      y: Math.round(g.player.y),
      vx: Number(g.player.velocityX.toFixed(2)),
      vy: Number(g.player.velocityY.toFixed(2)),
      onGround: g.player.onGround,
      lives: g.lives,
    },
    fish: { collected: g.totalCollectedInLevel, goal: g.fishGoal, total: g.fishes.length },
    running: g.running,
  };
});

// Test pause / resume.
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/04-pause.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Open every menu and screenshot it.
await page.getByRole('button', { name: /^Chapters$/i }).first().click().catch(() => {});
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/05-chapters.png` });

await page.getByRole('button', { name: /^Shop$/i }).first().click().catch(() => {});
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/06-shop.png` });

await page.getByRole('button', { name: /^Quests$/i }).first().click().catch(() => {});
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/07-quests.png` });

await page.getByRole('button', { name: /^Leaderboard$/i }).first().click().catch(() => {});
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/08-leaderboard.png` });

console.log(JSON.stringify({ state, errors }, null, 2));
await browser.close();
