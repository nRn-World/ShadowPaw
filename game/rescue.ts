/** Optional cats live on one campaign stage per chapter, never in Daily runs. */
export const RESCUE_CATS = [
  { level: 2, name: 'Miso', color: '#ffc477' },
  { level: 7, name: 'Luna', color: '#b9a3ff' },
  { level: 12, name: 'Kiko', color: '#82daf3' },
  { level: 17, name: 'Mochi', color: '#ffe8a6' },
  { level: 22, name: 'Sora', color: '#8ae4cb' },
  { level: 27, name: 'Nori', color: '#aab8df' },
  { level: 32, name: 'Pip', color: '#ffb0bd' },
  { level: 37, name: 'Echo', color: '#d7b1fa' },
] as const;

export const RESCUE_LEVELS: readonly number[] = RESCUE_CATS.map(cat => cat.level);
export function cleanRescues(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((n): n is number => typeof n === 'number' && RESCUE_LEVELS.includes(n)))].sort((a, b) => a - b);
}
export type HideoutDecor = 'classic' | 'garden' | 'neon';
export function cleanDecor(value: unknown, count: number): HideoutDecor {
  if (value === 'garden' && count >= 2) return value;
  if (value === 'neon' && count >= 5) return value;
  return 'classic';
}
