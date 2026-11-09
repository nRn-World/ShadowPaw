/**
 * Dependency-free unit tests for the pure game modules.
 * Run with: npm run test:units
 * Node 22 strips the TypeScript types at load time, so these modules can be
 * tested without a bundler or a browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeRng, hashSeed, getDailySeed, dailyLevelFromSeed,
  getDifficultyProfile, buildLevelLayout, getLevelLayout,
  getCheckpoints, seededRandom,
} from '../game/level.ts';
import { PERKS, offerPerks, combinePerkEffects } from '../game/perks.ts';
import { createQualityMonitor } from '../game/quality.ts';
import { updateEnemyMotion } from '../game/enemies.ts';

const fakeGame = (playerX = 400) => ({ player: { x: playerX, width: 50, y: 500, height: 70 } });

test('seeded RNG is deterministic and bounded', () => {
  const a = makeRng(1234);
  const b = makeRng(1234);
  const seqA = Array.from({ length: 20 }, () => a());
  const seqB = Array.from({ length: 20 }, () => b());
  assert.deepEqual(seqA, seqB);
  assert.ok(seqA.every((v) => v > 0 && v < 1));
  assert.equal(seededRandom(42), seededRandom(42));
});

test('daily seed is a local date and maps to one shared level', () => {
  const date = new Date(2026, 10, 3, 23, 30); // 3 Nov 2026
  assert.equal(getDailySeed(date), '2026-11-03');
  const level = dailyLevelFromSeed('2026-11-03');
  assert.equal(level, dailyLevelFromSeed('2026-11-03'));
  assert.ok(level >= 3 && level <= 30);
  assert.notEqual(level, dailyLevelFromSeed('2026-11-04'));
  assert.ok(hashSeed('abc') >= 0);
});

test('difficulty scales hazards, speed, quota and timer but keeps levels winnable', () => {
  const easy = getDifficultyProfile(12, 10, 'easy');
  const normal = getDifficultyProfile(12, 10, 'normal');
  const hard = getDifficultyProfile(12, 10, 'hard');
  assert.ok(easy.holeChance < normal.holeChance && normal.holeChance < hard.holeChance);
  assert.ok(easy.enemySpeed < normal.enemySpeed && normal.enemySpeed < hard.enemySpeed);
  assert.ok(easy.hazardCount <= normal.hazardCount && normal.hazardCount <= hard.hazardCount);
  assert.ok(easy.quotaScale < normal.quotaScale && normal.quotaScale < hard.quotaScale);
  assert.ok(easy.timerScale > normal.timerScale && normal.timerScale > hard.timerScale);
  for (const p of [easy, normal, hard]) {
    assert.ok(p.fishCount >= 8, 'there must always be enough fish for the quota');
    assert.ok(p.enemyCount >= 1);
  }
  assert.equal(getDifficultyProfile(1, 1, 'hard').holeChance, 0, 'level 1 never has pits');
});

test('level layouts are reproducible and the daily seed changes them', () => {
  const base = { level: 7, layout: getLevelLayout(7), levelLength: 4200, groundY: 620,
    profile: getDifficultyProfile(7, 7), bossLevel: false };
  const a = buildLevelLayout({ ...base });
  const b = buildLevelLayout({ ...base });
  const c = buildLevelLayout({ ...base, seedOffset: 12345 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.platforms, c.platforms);
  assert.ok(a.platforms.length > 4);
});

test('checkpoints land on solid ground away from pits', () => {
  const platforms = [
    { x: 0, width: 400, isGround: true },
    { x: 1500, width: 300, isGround: true },
    { x: 2900, width: 300, isGround: true },
    { x: 3800, width: 300, isGround: true },
  ];
  const holes = [{ x: 380, width: 1100 }];
  const cps = getCheckpoints(4000, platforms, holes);
  assert.equal(cps.length, 2);
  assert.ok(cps[0] < cps[1], 'anchors must be ordered along the course');
  for (const cx of cps) {
    assert.ok(platforms.some((p) => cx > p.x && cx < p.x + p.width), `${cx} is off-platform`);
    assert.ok(!holes.some((h) => cx > h.x - 30 && cx < h.x + h.width + 30), `${cx} is over a pit`);
  }
});

test('perk offers are seeded, exclude owned cards and never reroll on restart', () => {
  assert.equal(PERKS.length, 8);
  const offer = offerPerks(42);
  assert.equal(offer.length, 3);
  assert.equal(new Set(offer.map((p) => p.id)).size, 3);
  assert.deepEqual(offerPerks(42), offer, 'same level seed must show the same three cards');
  assert.ok(offerPerks(42, ['glass_cannon']).every((p) => p.id !== 'glass_cannon'));
  const effects = combinePerkEffects(['glass_cannon', 'greedy_paws', 'shadow_battery']);
  assert.ok(effects.scoreMult > 1);
  assert.equal(effects.fishGoalDelta, 2);
  assert.ok(effects.shadowChargeMult > 1);
  assert.ok(combinePerkEffects(Array(20).fill('glass_cannon')).scoreMult <= 2, 'stacking is capped');
});

test('enemy archetypes 0-2 behave differently', () => {
  const platform = { x: 100, width: 600 };
  const mk = (type) => ({ x: 300, y: 500, width: 40, height: 40, baseY: 500,
    velocityX: type === 1 ? 2 : -2, direction: 1, type });
  const hound = mk(0), skittish = mk(1), hopper = mk(2);
  // Cat is close: the hound chases, the skittish one freezes.
  const game = fakeGame(350);
  for (let i = 0; i < 10; i++) {
    updateEnemyMotion(hound, game, platform);
    updateEnemyMotion(skittish, game, platform);
    updateEnemyMotion(hopper, game, platform);
  }
  assert.ok(hound.x > 300, 'hound should close the distance');
  assert.ok(skittish.feintTimer > 0, 'skittish enemy should be freezing');
  assert.notEqual(hopper.y, hopper.baseY, 'hopper should leave the ground');
});

test('auto-quality steps down under sustained slow frames and recovers', () => {
  const q = createQualityMonitor();
  for (let i = 0; i < 130; i++) q.sample(33, true); // ~30 fps for >4 s
  assert.equal(q.current().tier, 2);
  assert.equal(q.current().bloom, false);
  assert.equal(q.current().cacheBackground, true);
  assert.ok(q.current().weatherScale < 1);
  for (let i = 0; i < 700; i++) q.sample(16, true); // ~60 fps for >11 s
  assert.equal(q.current().tier, 1);
  // Disabled means full quality, always.
  assert.equal(q.sample(100, false).tier, 0);
});

test('telemetry picks the dominant death cause with a stable tie-break', async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  const { getTopDeathCause, getMostDangerousLevel, readTelemetry } = await import('../game/telemetry.ts');
  const { readDailyStreak, touchDailyStreak, recordDailyScore, loadDailyScores } = await import('../game/daily.ts');
  store.set('shadow_paw_telemetry', JSON.stringify({
    deathsByCause: { hole: 4, enemy: 9, hazard: 2 },
    levelDeaths: { '7': 6, '3': 2 },
  }));
  assert.equal(getTopDeathCause(), 'enemy');
  assert.equal(getMostDangerousLevel(), 7);
  assert.equal(readTelemetry().deathsByCause.enemy, 9);

  assert.deepEqual(readDailyStreak(), { last: '', count: 0 });
  assert.equal(touchDailyStreak('2026-11-03').count, 1);
  assert.equal(touchDailyStreak('2026-11-03').count, 1, 'same day does not double-count');
  assert.equal(touchDailyStreak('2026-11-04').count, 2);
  assert.equal(recordDailyScore('2026-11-04', 5000, 12), 1);
  assert.equal(loadDailyScores('2026-11-04')[0].score, 5000);
});
