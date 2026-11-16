/**
 * Local-only daily challenge data: a per-day leaderboard and a
 * play streak. Nothing here talks to a server; everything lives in
 * localStorage and degrades to empty data in private browsing.
 */
export type DailyEntry = { score: number; level: number; date: string };

const DAILY_KEY = 'shadow_paw_daily_scores_v1';
const GHOST_KEY = 'shadow_paw_daily_ghost_v2';
const LEGACY_GHOST_KEY = 'shadow_paw_ghost_v1';
const STREAK_KEY = 'shadow_paw_daily_streak_v1';

// The old replay format was an unbounded, incompatible blob. Remove it once;
// the v2 trace below is separate, capped and validated.
try {
  localStorage.removeItem(LEGACY_GHOST_KEY);
} catch {
  // Storage can be unavailable in private browsing or unit tests.
}

export type GhostFrame = { frame: number; x: number; y: number; facing: 1 | -1 };

/** A tiny local replay: no account or server is required, and it is capped so
    a daily run can never fill localStorage. */
const cleanGhostFrames = (value: unknown): GhostFrame[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2400).filter((frame): frame is GhostFrame => {
    if (!frame || typeof frame !== 'object') return false;
    const candidate = frame as Partial<GhostFrame>;
    return typeof candidate.frame === 'number' && Number.isFinite(candidate.frame)
      && typeof candidate.x === 'number' && Number.isFinite(candidate.x)
      && typeof candidate.y === 'number' && Number.isFinite(candidate.y)
      && (candidate.facing === 1 || candidate.facing === -1);
  });
};

export const loadDailyGhost = (date: string, level: number): GhostFrame[] => {
  const all = read<Record<string, unknown>>(GHOST_KEY, {});
  return cleanGhostFrames(all[`${date}:${level}`]);
};

export const saveDailyGhost = (date: string, level: number, frames: GhostFrame[]): boolean => {
  const clean = cleanGhostFrames(frames);
  if (!clean.length) return false;
  const all = read<Record<string, unknown>>(GHOST_KEY, {});
  all[`${date}:${level}`] = clean.slice(-2400);
  const keys = Object.keys(all).sort();
  if (keys.length > 14) keys.slice(0, keys.length - 14).forEach((key) => delete all[key]);
  return write(GHOST_KEY, all);
};

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const loadDailyScores = (date: string): DailyEntry[] => {
  const all = read<Record<string, DailyEntry[]>>(DAILY_KEY, {});
  return (all[date] || []).slice().sort((a, b) => b.score - a.score).slice(0, 10);
};

/** Returns the 1-based rank on that day, or 0 when storage was unavailable. */
export const recordDailyScore = (date: string, score: number, level: number): number => {
  const all = read<Record<string, DailyEntry[]>>(DAILY_KEY, {});
  const list = all[date] || [];
  list.push({ score, level, date });
  all[date] = list.sort((a, b) => b.score - a.score).slice(0, 10);
  // Only a handful of days is interesting; prune the rest.
  const days = Object.keys(all).sort();
  if (days.length > 14) days.slice(0, days.length - 14).forEach((d) => delete all[d]);
  if (!write(DAILY_KEY, all)) return 0;
  return all[date].findIndex((e) => e.score === score && e.level === level) + 1;
};

export type DailyStreak = { last: string; count: number };

export const readDailyStreak = (): DailyStreak =>
  read<DailyStreak>(STREAK_KEY, { last: '', count: 0 });

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
