/**
 * Between-level risk/reward cards. Every card has an upside *and* a cost, so
 * the choice is a playstyle decision rather than a free power-up. Offers are
 * derived from the level seed: restarting never rerolls the three cards.
 */
import { seededRandom } from './level.ts';

export type PerkId =
  | 'glass_cannon' | 'greedy_paws' | 'iron_fur' | 'quick_step'
  | 'shadow_battery' | 'long_line' | 'steady_paws' | 'time_lord';

export type PerkEffect = {
  scoreMult?: number;
  fishGoalDelta?: number;
  speedMult?: number;
  shadowChargeMult?: number;
  timerMult?: number;
  invincibleBonus?: number;
};

export type PerkDef = {
  id: PerkId;
  name: string;
  desc: string;
  icon: string;
  color: string;
  effect: PerkEffect;
};

export const PERKS: PerkDef[] = [
  { id: 'glass_cannon', name: 'Glaskanon', desc: '+30 % poäng, men varje träff kostar två liv.', icon: 'whatshot', color: '#ff6b6b', effect: { scoreMult: 1.3, invincibleBonus: -30 } },
  { id: 'greedy_paws', name: 'Giriga tassar', desc: '+35 % poäng, men två fiskar till krävs.', icon: 'paid', color: '#ffd166', effect: { scoreMult: 1.35, fishGoalDelta: 2 } },
  { id: 'iron_fur', name: 'Järnpäls', desc: 'Längre skydd efter en träff, men 10 % långsammare.', icon: 'shield', color: '#7ee7ff', effect: { invincibleBonus: 45, speedMult: 0.9 } },
  { id: 'quick_step', name: 'Snabba steg', desc: '+15 % fart, men 20 % kortare tid i Speed Run.', icon: 'directions_run', color: '#2bee79', effect: { speedMult: 1.15, timerMult: 0.8 } },
  { id: 'shadow_battery', name: 'Skuggbatteri', desc: '+40 % laddning till Skuggskiftet, men 10 % färre poäng.', icon: 'battery_charging_full', color: '#c084fc', effect: { shadowChargeMult: 1.4, scoreMult: 0.9 } },
  { id: 'long_line', name: 'Lång lina', desc: 'En fisk färre att samla, men 15 % färre poäng.', icon: 'set_meal', color: '#7ef7c2', effect: { fishGoalDelta: -1, scoreMult: 0.85 } },
  { id: 'steady_paws', name: 'Stadiga tassar', desc: '+25 % tid i Speed Run, men 8 % långsammare.', icon: 'schedule', color: '#ffe600', effect: { timerMult: 1.25, speedMult: 0.92 } },
  { id: 'time_lord', name: 'Tidsherre', desc: '+25 % tid och +20 % laddning, men en fisk till krävs.', icon: 'hourglass_top', color: '#00e1ff', effect: { timerMult: 1.25, shadowChargeMult: 1.2, fishGoalDelta: 1 } },
];

export const PERK_BY_ID: Record<string, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p]));

/** Combine the effects of all chosen cards. Multipliers stack multiplicatively,
    additive deltas sum, so a full run of eight cards stays bounded. */
export const combinePerkEffects = (ids: string[]): Required<PerkEffect> => {
  const out: Required<PerkEffect> = {
    scoreMult: 1, fishGoalDelta: 0, speedMult: 1,
    shadowChargeMult: 1, timerMult: 1, invincibleBonus: 0,
  };
  for (const id of ids) {
    const e = PERK_BY_ID[id]?.effect;
    if (!e) continue;
    if (e.scoreMult) out.scoreMult *= e.scoreMult;
    if (e.fishGoalDelta) out.fishGoalDelta += e.fishGoalDelta;
    if (e.speedMult) out.speedMult *= e.speedMult;
    if (e.shadowChargeMult) out.shadowChargeMult *= e.shadowChargeMult;
    if (e.timerMult) out.timerMult *= e.timerMult;
    if (e.invincibleBonus) out.invincibleBonus += e.invincibleBonus;
  }
  out.scoreMult = Math.max(0.6, Math.min(2, out.scoreMult));
  out.speedMult = Math.max(0.75, Math.min(1.4, out.speedMult));
  out.timerMult = Math.max(0.65, Math.min(1.8, out.timerMult));
  out.invincibleBonus = Math.max(-60, Math.min(120, out.invincibleBonus));
  return out;
};

/** Three distinct, deterministic cards. Already-owned cards are excluded so a
    long run keeps offering new decisions. */
export const offerPerks = (seed: number, owned: string[] = []): PerkDef[] => {
  const pool = PERKS.filter((p) => !owned.includes(p.id));
  if (pool.length <= 3) return pool.slice(0, 3);
  const chosen: PerkDef[] = [];
  let s = seed;
  while (chosen.length < 3) {
    s += 7.13;
    const pick = pool[Math.floor(seededRandom(s) * pool.length)];
    if (!chosen.some((c) => c.id === pick.id)) chosen.push(pick);
  }
  return chosen;
};
