/**
 * Home-screen screenshots for design review.
 * Usage: node scripts/shoot-home.mjs   (needs npm run dev on port 3000)
 *
 * Writes screenshots/home-desktop.png (1440x900) and screenshots/home-mobile.png
 * (390x844) with a fresh save, so both show the first-visit state.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error('No Chrome/Edge executable found. Set CHROME_PATH.');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ executablePath, headless: true });

const shoot = async (name, viewport) => {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.width < 500 ? 2 : 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const out = `screenshots/${name}.png`;
  await page.screenshot({ path: out, fullPage: true });

  const size = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  console.log(`${out} ${JSON.stringify(size)} errors=${errors.length}`);
  errors.slice(0, 5).forEach((e) => console.log(`  ! ${e}`));

  await context.close();
};

await shoot('home-desktop', { width: 1440, height: 900 });
await shoot('home-mobile', { width: 390, height: 844 });
await browser.close();
