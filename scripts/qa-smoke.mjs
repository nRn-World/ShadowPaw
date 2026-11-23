/**
 * Portable gameplay smoke test for Shadow Paw.
 *
 * Drives the real game in headless Chromium (see ./browser.mjs) and asserts the
 * rules that are easy to break: deterministic levels, a reachable fish quota,
 * checkpoints, seeded perk offers, Shadow Shift, wraith immunity, boss depth,
 * spawn protection and the fixed three-life budget on every level.
 *
 * Usage:  npm run dev   (or set BASE_URL) ; npm run test:smoke
 * `page.clock` drives requestAnimationFrame at 60 Hz without waiting in real
 * time. Canvas painting is stubbed (FAST_CANVAS=0 disables it) because a
 * software-rendered 720p neon scene is far too slow in headless Chromium.
 */
import assert from 'node:assert/strict';
import { launchBrowser, noCanvasPainting } from './browser.mjs';

const rawBase = process.env.BASE_URL || 'http://localhost:3000';
const BASE = `${rawBase}${rawBase.includes('?') ? '&' : '?'}qa=1`;
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
      lives: g.lives,
      maxLives: g.maxLives,
    };
  });

  check('new run systems are initialised on a fresh campaign', () => {
    assert.equal(runSystems.runMode, 'campaign');
    assert.equal(runSystems.seedOffset, 0);
    assert.equal(runSystems.checkpoints.length, 2, 'long levels get two checkpoints');
    assert.ok(runSystems.checkpoints[0] < runSystems.checkpoints[1]);
    assert.equal(runSystems.perkOffer.length, 3, 'three seeded risk/reward cards');
    assert.equal(runSystems.qualityTier, 0, 'quality starts at the full budget');
    assert.equal(runSystems.lives, 3, 'a stage starts with three lives');
    assert.equal(runSystems.maxLives, 3, 'the stage cap is three lives');
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

  // Fragments require Shift and are persisted independently of level completion.
  await page.keyboard.press('KeyA');
  await page.evaluate(() => {
    const g = window.__SP;
    assertSecret(g.shadowSecret);
    function assertSecret(secret) { if (!secret) throw new Error('missing level 1 shadow fragment'); }
    g.player.x = g.shadowSecret.x - g.player.width / 2;
    g.player.y = g.shadowSecret.y - g.player.height / 2;
    g.player.velocityX = 0; g.player.velocityY = 0;
  });
  await page.clock.runFor(50);
  const collectedWithoutShift = await page.evaluate(() => window.__SP.shadowSecret.collected);
  check('a shadow fragment cannot be collected without Shift', () => { assert.equal(collectedWithoutShift, false); });
  await page.evaluate(() => { window.__SP.shadowActive = 120; });
  await page.clock.runFor(50);
  await waitFor(page, () => JSON.parse(localStorage.getItem('shadow_paw_progress_v2')).shadowSecrets.includes(1), 'saved shadow fragment');
  check('Shadow Shift collects and saves a fragment', () => {});

  // A different level must not be a copy of the first one.
  await page.evaluate(() => window.__SP_NEXT());
  await waitFor(page, () => window.__SP?.level === 2, 'level 2');
  const second = await page.evaluate(levelSnapshot);
  check('different levels have different layouts', () => {
    assert.equal(second.level, 2);
    assert.notDeepEqual(second.fish, first.fish);
  });

  // Optional rescue on level 2 must be saved as soon as the cat is reached.
  await page.keyboard.press('KeyA');
  const catName = await page.evaluate(() => {
    const g = window.__SP;
    if (!g.rescueCat) throw new Error('missing level 2 rescue cat');
    g.player.x = g.rescueCat.x - g.player.width / 2;
    g.player.y = g.rescueCat.y - g.player.height / 2;
    g.player.velocityX = 0; g.player.velocityY = 0;
    return g.rescueCat.name;
  });
  await page.clock.runFor(80);
  await waitFor(page, () => JSON.parse(localStorage.getItem('shadow_paw_progress_v2')).rescuedCats.includes(2), 'saved cat rescue');
  check('level 2 rescue is saved immediately', () => assert.equal(catName, 'Miso'));

  // Crossing a mid-course island then falling must respawn at that island.
  const firstAnchor = await page.evaluate(() => {
    const g = window.__SP;
    g.checkpointIndex = 0;
    g.player.x = g.checkpoints[0];
    g.player.y = g.groundY - g.player.height - 20;
    g.player.velocityX = 0; g.player.velocityY = 0;
    return g.checkpoints[0];
  });
  await page.clock.runFor(50);
  await page.evaluate(() => { window.__SP.player.y = 900; });
  await page.clock.runFor(50);
  const respawn = await page.evaluate(() => ({ x: window.__SP.player.x, anchor: window.__SP.checkpointX }));
  check('falling returns to the mid-course checkpoint', () => {
    assert.equal(respawn.anchor, firstAnchor);
    assert.ok(Math.abs(respawn.x - firstAnchor) < 80);
  });

  // --- Three lives per level ---------------------------------------------
  await page.evaluate(() => {
    const g = window.__SP;
    // Even if the previous level ended with fewer lives, the next stage gets
    // its own fresh three-life budget rather than inheriting a run-wide pool.
    g.lives = 1;
    g.noHit = true;
    g.bossDefeatedInRun = false;
    window.__SP_NEXT();
  });
  await waitFor(page, () => window.__SP?.level === 3, 'level 3');
  const livesAfter = await page.evaluate(() => window.__SP.lives);
  check('every new level starts with exactly three lives', () => {
    assert.equal(livesAfter, 3);
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

  // A closed core is not a shield: a regular shot must still reduce HP.
  // Inject the projectile into the real fixed-step loop instead of calling a
  // damage helper so collision order and the boss state are covered together.
  const shotBefore = await page.evaluate(() => {
    const g = window.__SP;
    const b = g.boss;
    g.enemies.length = 0;
    g.enemyBullets.length = 0;
    b.projectiles.length = 0;
    // The injected shot should exercise boss collision, not depend on whether
    // the live camera has already crossed the encounter threshold or whether
    // the boss walks away during the twelve simulated frames.
    b.encountered = true;
    b.platformX = b.x;
    b.platformW = b.width;
    b.attackTimer = 9999;
    b.telegraph = 0;
    b.pendingMove = null;
    b.stunTimer = 60;
    b.coreExposed = 0;
    g.bullets.length = 0;
    g.bullets.push({
      x: b.x + b.width / 2, y: b.y + b.height / 2,
      vx: 0, vy: 0, radius: 8, life: 20,
    });
    return b.hp;
  });
  await page.clock.runFor(12);
  const shotAfter = await page.evaluate(() => window.__SP.boss.hp);
  check('a regular shot damages a boss while its core is closed', () => {
    assert.equal(shotAfter, shotBefore - 1);
  });

  // The boss route must still work when every shot is gone. Put the cat just
  // above the miniboss and let the real fixed-step collision code resolve the
  // landing; this guards the swept top-edge check against future physics edits.
  // Keep defensive invulnerability enabled intentionally: spawn/shield
  // protection must not turn an offensive stomp into a no-op.
  const stompBefore = await page.evaluate(() => {
    const g = window.__SP;
    const b = g.boss;
    g.enemies.length = 0;
    g.enemyBullets.length = 0;
    b.projectiles.length = 0;
    g.introTimer = 0;
    g.ammo = 0;
    g.player.invincible = true;
    g.player.invincibleTimer = 100;
    g.player.x = b.x + b.width / 2 - g.player.width / 2;
    g.player.y = b.y - g.player.height - 4;
    g.player.velocityY = 8;
    g.player.velocityX = 0;
    g.player.onGround = false;
    g.player.isJumping = true;
    return { hp: b.hp, ammo: g.ammo };
  });
  await page.clock.runFor(100);
  const stompAfter = await page.evaluate(() => {
    const g = window.__SP;
    return {
      hp: g.boss.hp,
      angry: g.boss.angry,
      angerLevel: g.boss.angerLevel,
      stompCount: g.boss.stompCount,
      ammo: g.ammo,
    };
  });
  check('an empty gun can damage a boss by jumping on it, which enrages it', () => {
    assert.ok(stompAfter.hp < stompBefore.hp, 'the stomp should reduce boss HP');
    assert.equal(stompAfter.angry, true);
    assert.ok(stompAfter.angerLevel >= 1);
    assert.ok(stompAfter.stompCount >= 1);
    assert.equal(stompAfter.ammo, 0);
  });
  // Return the smoke player to the spawn platform before the following
  // Shadow Shift checks; the boss arena deliberately sits far from platform 0.
  await page.evaluate(() => {
    const g = window.__SP;
    g.boss = null;
    g.enemies.length = 0;
    g.enemyBullets.length = 0;
    g.player.x = 100;
    g.player.y = g.groundY - g.player.height;
    g.player.velocityX = 0;
    g.player.velocityY = 0;
    g.player.invincible = false;
    g.player.invincibleTimer = 0;
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

  // The neon upper route must exist on every district level and pay its
  // optional bonus without changing the mandatory fish quota.
  for (let level = 4; level <= 14; level++) {
    await page.evaluate(() => window.__SP_NEXT());
    await page.waitForFunction(n => window.__SP?.level === n, level, { polling: 50 });
    if (level === 5) {
      // Repeat the two regression paths on a full boss as well as the
      // miniboss above. The browser drives the same generated boss instance;
      // only the player/projectile placement is deterministic for the test.
      const fullShotBefore = await page.evaluate(() => {
        const g = window.__SP;
        const b = g.boss;
        if (!b || b.isMini) throw new Error('level 5 should create a full boss');
        g.enemies.length = 0;
        g.enemyBullets.length = 0;
        b.projectiles.length = 0;
        b.encountered = true;
        b.platformX = b.x;
        b.platformW = b.width;
        b.attackTimer = 9999;
        b.telegraph = 0;
        b.pendingMove = null;
        b.stunTimer = 60;
        b.coreExposed = 0;
        g.bullets.length = 0;
        g.bullets.push({
          x: b.x + b.width / 2, y: b.y + b.height / 2,
          vx: 0, vy: 0, radius: 8, life: 20,
        });
        return b.hp;
      });
      await page.clock.runFor(12);
      const fullShotAfter = await page.evaluate(() => window.__SP.boss.hp);
      check('a regular shot damages a full boss while its core is closed', () => {
        assert.equal(fullShotAfter, fullShotBefore - 1);
      });

      const fullStompBefore = await page.evaluate(() => {
        const g = window.__SP;
        const b = g.boss;
        b.stunTimer = 0;
        b.stompCooldown = 0;
        b.coreExposed = 0;
        g.ammo = 0;
        g.player.invincible = true;
        g.player.invincibleTimer = 100;
        g.player.x = b.x + b.width / 2 - g.player.width / 2;
        g.player.y = b.y - g.player.height - 4;
        g.player.velocityY = 8;
        g.player.velocityX = 0;
        g.player.onGround = false;
        g.player.isJumping = true;
        return { hp: b.hp, stompCount: b.stompCount || 0 };
      });
      await page.clock.runFor(100);
      const fullStompAfter = await page.evaluate(() => ({
        hp: window.__SP.boss.hp,
        stompCount: window.__SP.boss.stompCount,
        angry: window.__SP.boss.angry,
      }));
      check('a protected cat can stomp a full boss without ammo', () => {
        assert.ok(fullStompAfter.hp < fullStompBefore.hp);
        assert.ok(fullStompAfter.stompCount > fullStompBefore.stompCount);
        assert.equal(fullStompAfter.angry, true);
      });
    }
    if (level >= 11) {
      const data = await page.evaluate(() => ({
        signs: window.__SP.platforms.filter(p => p.neonPhase !== undefined).length,
        prize: !!window.__SP.neonPrize,
        goal: window.__SP.fishGoal,
        fish: window.__SP.fishes.length,
      }));
      check(`neon route exists on level ${level}`, () => {
        assert.equal(data.signs, 3); assert.equal(data.prize, true);
        assert.ok(data.goal <= data.fish);
      });
    }
  }
  await page.keyboard.press('KeyA');
  const beforeBonus = await page.evaluate(() => {
    const g = window.__SP;
    g.frame = 0; g.enemies.length = 0; g.hazards.length = 0; g.boss = null;
    g.player.x = g.neonPrize.x - g.player.width / 2;
    g.player.y = g.neonPrize.y - g.player.height / 2;
    g.player.velocityX = 0; g.player.velocityY = 0;
    return g.coinsThisLevel;
  });
  await page.clock.runFor(80);
  const bonus = await page.evaluate(() => ({ collected: window.__SP.neonPrize.collected, coins: window.__SP.coinsThisLevel }));
  check('the optional neon bonus can be collected', () => {
    assert.equal(bonus.collected, true); assert.ok(bonus.coins >= beforeBonus + 15);
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
