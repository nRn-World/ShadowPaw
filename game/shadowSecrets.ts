/** Optional campaign collectibles. Placement never changes the required route. */
export type SecretPlatform = { x: number; y: number; width: number; isGround?: boolean; bossArena?: boolean; bossWalkway?: boolean };
export type SecretObstacle = { x: number; width: number };
export const SECRET_REWARD_COUNT = 5;

export function cleanSecrets(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 40))].sort((a, b) => a - b);
}

/** Find a safe, deterministic location, away from hazards and the level ends. */
export function secretLocation(platforms: SecretPlatform[], obstacles: SecretObstacle[], length: number, boss: boolean) {
  const end = length - (boss ? 1500 : 400);
  const candidates = platforms.filter(p => p.isGround && !p.bossArena && !p.bossWalkway && p.width >= 110)
    .flatMap(p => {
      const start = Math.max(450, p.x + 55);
      const stop = Math.min(end, p.x + p.width - 55);
      const points: { x: number; y: number }[] = [];
      for (let x = start; x <= stop; x += 80) {
        if (!obstacles.some(o => x > o.x - 100 && x < o.x + o.width + 100)) points.push({ x, y: p.y - 55 });
      }
      return points;
    });
  candidates.sort((a, b) => Math.abs(a.x - length * 0.55) - Math.abs(b.x - length * 0.55) || a.x - b.x);
  return candidates[0] ?? null;
}
