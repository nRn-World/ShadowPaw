/**
 * Local-only daily challenge data: a per-day leaderboard and a
 * play streak. Nothing here talks to a server; everything lives in
 * localStorage and degrades to empty data in private browsing.
 */
export type DailyEntry = { score: number; level: number; date: string };

const DAILY_KEY = 'shadow_paw_daily_scores_v1';
/**
 * Ghost replays were removed from the game (the translucent pace-setter cat in
 * each level, plus the localStorage recordings behind it). Players who ran an
 * earlier build still carry that data in their browser, so it is dropped here
 * once on first read rather than left to sit in storage forever.
 */
const LEGACY_GHOST_KEY = 'shadow_paw_ghost_v1';
try {
  localStorage.removeItem(LEGACY_GHOST_KEY);
} catch {
  // Private browsing can refuse storage access; nothing to clean up there.
}
const STREAK_KEY = 'shadow_paw_daily_streak_v1';

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
