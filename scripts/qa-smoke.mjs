/**
 * Portable gameplay smoke test for Shadow Paw.
 *
 * Drives the real game in headless Chromium (see ./browser.mjs) and asserts the
 * rules that are easy to break: deterministic levels, a reachable fish quota,
 * checkpoints, seeded perk offers, Shadow Shift, wraith immunity, boss depth,
 * spawn protection and the life refill between levels.
 *
 * Usage:  npm run dev   (or set BASE_URL) ; npm run test:smoke
 * `page.clock` drives requestAnimationFrame at 60 Hz without waiting in real
 * time. Canvas painting is stubbed (FAST_CANVAS=0 disables it) because a
 * software-rendered 720p neon scene is far too slow in headless Chromium.
 */
import assert from 'node:assert/strict';
import { launchBrowser, noCanvasPainting } from './browser.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const FAST_CANVAS = process.env.FAST_CANVAS !== '0';

const levelSnapshot = () => {
  const g = window.__SP;
  if (!g) return null;
  const r = (n) => Math.round(n);
  // Only generation-stable fields: bobbing fish, patrolling enemies and
  // oscillating saws move as soon as the loop starts, and the two page loads
  // may have advanced a slightly different number of frames by snapshot time.
  return {
    level: g.level,
    layout: g.layout,
    fish: g.fishes.map((f) => [r(f.x), r(f.baseY), f.isFlying ? 1 : 0]),
    fishGoal: g.fishGoal,
    jerryX: r(g.jerry.x),
    enemies: g.enemies.map((e) => [r(e.baseY), e.type, e.platform, r(e.shootTimer || 0)]),
    hazards: g.hazards.map((h) => [r(h.baseX ?? h.x), h.type]),
    pickups: g.pickups.map((p) => [r(p.x), p.type]),
    springs: g.springPads.map((s) => r(s.x)),
    holes: g.holes.map((h) => [r(h.x), r(h.width)]),
    platforms: g.platforms.map((p) => [r(p.x), r(p.y), r(p.width)]),
    weather: g.weather,
    timeOfDay: g.timeOfDay,
  };
};

/** Wait for a React-driven change without relying on the mocked page clock. */
async function waitFor(page, predicate, label, tries = 40) {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const browser = await launchBrowser();
const errors = [];
let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.clock.install();
  if (FAST_CANVAS) await page.addInitScript(noCanvasPainting);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // --- Start a run --------------------------------------------------------
  await page.getByRole('button', { name: /play now|spela nu/i }).first().click();
  await waitFor(page, () => !!window.__SP, 'the game state');
  // Snapshot before the clock advances: bobbing fish, patrolling enemies and
  // oscillating saws all move once the simulation starts, so compare the
  // generated (frame-zero) layout instead.
  const first = await page.evaluate(levelSnapshot);
  const runSystems = await page.evaluate(() => {
    const g = window.__SP;
    return {
      runMode: g.runMode,
      seedOffset: g.seedOffset,
      checkpoints: g.checkpoints,
      perkOffer: g.perkOffer.map((p) => p.id),
      qualityTier: g.quality?.tier,
    };
  });

  check('new run systems are initialised on a fresh campaign', () => {
    assert.equal(runSystems.runMode, 'campaign');
    assert.equal(runSystems.seedOffset, 0);
    assert.equal(runSystems.checkpoints.length, 2, 'long levels get two checkpoints');
    assert.ok(runSystems.checkpoints[0] < runSystems.checkpoints[1]);
    assert.equal(runSystems.perkOffer.length, 3, 'three seeded risk/reward cards');
    assert.equal(runSystems.qualityTier, 0, 'quality starts at the full budget');
  });

  check('level 1 has a reachable fish quota', () => {
    assert.ok(first.fishGoal >= 1 && first.fishGoal <= first.fish.length,
      `goal ${first.fishGoal} vs ${first.fish.length} fish`);
    assert.ok(first.fish.length >= 5, `only ${first.fish.length} fish were placed`);
    for (const [x] of first.fish) {
      assert.ok(x < first.jerryX, `fish at ${x} is beyond Jerry (${first.jerryX})`);
    }
    for (const [hx, width] of first.holes) {
      if (width <= 170) continue;
      for (const [x] of first.fish) {
        assert.ok(!(x > hx - 40 && x < hx + width + 40), `fish at ${x} floats over a wide pit`);
      }
    }
    for (const [hx] of first.hazards) {
      for (const [x] of first.fish) {
        assert.ok(Math.abs(x - hx) >= 65, `fish at ${x} sits under a hazard at ${hx}`);
      }
    }
  });

  assert.equal(await page.locator('.level-intro-card').count(), 1, 'intro card should be visible');
  await page.keyboard.press('KeyA');
  await waitFor(page, () => document.querySelectorAll('.level-intro-card').length === 0, 'intro card dismissal');
  const introState = await page.evaluate(() => ({
    invincible: window.__SP.player.invincible,
    timer: window.__SP.introTimer,
  }));
  check('skipping the intro removes spawn protection', () => {
    assert.equal(introState.invincible, false);
    assert.equal(introState.timer, 0);
  });

  // --- Determinism --------------------------------------------------------
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /play now|spela nu/i }).first().click();
  await waitFor(page, () => !!window.__SP, 'the rebuilt level');
  const replay = await page.evaluate(levelSnapshot);
  check('a retry replays the exact same level', () => {
    assert.deepEqual(replay, first);
  });

  // A different level must not be a copy of the first one.
  await page.evaluate(() => window.__SP_NEXT());
  await waitFor(page, () => window.__SP?.level === 2, 'level 2');
  const second = await page.evaluate(levelSnapshot);
  check('different levels have different layouts', () => {
    assert.equal(second.level, 2);
    assert.notDeepEqual(second.fish, first.fish);
  });

  // --- Life refill --------------------------------------------------------
  await page.evaluate(() => {
    const g = window.__SP;
    g.lives = 2;
    g.noHit = true;
    g.bossDefeatedInRun = false;
    window.__SP_NEXT();
  });
  await waitFor(page, () => window.__SP?.level === 3, 'level 3');
  const livesAfter = await page.evaluate(() => window.__SP.lives);
  check('a flawless clear restores two lives for the next level', () => {
    assert.equal(livesAfter, 4);
  });

  const mini = await page.evaluate(() => ({
    isMini: !!window.__SP.boss?.isMini,
    hp: window.__SP.boss?.hp || 0,
    exposed: window.__SP.boss?.coreExposed,
  }));
  check('level % 5 === 3 has a miniboss with an exposable core', () => {
    assert.equal(mini.isMini, true);
    assert.ok(mini.hp > 0 && mini.hp < 20, 'a miniboss is shorter than a full fight');
    assert.equal(mini.exposed, 0);
  });

  // --- Shadow Shift -------------------------------------------------------
  await page.evaluate(() => { window.__SP.shadowCharge = 100; });
  await page.keyboard.press('KeyE');
  const shifted = await page.evaluate(() => {
    const g = window.__SP;
    return {
      active: g.shadowActive,
      charge: g.shadowCharge,
      invincible: g.player.invincible,
      speed: g.player.speed,
      baseSpeed: g.player.baseSpeed,
      shifts: g.shadowShifts,
    };
  });
  check('E spends a full meter and starts the transformation', () => {
    assert.ok(shifted.active > 0, 'shadowActive should be counting down');
    assert.equal(shifted.charge, 0);
    assert.equal(shifted.invincible, true);
    assert.ok(shifted.speed > shifted.baseSpeed, 'the cat should be faster');
    assert.ok(shifted.shifts >= 1, 'the shift should be counted');
  });

  // Put an enemy directly on the cat and let a few frames run.
  const beforeScore = await page.evaluate(() => {
    const g = window.__SP;
    if (!g.enemies.length) {
      g.enemies.push({ x: g.player.x, y: g.player.y, width: 40, height: 40, velocityX: 0, type: 0, platform: 0, baseY: g.player.y });
    } else {
      const e = g.enemies[0];
      e.x = g.player.x - 5;
      e.y = g.player.y;
      // Hoppers and wraiths derive y from baseY each frame; keep the injected
      // target at the cat's height so the pass-through collision is testable.
      e.baseY = g.player.y;
      e.platform = 0;
      e.shadowKilled = false;
    }
    return g.score;
  });
  await page.clock.runFor(120);
  const passedState = await page.evaluate(() => ({
    passes: window.__SP.shadowPasses,
    score: window.__SP.score,
    lives: window.__SP.lives,
  }));
  check('running through an enemy while shifted defeats it', () => {
    assert.ok(passedState.passes >= 1, 'a shadow pass should be counted');
    assert.ok(passedState.score > beforeScore, 'the pass should score');
    assert.ok(passedState.lives >= 1, 'the cat must not take damage while shifted');
  });

  // Let the form lapse: speed and invulnerability must be restored. Clear the
  // stage first so a stray patrol cannot re-trigger invincibility frames.
  await page.evaluate(() => {
    const g = window.__SP;
    g.enemies.length = 0;
    g.hazards.length = 0;
    g.enemyBullets.length = 0;
    g.boss = null;
  });
  await page.clock.runFor(4500);
  const ended = await page.evaluate(() => ({
    active: window.__SP.shadowActive,
    speed: window.__SP.player.speed,
    baseSpeed: window.__SP.player.baseSpeed,
    invincible: window.__SP.player.invincible,
  }));
  check('the transformation ends cleanly', () => {
    assert.equal(ended.active, 0);
    assert.equal(ended.speed, ended.baseSpeed);
    assert.equal(ended.invincible, false);
  });

  // A shadow wraith cannot be shot or stomped; only a Shift pass removes it.
  await page.evaluate(() => {
    const g = window.__SP;
    g.enemies.length = 0;
    g.boss = null;
    g.enemies.push({
      x: g.player.x + 8, y: g.player.y, width: 42, height: 44,
      velocityX: 0, type: 6, isShadow: true, platform: 0,
      baseY: g.player.y, shootTimer: 0, chargeTimer: 0,
    });
    g.bullets.push({ x: g.player.x + 20, y: g.player.y + 20, vx: 0, vy: 0, radius: 8, life: 120 });
  });
  await page.clock.runFor(160);
  const wraith = await page.evaluate(() => ({
    alive: window.__SP.enemies.some((e) => e.isShadow && e.x > -500),
    lives: window.__SP.lives,
  }));
  check('shadow wraiths survive bullets and normal collisions', () => {
    assert.equal(wraith.alive, true);
    assert.ok(wraith.lives >= 1);
  });

  check('no runtime errors', () => {
    assert.deepEqual(errors, []);
  });

  console.log(`\n${passed} checks passed.`);
} catch (err) {
  console.error('\nSmoke test FAILED:', err.message);
  if (errors.length) console.error('Browser errors:', errors.slice(0, 10));
  process.exitCode = 1;
} finally {
  await browser.close();
}
