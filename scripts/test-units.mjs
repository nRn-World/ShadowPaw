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

test('shadow fragments are unique, validated and placed deterministically away from hazards', async () => {
  const { cleanSecrets, secretLocation, SECRET_REWARD_COUNT } = await import('../game/shadowSecrets.ts');
  assert.deepEqual(cleanSecrets([3, 1, 3, 0, 41, '2', null]), [1, 3]);
  assert.deepEqual(cleanSecrets(null), []);
  assert.equal(SECRET_REWARD_COUNT, 5);
  const platforms = [{x: 0, y: 600, width: 2000, isGround: true}];
  const obstacles = [{x: 1000, width: 100}];
  const location = secretLocation(platforms, obstacles, 2000, false);
  assert.deepEqual(location, secretLocation(platforms, obstacles, 2000, false));
  assert.ok(location.x <= 900 || location.x >= 1200);
  assert.equal(secretLocation([], [], 2000, false), null);
  for (let level = 1; level <= 40; level++) {
    const profile = getDifficultyProfile(level, 1);
    const { platforms, holes } = buildLevelLayout({level, layout: getLevelLayout(level), levelLength: profile.levelLength, groundY: 600, profile, bossLevel: level % 5 === 0});
    assert.ok(secretLocation(platforms, holes, profile.levelLength, level % 5 === 0), `level ${level} should have a fragment location`);
  }
});

test('rescues and decorations validate old, duplicate and imported save data', async () => {
  const { RESCUE_CATS, cleanRescues, cleanDecor } = await import('../game/rescue.ts');
  assert.equal(RESCUE_CATS.length, 8);
  assert.deepEqual(RESCUE_CATS.map(c => c.level), [2, 7, 12, 17, 22, 27, 32, 37]);
  assert.deepEqual(cleanRescues([7, 2, 2, 99, '12', null]), [2, 7]);
  assert.deepEqual(cleanRescues(undefined), []);
  assert.equal(cleanDecor('garden', 1), 'classic');
  assert.equal(cleanDecor('garden', 2), 'garden');
  assert.equal(cleanDecor('neon', 4), 'classic');
  assert.equal(cleanDecor('neon', 5), 'neon');
  assert.equal(cleanDecor('other', 8), 'classic');
});

test('card synergies require both cards and stack only once', async () => {
  const { activeSynergies, combinePerkEffects } = await import('../game/perks.ts');
  assert.equal(activeSynergies(['shadow_battery']).length, 0);
  assert.equal(activeSynergies(['shadow_battery', 'time_lord']).length, 1);
  assert.ok(Math.abs(combinePerkEffects(['shadow_battery', 'time_lord']).shadowChargeMult - 1.4 * 1.2 * 1.15) < 1e-9);
  assert.equal(activeSynergies(['greedy_paws', 'long_line', 'quick_step', 'steady_paws']).length, 2);
});

test('longer stages preserve a gentle tutorial and shorter boss approaches', () => {
  for (let level = 1; level <= 40; level++) {
    const t = Math.min(1, Math.max(0, (level - 1) / 49));
    const ramp = Math.pow(t, 1.25);
    const oldLength = Math.floor(2600 + level * 150 + ramp * 1900 + [300, 800, 1400, 500, 1000, 1800][(level - 1) % 6]);
    const profile = getDifficultyProfile(level, 1);
    const expected = level === 1 ? 1.35 : level % 5 === 0 ? 1.25 : 1.5;
    assert.ok(profile.levelLength >= oldLength * expected - 2, `level ${level} should be longer`);
  }
});

test('long ground slabs provide distinct safe checkpoints without invented anchors', () => {
  const cps = getCheckpoints(8000, [{ x: 0, width: 8000, isGround: true }], [{x: 2800, width: 200}]);
  assert.equal(cps.length, 2);
  assert.ok(cps[1] - cps[0] >= 200);
  assert.ok(cps.every(x => x <= 2770 || x >= 3030));
  assert.deepEqual(getCheckpoints(8000, [], []), []);
});


test('long stair and bridge layouts provide safe mid-course checkpoints', () => {
  for (const level of [2, 13, 18, 21, 26, 29, 34, 37]) {
    const profile = getDifficultyProfile(level, 1);
    const { platforms, holes } = buildLevelLayout({ level, layout: getLevelLayout(level), levelLength: profile.levelLength, groundY: 624, profile, bossLevel: false });
    const anchors = getCheckpoints(profile.levelLength, platforms, holes);
    assert.equal(anchors.length, 2, `level ${level}`);
    for (const [i, x] of anchors.entries()) {
      assert.ok(Math.abs(x / profile.levelLength - [0.36, 0.7][i]) < 0.05, `level ${level}, checkpoint ${i}`);
      assert.ok(platforms.some(p => p.isGround && x >= p.x + 30 && x <= p.x + p.width - 60));
      assert.ok(!holes.some(h => x > h.x - 30 && x < h.x + h.width + 30));
    }
  }
});
