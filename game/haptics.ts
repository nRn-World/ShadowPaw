/**
 * Distinct vibration signatures per gameplay event. A phone should be able to
 * tell a fish from a hit without the player looking at the screen.
 */
export type HapticEvent =
  | 'jump' | 'doubleJump' | 'wallJump' | 'dash' | 'shadowShift'
  | 'shieldBreak' | 'damage' | 'shoot' | 'bounce' | 'collect'
  | 'checkpoint' | 'bossWarning' | 'levelUp' | 'enemyKill';

const PATTERNS: Record<HapticEvent, number | number[]> = {
  jump: 12,
  doubleJump: [9, 18, 9],
  wallJump: 10,
  dash: 18,
  shadowShift: [12, 30, 18, 30, 26],
  shieldBreak: 20,
  damage: [35, 40, 35],
  shoot: 6,
  bounce: 16,
  collect: 8,
  checkpoint: [14, 40, 14, 40, 22],
  bossWarning: [30, 60, 30],
  levelUp: [18, 45, 18, 45, 35],
  enemyKill: 22,
};

export const haptic = (event: HapticEvent, enabled: boolean) => {
  if (!enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(PATTERNS[event]);
  } catch {
    // Some browsers reject repeated vibration requests; feedback is optional.
  }
};
