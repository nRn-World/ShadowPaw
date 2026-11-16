/**
 * Local level mastery records.
 *
 * A clear is more satisfying when the player can improve a concrete record,
 * not only their account XP. Records stay local and offline-friendly, just like
 * the existing daily board; they never affect deterministic level generation.
 */

export type MasteryGrade = 'S' | 'A' | 'B' | 'C';

export type LevelMastery = {
  bestScore: number;
  bestTime: number;
  bestGrade: MasteryGrade;
  noHit: boolean;
  fullCatch: boolean;
  attempts: number;
  deaths: number;
  bestCombo: number;
};

export type MasteryRecords = Record<string, LevelMastery>;

export type LevelMasteryResult = {
  score: number;
  time: number;
  grade: MasteryGrade;
  noHit: boolean;
  fullCatch: boolean;
  deaths: number;
  bestCombo: number;
};

const KEY = 'shadow_paw_mastery_v1';
const GRADES: MasteryGrade[] = ['C', 'B', 'A', 'S'];

export const emptyLevelMastery = (): LevelMastery => ({
  bestScore: 0,
  bestTime: 0,
  bestGrade: 'C',
  noHit: false,
  fullCatch: false,
  attempts: 0,
  deaths: 0,
  bestCombo: 0,
});

const cleanGrade = (value: unknown): MasteryGrade =>
  value === 'S' || value === 'A' || value === 'B' ? value : 'C';

const cleanRecord = (value: unknown): LevelMastery => {
  const raw = value && typeof value === 'object' ? value as Partial<LevelMastery> : {};
  return {
    bestScore: Number.isFinite(Number(raw.bestScore)) ? Math.max(0, Math.floor(Number(raw.bestScore))) : 0,
    bestTime: Number.isFinite(Number(raw.bestTime)) ? Math.max(0, Math.round(Number(raw.bestTime))) : 0,
    bestGrade: cleanGrade(raw.bestGrade),
    noHit: raw.noHit === true,
    fullCatch: raw.fullCatch === true,
    attempts: Number.isFinite(Number(raw.attempts)) ? Math.max(0, Math.floor(Number(raw.attempts))) : 0,
    deaths: Number.isFinite(Number(raw.deaths)) ? Math.max(0, Math.floor(Number(raw.deaths))) : 0,
    bestCombo: Number.isFinite(Number(raw.bestCombo)) ? Math.max(0, Math.floor(Number(raw.bestCombo))) : 0,
  };
};

/** Merge one newly cleared level into a previous record without side effects. */
export const mergeLevelMastery = (
  previous: LevelMastery | undefined,
  result: LevelMasteryResult,
): LevelMastery => {
  const old = cleanRecord(previous);
  const grade = cleanGrade(result.grade);
  const resultTime = Number.isFinite(result.time) ? Math.max(0, Math.round(result.time)) : 0;
  const betterTime = resultTime > 0 && (old.bestTime === 0 || resultTime < old.bestTime);
  const oldGradeIndex = GRADES.indexOf(old.bestGrade);
  const newGradeIndex = GRADES.indexOf(grade);

  return {
    bestScore: Math.max(old.bestScore, Math.max(0, Math.floor(result.score || 0))),
    bestTime: betterTime ? resultTime : old.bestTime,
    bestGrade: newGradeIndex > oldGradeIndex ? grade : old.bestGrade,
    noHit: old.noHit || result.noHit === true,
    fullCatch: old.fullCatch || result.fullCatch === true,
    attempts: old.attempts + 1,
    deaths: old.deaths + Math.max(0, Math.floor(result.deaths || 0)),
    bestCombo: Math.max(old.bestCombo, Math.max(0, Math.floor(result.bestCombo || 0))),
  };
};

export const readMasteryRecords = (): MasteryRecords => {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([level]) => /^\d+$/.test(level)).map(([level, value]) => [level, cleanRecord(value)]),
    );
  } catch {
    return {};
  }
};

export const getLevelMastery = (level: number, records = readMasteryRecords()): LevelMastery | null =>
  records[String(Math.max(1, Math.floor(level)))] || null;

/** Save a clear and return the new best record for the results screen. */
export const recordLevelMastery = (level: number, result: LevelMasteryResult): LevelMastery => {
  const key = String(Math.max(1, Math.floor(level)));
  const records = readMasteryRecords();
  const next = mergeLevelMastery(records[key], result);
  records[key] = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    // Private browsing/storage limits must never block a level clear.
  }
  return next;
};

export const masteryCount = (records = readMasteryRecords()): number => Object.keys(records).length;
