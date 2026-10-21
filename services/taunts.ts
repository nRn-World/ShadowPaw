import { tr } from '../i18n';

// Statiska repliker från Jerry (bytet) på Game Over-skärmen. Inget nätverk, inga API-nycklar.

const LOW_SCORE = [
  "Du hann inte ifatt mig!",
  "Jag var snabbare idag, katten!",
  "Nästan! Men bara nästan.",
  "Skuggorna räcker inte om man hoppar för sent.",
];

const MID_SCORE = [
  "Bra kämpat, men bytet var snabbare!",
  "Det där var nära! Försök igen.",
  "Du börjar få koll på neonstaden.",
  "Inte illa, katten. Jag svettades faktiskt lite.",
];

const HIGH_SCORE = [
  "Wow, du är på väg att bli en legend!",
  "Det var imponerande. Jag fick springa riktigt fort!",
  "Du är läskigt bra. Nästa gång klarar du det!",
  "Det där var en rekordtyp av jakt. En runda till?",
];

const pick = (list: string[]): string => tr(list[Math.floor(Math.random() * list.length)]);

export const getJerryTaunt = (score: number): string => {
  if (score > 2000) return pick(HIGH_SCORE);
  if (score > 100) return pick(MID_SCORE);
  return pick(LOW_SCORE);
};
