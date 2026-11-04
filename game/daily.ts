/**
 * Local-only daily challenge data: ghost replays, a per-day leaderboard and a
 * play streak. Nothing here talks to a server; everything lives in
 * localStorage and degrades to empty data in private browsing.
 */
export type GhostFrame = [number, number, number]; // x, y, facing
export type GhostRun = { key: string; score: number; frames: GhostFrame[] };
export type DailyEntry = { score: number; level: number; date: string };

const GHOST_KEY = 'shadow_paw_ghost_v1';
const DAILY_KEY = 'shadow_paw_daily_scores_v1';
const STREAK_KEY = 'shadow_paw_daily_streak_v1';
const MAX_GHOST_FRAMES = 3600; // 4 minutes of samples at one per four frames

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

/** Ghosts are keyed by run mode + level + seed, so a daily layout never shows
    a ghost from the campaign version of the same level. */
export const loadGhost = (key: string): GhostRun | null => {
  const all = read<Record<string, GhostRun>>(GHOST_KEY, {});
  const ghost = all[key];
  return ghost && Array.isArray(ghost.frames) ? ghost : null;
};

/** Only replaces the ghost when the run actually beat it. Frames are capped
    and downsampled so a very long run cannot blow the storage quota. */
export const saveGhost = (key: string, score: number, frames: GhostFrame[]): boolean => {
  const all = read<Record<string, GhostRun>>(GHOST_KEY, {});
  if (all[key] && all[key].score >= score) return false;
  let kept = frames;
  if (kept.length > MAX_GHOST_FRAMES) {
    const stride = Math.ceil(kept.length / MAX_GHOST_FRAMES);
    kept = kept.filter((_, i) => i % stride === 0);
  }
  all[key] = { key, score, frames: kept };
  // Keep the store bounded: one ghost per of the last 40 distinct stages.
  const keys = Object.keys(all);
  if (keys.length > 40) {
    keys.slice(0, keys.length - 40).forEach((k) => delete all[k]);
  }
  return write(GHOST_KEY, all);
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
