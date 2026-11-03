/**
 * Neon-skift — a small, always-positive live bonus that rotates every ten
 * minutes.
 *
 * The whole system is derived from the device clock, so it needs no server, no
 * account and no save-file migration. Two players opening the game in the same
 * ten-minute window see the same shift, and a shift is frozen for the duration
 * of a level (see PlayingView.setupLevel) so gameplay never changes mid-jump.
 *
 * Design rules (VISION.md): every shift is a BONUS. Nothing is ever taken away,
 * nothing expires with a penalty, and there is no pay-to-win or FOMO mechanic.
 * Missing a shift simply means the next one is already on its way.
 */

/** Length of one shift window: ten minutes. */
export const SHIFT_WINDOW_MS = 10 * 60 * 1000;

export interface NeonShift {
  id: string;
  /** Swedish source text; translated with tr()/t() at the call site. */
  label: string;
  desc: string;
  /** Material Symbol name. */
  icon: string;
  /** Accent colour used by the menu card and the in-game HUD chip. */
  color: string;
  /** Frames before the dash is ready again (baseline 45). */
  dashCooldown: number;
  /** Multiplier on level gravity (baseline 1). */
  gravityScale: number;
  /** Extra shots at level start. */
  ammoBonus: number;
  /** Shadow-charge units granted per near miss (baseline 1). */
  chargePerNearMiss: number;
  /** Extra coins awarded when the level is cleared. */
  levelClearCoinBonus: number;
  /** Frames a combo stays alive (baseline 150). */
  comboWindow: number;
  /** Filled in by getNeonShift. */
  windowIndex: number;
  startsAt: number;
  endsAt: number;
}

type ShiftDefinition = Omit<NeonShift, 'windowIndex' | 'startsAt' | 'endsAt'>;

/** Only buffs. Adding a new row here is enough to add a new shift. */
export const NEON_SHIFTS: ShiftDefinition[] = [
  {
    id: 'turbo', label: 'Turbo', desc: 'Dashen laddar om nästan dubbelt så snabbt.',
    icon: 'bolt', color: '#2bee79',
    dashCooldown: 28, gravityScale: 1, ammoBonus: 0, chargePerNearMiss: 1,
    levelClearCoinBonus: 0, comboWindow: 150,
  },
  {
    id: 'moon', label: 'Månsväv', desc: 'Lättare gravitation ger längre, mjukare hopp.',
    icon: 'nightlight', color: '#7ee7ff',
    dashCooldown: 45, gravityScale: 0.84, ammoBonus: 0, chargePerNearMiss: 1,
    levelClearCoinBonus: 0, comboWindow: 150,
  },
  {
    id: 'shadow', label: 'Skuggladdning', desc: 'Varje nästan-träff ger dubbel skuggkraft.',
    icon: 'blur_on', color: '#b07cff',
    dashCooldown: 45, gravityScale: 1, ammoBonus: 0, chargePerNearMiss: 2,
    levelClearCoinBonus: 0, comboWindow: 150,
  },
  {
    id: 'gold', label: 'Guldregn', desc: 'Fyrtio extra mynt när du klarar en nivå.',
    icon: 'monetization_on', color: '#ffd166',
    dashCooldown: 45, gravityScale: 1, ammoBonus: 0, chargePerNearMiss: 1,
    levelClearCoinBonus: 40, comboWindow: 150,
  },
  {
    id: 'ammo', label: 'Ammoförråd', desc: 'Åtta extra skott redan från start.',
    icon: 'battery_charging_full', color: '#62b7ff',
    dashCooldown: 45, gravityScale: 1, ammoBonus: 8, chargePerNearMiss: 1,
    levelClearCoinBonus: 0, comboWindow: 150,
  },
  {
    id: 'combo', label: 'Kombofokus', desc: 'Kombon håller femtio procent längre.',
    icon: 'local_fire_department', color: '#ff8f6b',
    dashCooldown: 45, gravityScale: 1, ammoBonus: 0, chargePerNearMiss: 1,
    levelClearCoinBonus: 0, comboWindow: 225,
  },
];

/** Deterministic 32-bit hash, so a window index always maps to the same shift. */
const hash01 = (seed: number): number => {
  let a = (seed >>> 0) + 0x6d2b79f5;
  a = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export interface ShiftWindow {
  windowIndex: number;
  startsAt: number;
  endsAt: number;
}

export const getShiftWindow = (now: number = Date.now()): ShiftWindow => {
  const nowMs = Number.isFinite(now) ? now : Date.now();
  const windowIndex = Math.floor(nowMs / SHIFT_WINDOW_MS);
  const startsAt = windowIndex * SHIFT_WINDOW_MS;
  return { windowIndex, startsAt, endsAt: startsAt + SHIFT_WINDOW_MS };
};

export const msUntilNextShift = (now: number = Date.now()): number =>
  getShiftWindow(now).endsAt - (Number.isFinite(now) ? now : Date.now());

/**
 * A fixed, hash-shuffled rotation instead of an independent random pick.
 * Cycling through a permutation guarantees three useful properties at once:
 * no shift ever appears in two consecutive windows, every shift is reachable,
 * and the sequence needs no state or network to stay in sync between devices.
 */
const SHIFT_ROTATION: number[] = (() => {
  const order = NEON_SHIFTS.map((_, i) => i);
  let state = Math.floor(hash01(0x5eed) * 4294967296) >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
})();

const pickIndex = (windowIndex: number): number => {
  const n = SHIFT_ROTATION.length;
  return SHIFT_ROTATION[((windowIndex % n) + n) % n];
};

/** The active shift for a point in time. Pure: same input -> same output. */
export const getNeonShift = (now: number = Date.now()): NeonShift => {
  const window = getShiftWindow(now);
  return { ...NEON_SHIFTS[pickIndex(window.windowIndex)], ...window };
};

/** "7:42" style countdown for the menu card. */
export const formatShiftCountdown = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
