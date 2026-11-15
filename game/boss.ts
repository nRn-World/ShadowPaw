/**
 * Small, deterministic boss-tuning helpers shared by the simulation and tests.
 *
 * A boss can always be damaged with a stomp, so running out of ammunition is
 * no longer a soft-lock. Stomps are intentionally a little weaker than a
 * well-placed core shot and each one raises the boss's anger level.
 */

export const MAX_BOSS_ANGER = 3;

export interface BossStompTuning {
  maxHp: number;
  isMini?: boolean;
}

/** Damage dealt by landing on a boss from above. */
export const getBossStompDamage = ({ maxHp, isMini = false }: BossStompTuning): number =>
  Math.max(2, Math.ceil(maxHp * (isMini ? 0.34 : 0.2)));

/** Increase anger without letting repeated stomps grow without bound. */
export const getNextBossAnger = (angerLevel = 0): number =>
  Math.min(MAX_BOSS_ANGER, Math.max(0, angerLevel) + 1);

/** Speed multiplier applied after the boss has been stomped. */
export const getBossAngerSpeedMultiplier = (angerLevel = 0): number =>
  1 + Math.min(MAX_BOSS_ANGER, Math.max(0, angerLevel)) * 0.26;

/**
 * Attack cadence after a stomp. The floor keeps the enraged fight readable,
 * while phase, tier and anger still make later attacks arrive sooner.
 */
export const getBossAttackCooldown = (
  baseCooldown: number,
  phase: number,
  tier: number,
  angerLevel = 0,
  isMini = false,
): number => Math.max(
  isMini ? 34 : 30,
  baseCooldown - phase * 22 - tier * 3 - angerLevel * 16,
);
