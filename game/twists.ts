/**
 * Level twists and surprise events.
 *
 * Every stage used to play the same way: same gravity, same grip, same hazards,
 * only the layout and the enemy count changed. That is what made a 40-chapter
 * campaign feel repetitive after the first few chapters.
 *
 * A *twist* is a named rule that changes how the stage plays, is announced on
 * the intro card, and stays on the HUD for the whole level so the player always
 * knows why the world behaves the way it does. It is deterministic: the same
 * level always gets the same twist, so a stage can be learned.
 *
 * An *event* is a short, telegraphed surprise that interrupts a run - meteor
 * rain, a gust front, a swarm - with a warning long enough to react to. Events
 * never fire on the first two levels, never during a boss fight, and never
 * twice in a row.
 *
 * Both modules are pure and DOM-free so they can be unit-tested.
 */

export type TwistId =
  | 'none'
  | 'slippery'
  | 'lowGravity'
  | 'tailwind'
  | 'headwind'
  | 'stickyBoots'
  | 'heavyPaws'
  | 'quake';

export interface TwistDef {
  id: TwistId;
  /** Swedish source label; translated through the i18n table. */
  name: string;
  /** One short line telling the player what it does. */
  detail: string;
  icon: string;
  /** Accent colour used by the HUD chip and the intro card. */
  accent: string;
  /** Physics knobs consumed by the game loop. */
  gravity: number;
  friction: number;
  /** Extra horizontal acceleration added every frame (wind). */
  wind: number;
  /** 0..1 - how much of the cat's momentum survives a landing. */
  grip: number;
}

const T = (o: Partial<TwistDef> & { id: TwistId; name: string; detail: string; icon: string; accent: string }): TwistDef => ({
  gravity: 1,
  friction: 1,
  wind: 0,
  grip: 1,
  ...o,
});

export const TWISTS: Record<TwistId, TwistDef> = {
  none: T({
    id: 'none', name: 'Klassisk', detail: 'Inga specialregler – bara du och banan.',
    icon: 'flag', accent: '#7ee7ff',
  }),
  slippery: T({
    id: 'slippery', name: 'Ishalka', detail: 'Marken är hal – bromsa i tid.',
    icon: 'ac_unit', accent: '#9df3ff', friction: 0.955, grip: 0.25,
  }),
  lowGravity: T({
    id: 'lowGravity', name: 'Låg gravitation', detail: 'Du svävar längre och hoppar högre.',
    icon: 'rocket_launch', accent: '#c3a6ff', gravity: 0.56,
  }),
  tailwind: T({
    id: 'tailwind', name: 'Medvind', detail: 'Vinden knuffar dig framåt – utnyttja den.',
    icon: 'air', accent: '#7ef7c2', wind: 0.12,
  }),
  headwind: T({
    id: 'headwind', name: 'Motvind', detail: 'Vinden trycker emot – håll tempot uppe.',
    icon: 'storm', accent: '#ffb26b', wind: -0.1,
  }),
  stickyBoots: T({
    id: 'stickyBoots', name: 'Klistriga tassar', detail: 'Du fastnar i marken och tappar fart långsammare.',
    icon: 'pan_tool_alt', accent: '#ffd166', friction: 0.78, grip: 1.6,
  }),
  heavyPaws: T({
    id: 'heavyPaws', name: 'Tunga tassar', detail: 'Du faller snabbare men landar stenhårt.',
    icon: 'weight', accent: '#ff8f6b', gravity: 1.32,
  }),
  quake: T({
    id: 'quake', name: 'Skakig mark', detail: 'Marken skälver – håll balansen.',
    icon: 'vibration', accent: '#ff9f43',
  }),
};

/** Ordered pools per difficulty tier. `none` is deliberately common: a twist
    on every single stage stops being special and starts being noise. */
const EARLY: TwistId[] = ['none', 'tailwind', 'stickyBoots', 'lowGravity'];
const MID: TwistId[] = ['none', 'slippery', 'headwind', 'lowGravity', 'tailwind', 'quake'];
const LATE: TwistId[] = ['slippery', 'headwind', 'quake', 'lowGravity', 'heavyPaws', 'none'];

/** Deterministic hash so a level always gets the same twist. */
const hash = (n: number) => {
  const s = Math.sin(n * 91.73 + 7.31) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * The twist for a level. Boss stages get no twist (the boss is the challenge),
 * and the first two tutorial stages stay clean so the basics are taught fairly.
 */
export const getLevelTwist = (level: number, seedOffset = 0): TwistDef => {
  if (level <= 2) return TWISTS.none;
  if (level % 5 === 0) return TWISTS.none;
  const pool = level < 8 ? EARLY : level < 22 ? MID : LATE;
  const index = Math.floor(hash(level * 13.7 + seedOffset) * pool.length);
  return TWISTS[pool[index] ?? 'none'];
};

/* ------------------------------------------------------------------ events */

export type EventId = 'meteor' | 'gust' | 'swarm' | 'goldRush' | 'blackout';

export interface EventDef {
  id: EventId;
  name: string;
  detail: string;
  icon: string;
  accent: string;
  /** Frames of telegraphed warning before it starts. */
  warning: number;
  /** Frames the event actually runs for. */
  duration: number;
}

export const EVENTS: Record<EventId, EventDef> = {
  meteor: {
    id: 'meteor', name: 'Meteorregn', detail: 'Håll dig borta från marken!',
    icon: 'local_fire_department', accent: '#ff8f6b', warning: 80, duration: 260,
  },
  gust: {
    id: 'gust', name: 'Vindby', detail: 'En kastvind sveper in över banan.',
    icon: 'storm', accent: '#7ee7ff', warning: 60, duration: 220,
  },
  swarm: {
    id: 'swarm', name: 'Fågelsvärm', detail: 'Himlen fylls av drönare.',
    icon: 'flutter_dash', accent: '#c3a6ff', warning: 70, duration: 300,
  },
  goldRush: {
    id: 'goldRush', name: 'Guldrusch', detail: 'Dubbel poäng på allt just nu!',
    icon: 'auto_awesome', accent: '#ffd166', warning: 55, duration: 340,
  },
  blackout: {
    id: 'blackout', name: 'Strömavbrott', detail: 'Ljuset slocknar – lita på minnet.',
    icon: 'flashlight_off', accent: '#8b9bb4', warning: 60, duration: 240,
  },
};

export interface ActiveEvent {
  id: EventId;
  /** Countdown in frames. Positive = warning, then the event runs. */
  timer: number;
  /** 0..1 progress through the whole event, for HUD rings. */
  progress: number;
}

const EVENT_ORDER: EventId[] = ['meteor', 'swarm', 'gust', 'goldRush', 'blackout'];

/**
 * Chooses the next surprise event. Events start once the player has learned the
 * basics, never interrupt a boss, and never repeat the previous one.
 */
export const pickEvent = (
  level: number,
  frame: number,
  seed: number,
  previous: EventId | null,
  bossFight: boolean,
): EventId | null => {
  if (level < 3 || bossFight) return null;
  // One roll every ~9 seconds; a quiet stage is part of the rhythm.
  if (frame % 540 !== 0) return null;
  const r = hash(seed + frame * 0.017 + level * 3.1);
  if (r > 0.55) return null;
  const candidates = EVENT_ORDER.filter((id) => id !== previous);
  return candidates[Math.floor(hash(seed + frame * 0.031) * candidates.length)] ?? null;
};

/** Turns a twist into the exact physics numbers the loop multiplies in. */
export const twistPhysics = (twist: TwistDef) => ({
  gravityMult: twist.gravity,
  frictionMult: twist.friction,
  windAccel: twist.wind,
  grip: twist.grip,
});
