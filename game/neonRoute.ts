/** An optional upper route, never needed for the fish quota or level exit. */
export const NEON_FIRST_LEVEL = 11;
export const NEON_LAST_LEVEL = 14;
export const isNeonSignActive = (frame: number, phase: number): boolean => ((Math.max(0, Math.floor(frame)) + phase) % 240) < 180;
export const hasNeonRoute = (level: number) => level >= NEON_FIRST_LEVEL && level <= NEON_LAST_LEVEL;
