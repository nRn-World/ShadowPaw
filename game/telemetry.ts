/**
 * Tiny, local-only death-cause telemetry. `Views.tsx` records causes; the Game
 * Over screen reads the aggregate and turns it into one actionable tip. No
 * identifiers, no network, no third-party script.
 */
export type DeathCause = 'enemy' | 'hazard' | 'hole' | 'timer' | 'boss';

export type Telemetry = {
  totalRuns?: number;
  deathsByCause?: Partial<Record<DeathCause, number>>;
  levelDeaths?: Record<string, number>;
};

const KEY = 'shadow_paw_telemetry';

export const readTelemetry = (): Telemetry => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Telemetry;
  } catch {
    return {};
  }
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
