/**
 * Portable UI smoke test: pause, results, game over, shop and all five
 * languages (including Arabic RTL). Complements qa-smoke.mjs, which focuses on
 * the simulation. Uses the shared browser launcher, so it runs on Linux/CI.
 *
 * Usage: npm run dev   (in another terminal, or set BASE_URL)
 *        npm run test:ui
 */
import assert from 'node:assert/strict';
import { launchBrowser, noCanvasPainting } from './browser.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'sv', name: 'Svenska', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', dir: 'ltr' },
  { code: 'es', name: 'Español', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
];

const browser = await launchBrowser();
const errors = [];
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };

async function waitFor(page, predicate, label, tries = 60) {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate(predicate)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.addInitScript(noCanvasPainting);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitFor(page, () => !!document.querySelector('header'), 'the app shell');

  // --- Shared daily seed --------------------------------------------------
  // A separate tab keeps the campaign checks below untouched.
  const dailyPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  dailyPage.on('pageerror', (e) => errors.push(`daily pageerror: ${e.message}`));
  await dailyPage.addInitScript(noCanvasPainting);
  await dailyPage.goto(BASE, { waitUntil: 'domcontentloaded' });
  await dailyPage.getByRole('button', { name: /today's run|daily run|dagens runda/i }).first().click();
  await waitFor(dailyPage, () => !!window.__SP, 'the daily game state');
  const daily = await dailyPage.evaluate(() => {
    const g = window.__SP;
    return { mode: g.runMode, seed: g.dailySeed, offset: g.seedOffset, key: g.ghostKey, level: g.level };
  });
  check('daily run uses a shared date seed and its own ghost channel', () => {
    assert.equal(daily.mode, 'daily');
    assert.match(daily.seed, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(daily.offset > 0, 'the date must change the layout seed');
    assert.ok(daily.key.startsWith('daily:'));
    assert.ok(daily.level >= 3);
  });
  // Keep the tab open: the bundled Chromium runs single-process on some hosts,
  // where closing one implicit context can take the whole browser down.

  // --- All five languages, including Arabic RTL --------------------------
  for (const lang of LANGUAGES) {
    await page.locator('button[aria-haspopup="listbox"]').first().click();
    await page.getByRole('button', { name: lang.name }).first().click();
    await waitFor(page, () => document.documentElement.lang !== '', 'language attribute');
    const state = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      hasPlayCta: [...document.querySelectorAll('button')].some((b) => /spela nu|play now|şimdi oyna|jugar ahora|العب الآن/i.test(b.textContent || '')),
      bodyText: (document.body.innerText || '').slice(0, 4000),
    }));
    check(`${lang.code} (${lang.dir}) renders a translated shell`, () => {
      assert.equal(state.lang, lang.code);
      assert.equal(state.dir, lang.dir);
      assert.ok(state.hasPlayCta, 'the translated play CTA should be visible');
      assert.ok(state.bodyText.trim().length > 20, 'the page must not be blank');
      assert.ok(!/\{\w+\}/.test(state.bodyText), 'no unfilled {placeholders} may leak into the UI');
    });
  }

  // Arabic needs real RTL flow, not just an attribute.
  {
    await page.locator('button[aria-haspopup="listbox"]').first().click();
    await page.getByRole('button', { name: 'العربية' }).first().click();
    const rtl = await page.evaluate(() => ({
      dir: document.documentElement.dir,
      computed: getComputedStyle(document.body).direction,
      lang: document.documentElement.lang,
    }));
    check('Arabic switches the document into RTL flow', () => {
      assert.equal(rtl.dir, 'rtl');
      assert.equal(rtl.lang, 'ar');
      assert.equal(rtl.computed, 'rtl');
    });
  }

  // Back to English for the stable text assertions below.
  await page.locator('button[aria-haspopup="listbox"]').first().click();
  await page.getByRole('button', { name: 'English' }).first().click();
  await waitFor(page, () => document.documentElement.lang === 'en', 'English');

  // --- Shop ---------------------------------------------------------------
  await page.getByRole('button', { name: /shop|butik/i }).first().click();
  await waitFor(page, () => /shop|skins|butik/i.test(document.body.innerText), 'the shop view');
  const shopText = await page.evaluate(() => document.body.innerText);
  check('shop renders its catalog and coin balance', () => {
    assert.ok(/skins|upgrades|shop/i.test(shopText), 'expected the shop sections');
    assert.ok(shopText.length > 200, 'the shop should not be a blank shell');
  });
  await page.getByRole('button', { name: /home|start|till startsidan|back/i }).first().click();

  // --- Pause --------------------------------------------------------------
  await page.getByRole('button', { name: /play now|spela nu/i }).first().click();
  await waitFor(page, () => !!window.__SP, 'the game state');
  await page.keyboard.press('KeyP');
  await waitFor(page, () => /game paused|spelet pausat/i.test(document.body.innerText), 'the pause modal');
  check('P opens the pause modal and freezes the run', () => {
    assert.ok(true);
  });
  const frozen = await page.evaluate(() => window.__SP.frame);
  await new Promise((r) => setTimeout(r, 150));
  const stillFrozen = await page.evaluate(() => window.__SP.frame);
  check('paused simulation does not advance frames', () => {
    assert.equal(stillFrozen, frozen);
  });
  await page.getByRole('button', { name: /resume|fortsätt/i }).first().click();
  await waitFor(page, () => !/game paused/i.test(document.body.innerText), 'pause dismissal');

  // --- Results modal + seeded perk cards ---------------------------------
  await page.evaluate(() => {
    const g = window.__SP;
    g.fishes.forEach((f) => { f.collected = true; });
    g.boss = null;
    g.player.x = g.jerry.x;
    g.player.y = g.jerry.y;
    g.player.velocityX = 0;
    g.player.velocityY = 0;
  });
  await waitFor(page, () => /nicely done|snyggt jobbat/i.test(document.body.innerText), 'the results modal');
  const cards = await page.locator('div.fixed button[aria-pressed]').count();
  const resultsText = await page.evaluate(() => document.body.innerText);
  check('results modal offers exactly three risk/reward cards', () => {
    assert.equal(cards, 3);
    assert.ok(/pick one card for the next level/i.test(resultsText), 'the card header should be translated');
  });
  await page.locator('div.fixed button[aria-pressed]').first().click();
  await waitFor(page, () => /locked for this run/i.test(document.body.innerText), 'the card lock');
  check('choosing a card locks the offer for the run', () => {
    assert.ok(true);
  });

  // --- Game over + death telemetry tip -----------------------------------
  await page.getByRole('button', { name: /quit|avsluta/i }).last().click();
  await waitFor(page, () => /game over|spelet över/i.test(document.body.innerText), 'the game over view');
  // The tip is computed in a mount effect, so wait for it explicitly.
  await waitFor(page, () => /tips from your runs|tips från dina rundor/i.test(document.body.innerText), 'the telemetry tip');
  const overText = await page.evaluate(() => document.body.innerText);
  check('game over surfaces the local death-cause tip', () => {
    assert.ok(/tips from your runs|tips från dina rundor/i.test(overText));
    assert.ok(/final score|slutpoäng/i.test(overText));
  });

  check('no runtime errors', () => {
    assert.deepEqual(errors, []);
  });
  console.log(`\n${passed} checks passed.`);
} catch (err) {
  console.error('\nUI test FAILED:', err.message);
  if (errors.length) console.error('Browser errors:', errors.slice(0, 10));
  process.exitCode = 1;
} finally {
  await browser.close();
}
