/**
 * Pure level generation for Shadow Paw.
 *
 * Everything in this module is deterministic and free of DOM/React state, so
 * it can be unit-tested and reused by the daily challenge, the campaign and a
 * future level editor. `Views.tsx` owns the game loop; this file owns the
 * shapes, difficulty curve and seeds it runs on.
 */

export type Difficulty = 'easy' | 'normal' | 'hard';

/** A stable, stateless hash used to mix a date or a run id into a level seed. */
export const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export const hashSeed = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000003;
};

/** Local-date string, so everyone in the same timezone shares a daily run. */
export const getDailySeed = (date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** The daily stage is a mid-campaign level (3-30) derived from the date. */
export const dailyLevelFromSeed = (seed: string): number =>
  3 + (hashSeed(seed) % 28);

// LEVEL DESIGN SYSTEM - 50 unique levels with progressive difficulty
export const getLevelDesign = (level: number) => {
  const designs = [
    // Levels 1-10: Tutorial & Easy
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'park', difficulty: 1 },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'suburban', difficulty: 1.2 },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'NIGHT', theme: 'city', difficulty: 1.4 },
    { weather: 'REGNIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'park', difficulty: 1.6 },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'SUNSET', theme: 'industrial', difficulty: 1.8 },
    { weather: 'DIMMIGT', intensity: 'LIGHT', timeOfDay: 'NIGHT', theme: 'downtown', difficulty: 2.0 },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'beach', difficulty: 2.2 },
    { weather: 'SNÖIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'mountain', difficulty: 2.4 },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'SUNSET', theme: 'forest', difficulty: 2.6 },
    { weather: 'STORMIGT', intensity: 'LIGHT', timeOfDay: 'NIGHT', theme: 'harbor', difficulty: 2.8 },

    // Levels 11-20: Medium
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'sewers', difficulty: 3.0 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'alpine', difficulty: 3.3 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'construction', difficulty: 3.6 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'rooftops', difficulty: 3.9 },
    { weather: 'REGNIGT', intensity: 'LIGHT', timeOfDay: 'DAWN', theme: 'countryside', difficulty: 4.2 },
    { weather: 'SNÖIGT', intensity: 'LIGHT', timeOfDay: 'NIGHT', theme: 'ice_cave', difficulty: 4.5 },
    { weather: 'STORMIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'power_plant', difficulty: 4.8 },
    { weather: 'DIMMIGT', intensity: 'LIGHT', timeOfDay: 'SUNSET', theme: 'abandoned', difficulty: 5.1 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'highway', difficulty: 5.4 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'glacier', difficulty: 5.7 },

    // Levels 21-30: Hard
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'space_station', difficulty: 6.0 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'volcano', difficulty: 6.4 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'underground', difficulty: 6.8 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'sky_bridge', difficulty: 7.2 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'nuclear', difficulty: 7.6 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'laboratory', difficulty: 8.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'datacenter', difficulty: 8.4 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'arctic_base', difficulty: 8.8 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'warzone', difficulty: 9.2 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'quantum', difficulty: 9.6 },

    // Levels 31-40: Very Hard
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'hell', difficulty: 10.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'nightmare', difficulty: 10.5 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'void', difficulty: 11.0 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'chaos', difficulty: 11.5 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'inferno', difficulty: 12.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'abyss', difficulty: 12.5 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'oblivion', difficulty: 13.0 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'pandemonium', difficulty: 13.5 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'apocalypse', difficulty: 14.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'armageddon', difficulty: 14.5 },

    // Levels 41-50: Extreme
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'titan', difficulty: 15.0 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'hades', difficulty: 16.0 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'tartarus', difficulty: 17.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'nexus', difficulty: 18.0 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'omega', difficulty: 19.0 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'infinity', difficulty: 20.0 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'transcendence', difficulty: 21.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'enlightenment', difficulty: 22.0 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'ascension', difficulty: 23.0 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'legendary', difficulty: 25.0 }
  ];

  return designs[Math.min(level - 1, designs.length - 1)];
};

export interface DifficultyProfile {
  levelLength: number;
  segmentWidth: number;
  inLevelRamp: number;
  holeChance: number;
  holeSize: number;
  platformCount: number;
  enemyCount: number;
  enemySpeed: number;
  fishCount: number;
  hazardCount: number;
  variant: number;
  /** Multiplies the Speed Run clock. Easy gives more air, hard gives less. */
  timerScale: number;
  /** Multiplies the fish quota. Every mode stays winnable. */
  quotaScale: number;
  difficulty: Difficulty;
}

/** The chosen difficulty is a *fairness* dial, never a pay-to-win boost: it
    scales hazards, enemy pressure and quotas, but never the rewards. */
const DIFFICULTY_TUNING: Record<Difficulty, {
  holes: number; holeSize: number; enemies: number; speed: number;
  hazards: number; fish: number; timer: number; quota: number;
}> = {
  easy:   { holes: 0.45, holeSize: 0.7, enemies: 0.78, speed: 0.78, hazards: 0.55, fish: 0.9,  timer: 1.35, quota: 0.85 },
  normal: { holes: 1,    holeSize: 1,   enemies: 1,    speed: 1,    hazards: 1,    fish: 1,    timer: 1,    quota: 1 },
  hard:   { holes: 1.3,  holeSize: 1.1, enemies: 1.2,  speed: 1.15, hazards: 1.3,  fish: 1.15, timer: 0.9,  quota: 1.1 },
};

export const getDifficultyProfile = (
  level: number,
  playerRank: number,
  difficulty: Difficulty = 'normal',
): DifficultyProfile => {
  // t runs 0 -> 1 across the 50-stage campaign. The curve is deliberately
  // gentle for the first stages: level 1 is a tutorial walk, level 2 is still
  // calm, and real pressure only starts once every mechanic has been taught.
  const t = Math.min(1, Math.max(0, (level - 1) / 49));
  const ramp = Math.pow(t, 1.25);
  // Account level gives a little relief, but never turns the late game into a
  // walkover: it is capped at roughly a tenth of the total ramp.
  const rankRelief = Math.min(0.1, Math.max(0, (Math.max(1, playerRank) - 1) / 49) * 0.1);
  const effectiveRamp = Math.max(0, ramp - rankRelief);
  const variant = (level - 1) % 6;
  const variantLengthBonus = [300, 800, 1400, 500, 1000, 1800][variant];
  const tune = DIFFICULTY_TUNING[difficulty] ?? DIFFICULTY_TUNING.normal;

  return {
    levelLength: Math.floor(2600 + level * 150 + effectiveRamp * 1900 + variantLengthBonus),
    // Base width of one ground segment; the generator varies this per segment.
    segmentWidth: Math.max(120, 200 - effectiveRamp * 62),
    // How much harder the level gets between its start and its goal.
    inLevelRamp: 0.2 + effectiveRamp * 1.0,
    // Level 1-2 have no pits at all, so the opening stages can never kill a
    // first-time player by accident. From level 3 the gaps grow steadily.
    holeChance: level <= 2 ? 0 : Math.min(0.36, 0.04 + effectiveRamp * 0.34) * tune.holes,
    holeSize: Math.min(0.42, 0.1 + effectiveRamp * 0.3) * tune.holeSize,
    platformCount: Math.floor(8 + level * 0.55 + effectiveRamp * 8),
    enemyCount: Math.max(1, Math.floor((1 + Math.max(0, level - 1) * 0.6 + effectiveRamp * 4) * tune.enemies)),
    enemySpeed: (1.1 + Math.max(0, level - 1) * 0.07 + effectiveRamp * 0.8) * tune.speed,
    fishCount: Math.max(8, Math.floor((10 + level * 0.55 + effectiveRamp * 3) * tune.fish)),
    hazardCount: level <= 3 ? 0 : Math.floor(((level - 3) * 0.4 + effectiveRamp * 4) * tune.hazards),
    variant,
    timerScale: tune.timer,
    quotaScale: tune.quota,
    difficulty,
  };
};

/* ============================ LEVEL BLUEPRINTS ============================
   Every stage gets a structural archetype, not just a new backdrop. Two
   neighbouring levels therefore never share a silhouette: one climbs stairs,
   the next hops islands, the third balances over bridges. Level 1 is always
   the flat tutorial meadow and every fifth level is a boss arena. */

export type LevelLayoutId = 'meadow' | 'stairs' | 'islands' | 'canyon' | 'bridges' | 'towers' | 'ruins' | 'gauntlet' | 'arena';

export const LEVEL_LAYOUTS: LevelLayoutId[] = ['meadow', 'stairs', 'islands', 'canyon', 'bridges', 'towers', 'ruins', 'gauntlet'];

export const LEVEL_LAYOUT_META: Record<LevelLayoutId, { name: string; tagline: string }> = {
  meadow: { name: 'Ängsstart', tagline: 'Breda gräsytor och låga avsatser. Lär känna katten.' },
  stairs: { name: 'Trappstaden', tagline: 'Klättra trappor, fall inte i glappen.' },
  islands: { name: 'Övärlden', tagline: 'Flytande öar över ett svart djup.' },
  canyon: { name: 'Kanjonsprickan', tagline: 'Breda klyftor som kräver dubbelhopp.' },
  bridges: { name: 'Broarna', tagline: 'Smal balansgång över avgrunden.' },
  towers: { name: 'Tornen', tagline: 'Klättra mot skyn för att nå fiskarna.' },
  ruins: { name: 'Ruinerna', tagline: 'Krossade pelare i oregelbunden rytm.' },
  gauntlet: { name: 'Prövningen', tagline: 'Tätt mellan plattformar, fiender och fällor.' },
  arena: { name: 'Bossarenan', tagline: 'En öppen arena. Bara du och bossen.' },
};

/** Structural archetype for a level. Boss stages own a flat arena, level 1
    stays a plain meadow, and everything else cycles through the eight shapes
    so the course reads differently every single stage. */
export const getLevelLayout = (level: number): LevelLayoutId => {
  if (level % 5 === 0) return 'arena';
  if (level <= 1) return 'meadow';
  return LEVEL_LAYOUTS[(level - 1) % LEVEL_LAYOUTS.length];
};

/** Small deterministic PRNG so a level is rebuilt identically after a restart:
    the player can learn a course instead of re-rolling the dice. */
export const makeRng = (seed: number) => {
  let s = Math.floor(Math.abs(seed)) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

export const GROUND_COLOR = '#1c3a2a';
export const LEDGE_COLOR = '#234832';

export interface LayoutBuildArgs {
  /** Mixed into the layout seed so a daily run is a fresh course. */
  seedOffset?: number;
  level: number;
  layout: LevelLayoutId;
  levelLength: number;
  groundY: number;
  profile: { inLevelRamp: number; holeChance: number; holeSize: number };
  bossLevel: boolean;
}

/** Builds the solid geometry of a level: ground slabs, floating platforms and
    the pits between them. Fish, enemies and pickups are placed on top of this
    afterwards, so every layout only has to answer "where can the cat stand?". */
export const buildLevelLayout = ({ level, layout, levelLength, groundY, profile, bossLevel, seedOffset = 0 }: LayoutBuildArgs) => {
  const rng = makeRng(level * 7919 + 17 + seedOffset);
  const platforms: any[] = [];
  const holes: any[] = [];

  const ground = (x: number, width: number) => {
    if (width <= 4) return;
    platforms.push({ x, y: groundY, width, height: 44 + Math.round(rng() * 46), color: GROUND_COLOR, isGround: true });
  };
  const ledge = (x: number, y: number, width: number, height = 20, solid = false, color = LEDGE_COLOR) => {
    if (width <= 4) return;
    platforms.push({ x, y, width, height, color, solid: solid && height >= 80 });
  };
  /** A moving lift. `x`/`y` are the resting centre points: the sim re-derives
      the actual rectangle from `Math.sin(phase)`, so the start frame matches
      the placed position exactly. */
  const moverLedge = (x: number, y: number, width: number, axis: 'h' | 'v', amp: number, speed: number) => {
    if (width <= 8) return;
    const phase = rng() * Math.PI * 2;
    platforms.push({
      x: axis === 'h' ? x + Math.sin(phase) * amp : x,
      y: axis === 'v' ? y + Math.sin(phase) * amp : y,
      width,
      height: 18,
      color: LEDGE_COLOR,
      baseX: x,
      baseY: y,
      mover: { axis, amp, speed, phase },
    });
  };
  const pit = (x: number, width: number) => {
    if (width <= 0) return;
    holes.push({ x, y: groundY, width });
  };
  // How much of each end is guaranteed safe: the cat spawns in the first
  // stretch and Jerry waits in the last one, so neither may be a death trap.
  const startSafe = bossLevel ? 820 : 760;
  const endSafe = bossLevel ? 1080 : 940;
  const end = Math.max(startSafe + 400, levelLength - endSafe);
  // Difficulty inside the level also widens pits a little as you approach Jerry.
  const pitBonus = Math.min(46, Math.floor(level * 0.6));

  // Any stretch without ground is a bottomless pit. Registering it as a hole
  // lets the renderer draw depth and a warning lip, instead of a hard black band
  // where the floor simply stops.
  const finish = () => {
    const groundGaps = () => {
      const covered = platforms
        .filter((pl) => pl.isGround)
        .map((pl) => [pl.x, pl.x + pl.width] as [number, number])
        .sort((l, r) => l[0] - r[0]);
      const gaps: Array<[number, number]> = [];
      let cursor = 0;
      for (const [start, stop] of covered) {
        if (start > cursor + 4) gaps.push([cursor, start]);
        cursor = Math.max(cursor, stop);
      }
      if (cursor < levelLength - 4) gaps.push([cursor, levelLength]);
      return gaps;
    };

    // A leap wider than the cat can clear would make the stage impossible, so
    // any leftover gap that is not already bridged by stairs, beams or floating
    // platforms gets stepping stones. Designed gaps are left untouched.
    for (const [start, stop] of groundGaps()) {
      const width = stop - start;
      if (width <= 200) continue;
      const bridged = platforms.some(
        (pl) => !pl.isGround && pl.x + pl.width > start && pl.x < stop && pl.y >= groundY - 270,
      );
      if (bridged) continue;
      for (let stoneX = start + 90; stoneX < stop - 70; stoneX += 172) {
        ledge(stoneX, groundY - 46, 96, 18);
      }
    }

    // Everything still uncovered reads as a bottomless pit: register it as a
    // hole so the renderer draws depth and a warning lip instead of a hard
    // black band where the floor simply stops.
    for (const [start, stop] of groundGaps()) {
      holes.push({ x: start, y: groundY, width: stop - start });
    }
    return { platforms, holes };
  };

  ground(0, startSafe);
  ground(levelLength - endSafe, endSafe);

  if (layout === 'arena') {
    // The boss arena is carved out later; keep the run-up flat and readable.
    ground(startSafe, end - startSafe);
    for (let x = startSafe + 300; x < end - 200; x += 560) {
      ledge(x, groundY - 96, 120);
    }
    return finish();
  }

  if (layout === 'meadow') {
    ground(startSafe, end - startSafe);
    for (let x = startSafe + 220; x < end - 220; x += 480) {
      const y = groundY - 64 - Math.round(rng() * 42);
      ledge(x, y, 140 + Math.round(rng() * 60));
      if (rng() > 0.55) ledge(x + 250, y - 58, 96);
    }
    return finish();
  }

  if (layout === 'stairs') {
    let x = startSafe;
    let climb = true;
    while (x < end - 420) {
      const steps = 3 + Math.floor(rng() * 3);
      let y = groundY - 20;
      for (let s = 0; s < steps; s++) {
        y -= 54;
        ledge(x + s * 146, y, 146, 22);
      }
      const topWidth = 170 + Math.round(rng() * 120);
      ledge(x + steps * 146, y, topWidth, 22);
      x += steps * 146 + topWidth;
      // A real pit between staircases: the stairs are the only way across.
      const gap = 84 + Math.round(rng() * 46) + Math.min(40, pitBonus);
      pit(x - 4, gap + 8);
      // A shuttle crossing the gap while the cat rides it: the classic moving
      // platform. It swings well short of both ledges, so timing still matters.
      if (rng() > 0.3) {
        moverLedge(x - 4 + gap / 2, groundY - 46, 88, 'h', Math.min(56, gap * 0.38), 0.013 + rng() * 0.007);
      }
      x += gap;
      if (climb && rng() > 0.6) {
        // Optional high reward ledge above the gap.
        ledge(x - 40, y - 92, 104);
      }
      climb = !climb;
    }
    return finish();
  }

  if (layout === 'islands') {
    let x = startSafe;
    while (x < end - 160) {
      const w = 150 + Math.round(rng() * 110);
      ground(x, Math.min(w, Math.max(80, end - x)));
      if (rng() > 0.35) {
        ledge(x + w * 0.2, groundY - 118 - Math.round(rng() * 70), 84 + Math.round(rng() * 60));
      }
      x += w;
      const gap = 88 + Math.round(rng() * 54) + Math.min(40, pitBonus);
      if (x + gap > end - 80) break;
      pit(x, gap);
      // Shuttle ferrying the cat between islands over the black water.
      if (rng() > 0.4) {
        moverLedge(x, groundY - 42, 90, 'h', Math.min(64, gap * 0.42), 0.012 + rng() * 0.006);
      }
      x += gap;
    }
    return finish();
  }

  if (layout === 'canyon') {
    let x = startSafe;
    while (x < end - 220) {
      const w = 240 + Math.round(rng() * 190);
      ground(x, Math.min(w, Math.max(120, end - x)));
      if (rng() > 0.55) ledge(x + 60, groundY - 108 - Math.round(rng() * 52), 104);
      x += w;
      const gap = 104 + Math.round(rng() * 44) + Math.min(46, pitBonus);
      if (x + gap > end - 80) break;
      pit(x, gap);
      // Wide canyon rifts get a lift running partway down into the cleft:
      // dropping onto it mid-fall is the second-chance save that makes the
      // risky rim route worth trying.
      if (rng() > 0.5) {
        moverLedge(x, groundY - 40, 96, 'h', Math.min(70, gap * 0.4), 0.012 + rng() * 0.005);
      }
      x += gap;
    }
    return finish();
  }

  if (layout === 'bridges') {
    // Beams replace the floor in the middle: fall and the run is over.
    let x = startSafe;
    let y = groundY - 44;
    while (x < end - 80) {
      const w = 112 + Math.round(rng() * 52);
      ledge(x, y, Math.min(w, end - x), 18);
      x += w;
      const gap = 66 + Math.round(rng() * 44);
      if (x + gap > end - 60) break;
      pit(x - 3, gap + 6);
      x += gap;
      if (rng() > 0.5) {
        const step = rng() > 0.5 ? -58 : 58;
        y = Math.max(groundY - 250, Math.min(groundY - 30, y + step));
      }
    }
    return finish();
  }

  if (layout === 'towers') {
    ground(startSafe, end - startSafe);
    let x = startSafe + 220;
    while (x < end - 280) {
      const towerH = 110 + Math.round(rng() * 130);
      const towerW = 66 + Math.round(rng() * 26);
      // Solid pillar: the cat lands on top and hops from ledge to ledge.
      // `solid` also let it act as a wall the cat can slide down and kick off
      // (wall jump) - the tower silhouette finally has a second use.
      platforms.push({ x, y: groundY - towerH, width: towerW, height: towerH, color: LEDGE_COLOR, solid: true });
      ledge(x - 78, groundY - 74, 68);
      ledge(x + towerW + 12, groundY - 140, 68);
      if (rng() > 0.4) ledge(x + towerW + 96, groundY - towerH + 10, 84);
      // A vertical lift beside the tower so the sky ledges are rideable even
      // without using up the double jump.
      if (rng() > 0.45) {
        moverLedge(x + towerW + 120, groundY - 80, 62, 'v', 78, 0.011 + rng() * 0.005);
      }
      x += 260 + Math.round(rng() * 70);
      if (rng() > 0.6) {
        const gap = 96 + Math.round(rng() * 40);
        pit(x - 150, gap);
      }
    }
    return finish();
  }

  if (layout === 'ruins') {
    ground(startSafe, end - startSafe);
    let x = startSafe + 180;
    while (x < end - 200) {
      const h = 50 + Math.round(rng() * 130);
      const w = 60 + Math.round(rng() * 60);
      // Tall ruin blocks double as climbable walls: they are solid, so the cat
      // can slide down their face and wall-jump off it like the towers can.
      ledge(x, groundY - h, w, h, h >= 110);
      if (rng() > 0.5) ledge(x + w + 70, groundY - Math.max(70, h - 70), 74);
      x += 190 + Math.round(rng() * 90);
      if (rng() > 0.66) {
        const gap = 92 + Math.round(rng() * 36);
        pit(x - 120, gap);
      }
    }
    return finish();
  }

  // gauntlet: flat ground with a dense, tight ceiling of small platforms.
  ground(startSafe, end - startSafe);
  let gx = startSafe + 120;
  while (gx < end - 160) {
    const w = 72 + Math.round(rng() * 46);
    const y = groundY - 110 - Math.round(rng() * 120);
    ledge(gx, y, w, 18);
    if (rng() > 0.6) ledge(gx + 46, y - 62, w * 0.8, 18);
    gx += 118 + Math.round(rng() * 54);
    if (rng() > 0.75) {
      const gap = 88 + Math.round(rng() * 34);
      pit(gx - 60, gap);
    }
  }
  return finish();
};

export const getWeatherForLevel = (level: number) => {
  if (level === 1) {
    return { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'DAY' };
  }

  const weatherPresets = [
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'DAY' },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'SUNSET' },
    { weather: 'REGNIGT', intensity: 'LIGHT', timeOfDay: 'DAY' },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT' },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT' },
    { weather: 'SNÖIGT', intensity: 'LIGHT', timeOfDay: 'DAY' },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT' },
    { weather: 'DIMMIGT', intensity: 'LIGHT', timeOfDay: 'DAWN' },
  ] as const;

  const index = Math.floor(seededRandom(level * 17.371) * weatherPresets.length);
  const previousIndex = Math.floor(seededRandom((level - 1) * 17.371) * weatherPresets.length);
  const safeIndex = index === previousIndex ? (index + 1) % weatherPresets.length : index;

  return weatherPresets[safeIndex];
};


/** Two respawn anchors on solid ground, never inside a pit. Long levels used
    to send a fallen cat back to the nearest slab, which could be hundreds of
    pixels behind the last checkpoint. */
export const getCheckpoints = (
  levelLength: number,
  platforms: Array<{ x: number; width: number; isGround?: boolean }>,
  holes: Array<{ x: number; width: number }>,
): number[] => {
  const targets = [0.36, 0.7].map((t) => levelLength * t);
  const safe = platforms.filter((p) => p.isGround && p.width >= 90);
  let previous = -Infinity;
  return targets.map((target) => {
    let best: number | null = null;
    for (const p of safe) {
      const x = p.x + Math.min(p.width - 40, Math.max(20, p.width / 2));
      // Never stack two beacons on the same slab.
      if (x <= previous + 200) continue;
      if (holes.some((h) => x > h.x - 30 && x < h.x + h.width + 30)) continue;
      if (best === null || Math.abs(x - target) < Math.abs(best - target)) best = x;
    }
    const chosen = best ?? Math.max(160, previous + 240);
    previous = chosen;
    return chosen;
  });
};
