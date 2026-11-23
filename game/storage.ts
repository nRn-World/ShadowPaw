/**
 * Defensive local persistence for the offline game.
 *
 * Browser storage is optional: private browsing, disabled storage and quota
 * exhaustion must never prevent Shadow Paw from rendering or finishing a run.
 * Keeping all access here also gives migrations and tests one small seam.
 */

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

const getStorage = (): StorageLike | null => {
  try {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
    return candidate && typeof candidate.getItem === 'function'
      && typeof candidate.setItem === 'function'
      ? candidate
      : null;
  } catch {
    return null;
  }
};

export const safeGet = (key: string): string | null => {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const safeSet = (key: string, value: string): boolean => {
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const safeRemove = (key: string): boolean => {
  try {
    const storage = getStorage();
    if (!storage) return false;
    if (typeof storage.removeItem !== 'function') return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

export const readUnknownJson = (key: string): unknown | undefined => {
  const raw = safeGet(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};

export const readJson = <T,>(key: string, fallback: T): T => {
  const parsed = readUnknownJson(key);
  return parsed === undefined ? fallback : parsed as T;
};

export const readJsonWithBackup = <T,>(key: string, backupKey: string, fallback: T): T => {
  const primary = readUnknownJson(key);
  if (primary !== undefined) return primary as T;
  const backup = readUnknownJson(backupKey);
  return backup === undefined ? fallback : backup as T;
};

export const writeJson = (key: string, value: unknown): boolean => {
  try {
    return safeSet(key, JSON.stringify(value));
  } catch {
    return false;
  }
};

/**
 * Preserve the last known good JSON payload after replacing the primary save.
 * Never overwrite a valid backup with malformed bytes when a primary write is
 * blocked by quota/private mode; the caller never has to handle an exception.
 */
export const writeJsonWithBackup = (key: string, backupKey: string, value: unknown): boolean => {
  const previous = readUnknownJson(key);
  const written = writeJson(key, value);
  if (written && previous !== undefined) writeJson(backupKey, previous);
  return written;
};

export const hasStorage = (): boolean => getStorage() !== null;
