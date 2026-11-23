/**
 * Local-only daily challenge data: a per-day leaderboard and a
 * play streak. Nothing here talks to a server; everything lives in
 * localStorage and degrades to empty data in private browsing.
 */
import { readJson, safeRemove, writeJson } from './storage.ts';

export type DailyEntry = { score: number; level: number; date: string };

const DAILY_KEY = 'shadow_paw_daily_scores_v1';
const GHOST_KEY = 'shadow_paw_daily_ghost_v2';
const LEGACY_GHOST_KEY = 'shadow_paw_ghost_v1';
const STREAK_KEY = 'shadow_paw_daily_streak_v1';

// The old replay format was an unbounded, incompatible blob. Remove it once;
// the v2 trace below is separate, capped and validated.
safeRemove(LEGACY_GHOST_KEY);

export type GhostFrame = { frame: number; x: number; y: number; facing: 1 | -1 };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** A tiny local replay: no account or server is required, and it is capped so
    a daily run can never fill localStorage. */
const cleanGhostFrames = (value: unknown): GhostFrame[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((frame): frame is GhostFrame => {
    if (!frame || typeof frame !== 'object') return false;
    const candidate = frame as Partial<GhostFrame>;
    return typeof candidate.frame === 'number' && Number.isFinite(candidate.frame)
      && candidate.frame >= 0
      && typeof candidate.x === 'number' && Number.isFinite(candidate.x)
      && typeof candidate.y === 'number' && Number.isFinite(candidate.y)
      && (candidate.facing === 1 || candidate.facing === -1);
  }).slice(-2400);
};

const cleanDailyEntry = (value: unknown, date: string): DailyEntry | null => {
  const candidate = asRecord(value);
  const score = Number(candidate.score);
  const level = Number(candidate.level);
  if (!Number.isFinite(score) || !Number.isFinite(level)) return null;
  return {
    score: Math.max(0, Math.floor(score)),
    level: Math.max(1, Math.floor(level)),
    date,
  };
};

const read = <T,>(key: string, fallback: T): T => readJson(key, fallback);
const write = (key: string, value: unknown) => writeJson(key, value);

const readGhostStore = (): Record<string, GhostFrame[]> => {
  const raw = readJson<unknown>(GHOST_KEY, {});
  const source = asRecord(raw);
  return Object.fromEntries(Object.entries(source)
    .map(([key, value]) => [key, cleanGhostFrames(value)] as const)
    .filter(([, value]) => value.length > 0));
};

export const loadDailyGhost = (date: string, level: number): GhostFrame[] =>
  readGhostStore()[`${date}:${level}`] || [];

export const saveDailyGhost = (date: string, level: number, frames: GhostFrame[]): boolean => {
  const clean = cleanGhostFrames(frames);
  if (!clean.length) return false;
  const all = readGhostStore();
  all[`${date}:${level}`] = clean;
  const keys = Object.keys(all).sort();
  if (keys.length > 14) keys.slice(0, keys.length - 14).forEach((key) => delete all[key]);
  return write(GHOST_KEY, all);
};

const readDailyStore = (): Record<string, DailyEntry[]> => {
  const source = asRecord(readJson<unknown>(DAILY_KEY, {}));
  return Object.fromEntries(Object.entries(source).map(([date, value]) => [
    date,
    Array.isArray(value)
      ? value.map((entry) => cleanDailyEntry(entry, date)).filter((entry): entry is DailyEntry => entry !== null)
      : [],
  ]));
};

export const loadDailyScores = (date: string): DailyEntry[] => {
  const all = readDailyStore();
  return (all[date] || []).slice().sort((a, b) => b.score - a.score).slice(0, 10);
};

/** Returns the 1-based rank on that day, or 0 when storage was unavailable. */
export const recordDailyScore = (date: string, score: number, level: number): number => {
  const all = readDailyStore();
  const list = all[date] || [];
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  list.push({ score: safeScore, level: safeLevel, date });
  all[date] = list.sort((a, b) => b.score - a.score).slice(0, 10);
  // Only a handful of days is interesting; prune the rest.
  const days = Object.keys(all).sort();
  if (days.length > 14) days.slice(0, days.length - 14).forEach((d) => delete all[d]);
  if (!write(DAILY_KEY, all)) return 0;
  return all[date].findIndex((e) => e.score === score && e.level === level) + 1;
};

export type DailyStreak = { last: string; count: number };

export const readDailyStreak = (): DailyStreak => {
  const raw = asRecord(readJson<unknown>(STREAK_KEY, {}));
  const last = typeof raw.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.last) ? raw.last : '';
  const count = Number(raw.count);
  return { last, count: Number.isFinite(count) ? Math.max(0, Math.min(9999, Math.floor(count))) : 0 };
};

/** Consecutive calendar days. A missed day resets to one, not to zero. */
export const touchDailyStreak = (date: string): DailyStreak => {
  const prev = readDailyStreak();
  if (prev.last === date) return prev;
  const yesterday = new Date(`${date}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const next = { last: date, count: prev.last === y ? prev.count + 1 : 1 };
  write(STREAK_KEY, next);
  return next;
};
