/**
 * Tiny, local-only death-cause telemetry. `Views.tsx` records causes; the Game
 * Over screen reads the aggregate and turns it into one actionable tip. No
 * identifiers, no network, no third-party script.
 */
import { readJson } from './storage.ts';

export type DeathCause = 'enemy' | 'hazard' | 'hole' | 'timer' | 'boss';

export type Telemetry = {
  totalRuns?: number;
  deathsByCause?: Partial<Record<DeathCause, number>>;
  levelDeaths?: Record<string, number>;
};

const KEY = 'shadow_paw_telemetry';

export const readTelemetry = (): Telemetry => {
  const parsed = readJson<unknown>(KEY, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const raw = parsed as Record<string, unknown>;
  const cleanCounts = (value: unknown): Partial<Record<DeathCause, number>> => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return Object.fromEntries((['enemy', 'hazard', 'hole', 'timer', 'boss'] as DeathCause[]).map((cause) => {
      const count = Number(source[cause]);
      return [cause, Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0];
    })) as Partial<Record<DeathCause, number>>;
  };
  const rawLevels = raw.levelDeaths && typeof raw.levelDeaths === 'object' && !Array.isArray(raw.levelDeaths)
    ? raw.levelDeaths as Record<string, unknown>
    : {};
  const levelDeaths = Object.fromEntries(Object.entries(rawLevels).flatMap(([level, count]) => {
    const n = Number(count);
    return /^\d+$/.test(level) && Number.isFinite(n) ? [[level, Math.max(0, Math.floor(n))]] : [];
  }));
  const totalRuns = Number(raw.totalRuns);
  return {
    totalRuns: Number.isFinite(totalRuns) ? Math.max(0, Math.floor(totalRuns)) : 0,
    deathsByCause: cleanCounts(raw.deathsByCause),
    levelDeaths,
  };
};

/** The cause that ended the most runs, with a stable tie-break so the advice
    does not flicker between two equal causes. */
export const getTopDeathCause = (data: Telemetry = readTelemetry()): DeathCause | null => {
  const causes: DeathCause[] = ['hole', 'enemy', 'hazard', 'timer', 'boss'];
  let best: DeathCause | null = null;
  let bestCount = 0;
  for (const cause of causes) {
    const count = data.deathsByCause?.[cause] || 0;
    if (count > bestCount) {
      best = cause;
      bestCount = count;
    }
  }
  return best;
};

export const getMostDangerousLevel = (data: Telemetry = readTelemetry()): number | null => {
  const entries = Object.entries(data.levelDeaths || {});
  if (!entries.length) return null;
  return Number(entries.sort((a, b) => b[1] - a[1])[0][0]) || null;
};
