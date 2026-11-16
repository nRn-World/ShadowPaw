/**
 * Small deterministic rules that give Shadow Paw its own identity without
 * adding network state or external assets. Keeping the tables pure makes them
 * safe to use from both the Canvas loop and unit tests.
 */

export type LifeBlessingId = 'pounce' | 'scent' | 'echo';

export type LifeBlessing = {
  id: LifeBlessingId;
  name: string;
  detail: string;
  icon: string;
  color: string;
};

export const LIFE_BLESSINGS: readonly LifeBlessing[] = [
  {
    id: 'pounce',
    name: 'Nio liv · studs',
    detail: 'Nästa försök får lite högre hoppkraft.',
    icon: 'north',
    color: '#7ef7c2',
  },
  {
    id: 'scent',
    name: 'Nio liv · spår',
    detail: 'Morrhårsläget startar laddat och visar dolda vägar.',
    icon: 'visibility',
    color: '#ffd166',
  },
  {
    id: 'echo',
    name: 'Nio liv · eko',
    detail: 'Ett förlorat liv lämnar ett eko som kan samlas upp.',
    icon: 'all_inclusive',
    color: '#c084fc',
  },
] as const;

export const getLifeBlessing = (lives: number, level: number): LifeBlessing =>
  LIFE_BLESSINGS[Math.abs(Math.floor(lives) + Math.floor(level)) % LIFE_BLESSINGS.length];

export type CompanionAbility = 'scent' | 'air' | 'shadow' | 'guard' | 'echo';

export type Companion = {
  level: number;
  id: string;
  name: string;
  color: string;
  ability: CompanionAbility;
  icon: string;
  detail: string;
};

/** Each rescued cat changes the run in a small, readable way. */
export const COMPANIONS: readonly Companion[] = [
  { level: 2, id: 'miso', name: 'Miso', color: '#ffc477', ability: 'scent', icon: 'visibility', detail: 'Morrhårsläget varar längre.' },
  { level: 7, id: 'luna', name: 'Luna', color: '#b9a3ff', ability: 'air', icon: 'air', detail: 'Lite starkare dubbelhopp.' },
  { level: 12, id: 'kiko', name: 'Kiko', color: '#82daf3', ability: 'shadow', icon: 'dark_mode', detail: 'Skuggskiftet laddas snabbare.' },
  { level: 17, id: 'mochi', name: 'Mochi', color: '#ffe8a6', ability: 'guard', icon: 'shield', detail: 'Första träffen i en nivå kan pareras.' },
  { level: 22, id: 'sora', name: 'Sora', color: '#8ae4cb', ability: 'echo', icon: 'auto_awesome', detail: 'Livsekon ger mer poäng och laddning.' },
  { level: 27, id: 'nori', name: 'Nori', color: '#aab8df', ability: 'scent', icon: 'radar', detail: 'Dolda fiskar får starkare spår.' },
  { level: 32, id: 'pip', name: 'Pip', color: '#ffb0bd', ability: 'air', icon: 'flight', detail: 'Dashen återhämtar sig lite snabbare.' },
  { level: 37, id: 'echo', name: 'Echo', color: '#d7b1fa', ability: 'echo', icon: 'record_voice_over', detail: 'Ekon visar var du senast föll.' },
] as const;

export const getCompanionById = (id: unknown, rescuedLevels: number[]): Companion | null => {
  if (typeof id !== 'string') return null;
  const companion = COMPANIONS.find((cat) => cat.id === id);
  return companion && rescuedLevels.includes(companion.level) ? companion : null;
};

/** Select the saved companion when valid; otherwise fall back to the newest
    rescued friend so old saves still get a useful default. */
export const getActiveCompanion = (rescuedLevels: number[], equippedId?: unknown): Companion | null =>
  getCompanionById(equippedId, rescuedLevels)
  || (() => {
    const found = COMPANIONS.filter((cat) => rescuedLevels.includes(cat.level));
    return found.length ? found[found.length - 1] : null;
  })()
  || null;

export const isCompanionUnlocked = (id: unknown, rescuedLevels: number[]): boolean =>
  !!getCompanionById(id, rescuedLevels);

export type FishBehavior = 'calm' | 'school' | 'skittish';

/** The early tutorial stays calm; later levels teach one fish behavior at a time. */
export const getFishBehavior = (level: number, index: number): FishBehavior => {
  if (level < 3) return 'calm';
  if (index % 5 === 0) return 'school';
  if (index % 3 === 0) return 'skittish';
  return 'calm';
};

export type DistrictRule = {
  id: 'meadow' | 'neon' | 'wild' | 'frozen' | 'industrial' | 'cosmic';
  name: string;
  detail: string;
  icon: string;
  accent: string;
};

/** A short district identity shown on the intro card in addition to the twist. */
export const getDistrictRule = (theme: string, level: number): DistrictRule => {
  const value = String(theme || '').toLowerCase();
  if (/(ice|glacier|alpine|arctic)/.test(value)) {
    return { id: 'frozen', name: 'Kalla spår', detail: 'Fiskar driver med vinden och lämnar frostiga spår.', icon: 'ac_unit', accent: '#9df3ff' };
  }
  if (/(space|quantum|nexus|void)/.test(value)) {
    return { id: 'cosmic', name: 'Stjärnfall', detail: 'Skuggvägarna blinkar i takt med banans puls.', icon: 'flare', accent: '#d8b4fe' };
  }
  if (/(industrial|power|nuclear|laboratory|construction)/.test(value)) {
    return { id: 'industrial', name: 'Maskinrytm', detail: 'Plattformar och ljus följer en tydlig mekanisk rytm.', icon: 'precision_manufacturing', accent: '#ffd166' };
  }
  if (/(city|downtown|rooftop|datacenter|highway)/.test(value) || level % 5 === 0) {
    return { id: 'neon', name: 'Neonpuls', detail: 'Skuggskiftet avslöjar en alternativ väg genom kvarteren.', icon: 'location_city', accent: '#ff82e5' };
  }
  if (/(forest|mountain|beach|countryside|park)/.test(value)) {
    return { id: 'wild', name: 'Levande spår', detail: 'Fiskstim och eldflugor rör sig med världen.', icon: 'nature', accent: '#7ef7c2' };
  }
  return { id: 'meadow', name: 'Första tassarna', detail: 'En tydlig väg för att lära känna kattens rörelser.', icon: 'pets', accent: '#2bee79' };
};

export type DailyContractKind = 'fish' | 'shadow' | 'stomp' | 'clean';
export type DailyContract = {
  id: string;
  name: string;
  detail: string;
  kind: DailyContractKind;
  target: number;
  reward: number;
};

const textSeed = (value: string) => Array.from(String(value)).reduce((sum, char) => sum + char.charCodeAt(0), 0);

/** Three deterministic daily contracts: everyone gets the same goals.
    A stomp contract only appears on a boss stage; a normal daily stage must
    never show a goal that its layout cannot satisfy. */
export const getDailyContracts = (seed: string, level?: number): DailyContract[] => {
  const n = textSeed(seed);
  const pool: DailyContract[] = [
    { id: 'fish-rush', name: 'Fiskrusning', detail: 'Samla fiskar på dagens bana.', kind: 'fish', target: 8 + (n % 5), reward: 180 },
    { id: 'shadow-scout', name: 'Skuggspanare', detail: 'Aktivera Skuggskiftet en gång.', kind: 'shadow', target: 1, reward: 220 },
    { id: 'stomp-artist', name: 'Stompkonstnär', detail: 'Trampa på bossen två gånger.', kind: 'stomp', target: 2, reward: 260 },
    { id: 'clean-paws', name: 'Sammetstassar', detail: 'Klara dagens bana utan att tappa liv.', kind: 'clean', target: 1, reward: 300 },
  ];
  const eligible = level !== undefined && level % 5 !== 0
    ? pool.filter((contract) => contract.kind !== 'stomp')
    : pool;
  const start = n % eligible.length;
  return [0, 1, 2].map((offset) => eligible[(start + offset) % eligible.length]);
};

export const isDailyContractComplete = (contract: DailyContract, progress: Record<DailyContractKind, number>): boolean =>
  (progress[contract.kind] || 0) >= contract.target;

export const createContractProgress = (): Record<DailyContractKind, number> => ({
  fish: 0,
  shadow: 0,
  stomp: 0,
  clean: 0,
});
