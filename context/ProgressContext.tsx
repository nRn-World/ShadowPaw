
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PlayerProgress } from '../types';
import { cleanSecrets, SECRET_REWARD_COUNT } from '../game/shadowSecrets';
import { cleanRescues, cleanDecor, type HideoutDecor } from '../game/rescue';
import { cleanCatQuestClaims, claimCatQuest as applyCatQuest } from '../game/sideQuests';
import { getCompanionById } from '../game/uniqueSystems';
import { CAMPAIGN_LEVEL_COUNT } from '../game/constants';
import { readUnknownJson, safeGet, writeJsonWithBackup } from '../game/storage';

const STORAGE_KEY = 'shadow_paw_progress_v2';
const STORAGE_BACKUP_KEY = 'shadow_paw_progress_backup_v2';

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const getTodaySeed = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const getWeekSeed = () => {
  const d = new Date();
  const dayNum = (d.getDay() + 6) % 7;
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - dayNum);
  return `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
};

const createDailyQuests = (seedText: string) => {
  const seed = Array.from(seedText).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return [
    { id: 'd1', description: 'Samla fiskar idag', target: 30 + Math.floor(seededRandom(seed + 1) * 40), current: 0, reward: 100, completed: false, claimed: false },
    { id: 'd2', description: 'Besegra fiender idag', target: 8 + Math.floor(seededRandom(seed + 2) * 12), current: 0, reward: 140, completed: false, claimed: false },
    { id: 'd3', description: 'Klara nivåer idag', target: 2 + Math.floor(seededRandom(seed + 3) * 3), current: 0, reward: 180, completed: false, claimed: false },
  ];
};

const createWeeklyQuests = (seedText: string) => {
  const seed = Array.from(seedText).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return [
    { id: 'w1', description: 'Vecko-jakt: samla fisk', target: 220 + Math.floor(seededRandom(seed + 7) * 180), current: 0, reward: 500, completed: false, claimed: false },
    { id: 'w2', description: 'Vecko-jakt: besegra fiender', target: 70 + Math.floor(seededRandom(seed + 11) * 60), current: 0, reward: 650, completed: false, claimed: false },
    { id: 'w3', description: 'Vecko-jakt: nära missar', target: 25 + Math.floor(seededRandom(seed + 13) * 15), current: 0, reward: 450, completed: false, claimed: false },
  ];
};

const defaultProgress: PlayerProgress = {
  coins: 0,
  totalCoinsEarned: 0,
  xp: 0,
  level: 1,
  campaignLevel: 1,
  shadowSecrets: [],
  rescuedCats: [],
  equippedCompanion: null,
  claimedCatQuests: [],
  hideoutDecor: 'classic',
  unlockedSkins: ['default'],
  equippedSkin: 'default',
  upgrades: {
    maxAmmo: 5,
    jumpPower: 15,
    speed: 5,
  },
  achievements: [],
  dailyQuests: createDailyQuests(getTodaySeed()),
  weeklyQuests: createWeeklyQuests(getWeekSeed()),
  dailySeed: getTodaySeed(),
  weeklySeed: getWeekSeed(),
  settings: {
    language: 'en',
    uiScale: 1,
    textScale: 1,
    colorBlindMode: false,
    reduceMotion: 'system',
    debugOverlay: false,
    haptics: true,
    difficulty: 'normal',
    autoQuality: true,
    cinematicEffects: true,
    adaptiveAudio: true,
    leftHandedControls: false,
    muted: false,
    musicVolume: 75,
    sfxVolume: 50,
  },
  stats: {
    totalEnemiesDefeated: 0,
    totalFishCollected: 0,
    totalDeaths: 0,
    perfectLevels: 0,
    bestCombo: 0,
    bossesDefeated: 0,
    shadowPasses: 0,
  },
};

interface ProgressContextType {
  progress: PlayerProgress;
  addCoins: (amount: number) => void;
  addXP: (amount: number) => void;
  completeQuest: (questId: string) => void;
  updateQuestProgress: (questId: string, increment: number) => void;
  buyUpgrade: (type: 'maxAmmo' | 'jumpPower' | 'speed', cost: number) => boolean;
  equipSkin: (skinId: string) => void;
  resetDailyQuests: () => void;
  claimQuestReward: (questId: string) => void;
  updateSettings: (updates: Partial<PlayerProgress['settings']>) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  updateStats: (updates: Partial<PlayerProgress['stats']>) => void;
  /** Advances the campaign checkpoint, but only for a run that began at or
      before the currently unlocked chapter. Returns nothing: the story is
      never allowed to jump ahead because of a Daily Run. */
  advanceCampaign: (reachedLevel: number, runStartLevel: number) => void;
  unlockAchievement: (achievementId: string) => void;
  unlockSkin: (skinId: string) => void;
  collectShadowSecret: (level: number) => void;
  rescueCat: (level: number) => void;
  equipCompanion: (id: string | null) => void;
  claimCatQuest: (id: string) => void;
  setHideoutDecor: (decor: HideoutDecor) => void;
  applyRunResults: (results: {
    fishesCollected: number;
    enemiesDefeated: number;
    levelsCompleted: number;
    perfectLevel: boolean;
    bestCombo: number;
    bossDefeated: boolean;
    deaths: number;
    shadowPasses?: number;
  }) => void;
  exportProgressCode: () => string;
  importProgressCode: (encoded: string) => boolean;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

/** Older builds stored the two volume sliders outside the save file. Adopt those
    values once so a returning player keeps the levels they already picked. */
const migrateLegacyAudio = (settings: PlayerProgress['settings']): PlayerProgress['settings'] => {
  if (typeof window === 'undefined') return settings;
  try {
    const legacyMusic = safeGet('shadow_paw_music');
    const legacySfx = safeGet('shadow_paw_sfx');
    return {
      ...settings,
      musicVolume: legacyMusic !== null && settings.musicVolume === defaultProgress.settings.musicVolume
        ? clampVolume(Number(legacyMusic))
        : settings.musicVolume,
      sfxVolume: legacySfx !== null && settings.sfxVolume === defaultProgress.settings.sfxVolume
        ? clampVolume(Number(legacySfx))
        : settings.sfxVolume,
    };
  } catch {
    return settings;
  }
};

/** Before the checkpoint lived in the save file it had its own localStorage key.
    Read it once so a returning player keeps the chapter they unlocked. */
const readLegacyCheckpoint = () => {
  try {
    const n = Number(safeGet('shadow_paw_checkpoint'));
    return Number.isFinite(n) && n > 1 ? Math.min(CAMPAIGN_LEVEL_COUNT, Math.floor(n)) : 1;
  } catch {
    return 1;
  }
};

// The save file stores the next playable story level. Keep old saves and the
// final clear inside the shipped campaign so no code path can create a ghost
// level 41 checkpoint after the finale.
const clampCampaignLevel = (value: unknown, fallback = 1) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(CAMPAIGN_LEVEL_COUNT, Math.max(1, Math.floor(n))) : fallback;
};

/** True when the player's device asks for less animation. Read on every frame
    from the game loop, so it must stay a plain function - no React state. */
export const prefersReducedMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/** 'system' means "whatever the device says"; a stored boolean is a choice the
    player made in Settings and always wins over the device. */
export const isReducedMotion = (value: boolean | 'system' | undefined) =>
  value === true || (value !== false && prefersReducedMotion());

const LANG_CODES = ['en', 'sv', 'tr', 'es', 'ar'];

/** Old saves predate these three switches; fall back to the friendly default
    instead of crashing on `undefined` deep inside the game loop. */
const clampVolume = (v: number, fallback = 50) => (Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : fallback);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const finiteNumber = (value: unknown, fallback: number) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const cleanStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
    : [];

type Quest = PlayerProgress['dailyQuests'][number];
const cleanQuestList = (value: unknown, fallback: Quest[]): Quest[] => {
  if (!Array.isArray(value)) return fallback.map((quest) => ({ ...quest }));
  const quests = value.map((item): Quest | null => {
    const raw = asRecord(item);
    if (typeof raw.id !== 'string' || !raw.id) return null;
    const template = fallback.find((quest) => quest.id === raw.id);
    const target = Math.max(1, Math.floor(finiteNumber(raw.target, template?.target || 1)));
    const current = Math.min(target, Math.max(0, Math.floor(finiteNumber(raw.current, 0))));
    return {
      id: raw.id,
      description: typeof raw.description === 'string' ? raw.description : template?.description || raw.id,
      target,
      current,
      reward: Math.max(0, Math.floor(finiteNumber(raw.reward, template?.reward || 0))),
      completed: raw.completed === true || current >= target,
      claimed: raw.claimed === true,
    };
  }).filter((quest): quest is Quest => quest !== null);
  return quests.length ? quests : fallback.map((quest) => ({ ...quest }));
};

const cleanSettings = (value: unknown): PlayerProgress['settings'] => {
  const raw = asRecord(value);
  const language = LANG_CODES.includes(String(raw.language))
    ? String(raw.language) as PlayerProgress['settings']['language']
    : defaultProgress.settings.language;
  const reduceMotion = raw.reduceMotion === true || raw.reduceMotion === false || raw.reduceMotion === 'system'
    ? raw.reduceMotion
    : defaultProgress.settings.reduceMotion;
  return {
    language,
    uiScale: Math.min(1.5, Math.max(0.75, finiteNumber(raw.uiScale, defaultProgress.settings.uiScale))),
    textScale: Math.min(2, Math.max(0.75, finiteNumber(raw.textScale, defaultProgress.settings.textScale))),
    colorBlindMode: raw.colorBlindMode === true,
    reduceMotion,
    debugOverlay: raw.debugOverlay === true,
    haptics: raw.haptics !== false,
    difficulty: raw.difficulty === 'easy' || raw.difficulty === 'hard' ? raw.difficulty : 'normal',
    autoQuality: raw.autoQuality !== false,
    cinematicEffects: raw.cinematicEffects !== false,
    adaptiveAudio: raw.adaptiveAudio !== false,
    leftHandedControls: raw.leftHandedControls === true,
    muted: raw.muted === true,
    musicVolume: clampVolume(finiteNumber(raw.musicVolume, defaultProgress.settings.musicVolume), defaultProgress.settings.musicVolume),
    sfxVolume: clampVolume(finiteNumber(raw.sfxVolume, defaultProgress.settings.sfxVolume), defaultProgress.settings.sfxVolume),
  };
};

const cleanStats = (value: unknown): PlayerProgress['stats'] => {
  const raw = asRecord(value);
  const nonNegative = (key: string) => Math.max(0, Math.floor(finiteNumber(raw[key], 0)));
  return {
    totalEnemiesDefeated: nonNegative('totalEnemiesDefeated'),
    totalFishCollected: nonNegative('totalFishCollected'),
    totalDeaths: nonNegative('totalDeaths'),
    perfectLevels: nonNegative('perfectLevels'),
    bestCombo: nonNegative('bestCombo'),
    bossesDefeated: nonNegative('bossesDefeated'),
    shadowPasses: nonNegative('shadowPasses'),
  };
};

export const PROGRESS_SCHEMA_VERSION = 3;

export const isProgressSaveCandidate = (value: unknown): boolean => {
  const outer = asRecord(value);
  const version = Math.floor(finiteNumber(outer.schemaVersion, 1));
  const source = asRecord(version >= 3 && outer.data ? outer.data : value);
  return ['coins', 'xp', 'settings', 'upgrades', 'dailySeed', 'campaignLevel'].some((key) => key in source);
};

/**
 * Migrate and validate every value crossing the save boundary. Older releases
 * stored a plain progress object, while schema 3 adds an explicit version
 * marker. The optional `{ schemaVersion, data }` envelope is also accepted so
 * imported backups from experiments cannot inject arbitrary top-level fields.
 */
export const normalizeProgressSave = (value: unknown): PlayerProgress => {
  const outer = asRecord(value);
  const version = Math.floor(finiteNumber(outer.schemaVersion, 1));
  const source = asRecord(version >= 3 && outer.data ? outer.data : value);
  const rescuedCats = cleanRescues(source.rescuedCats);
  const unlockedSkins = cleanStringList(source.unlockedSkins);
  if (!unlockedSkins.includes('default')) unlockedSkins.unshift('default');
  const equippedSkin = typeof source.equippedSkin === 'string' && unlockedSkins.includes(source.equippedSkin)
    ? source.equippedSkin
    : 'default';
  const upgrades = asRecord(source.upgrades);
  const campaignLevel = source.campaignLevel === undefined && version < 3
    ? readLegacyCheckpoint()
    : clampCampaignLevel(source.campaignLevel);

  return {
    coins: Math.max(0, Math.floor(finiteNumber(source.coins, 0))),
    totalCoinsEarned: Math.max(0, Math.floor(finiteNumber(source.totalCoinsEarned, 0))),
    xp: Math.max(0, Math.floor(finiteNumber(source.xp, 0))),
    level: Math.max(1, Math.floor(finiteNumber(source.level, 1))),
    campaignLevel,
    shadowSecrets: cleanSecrets(source.shadowSecrets),
    rescuedCats,
    equippedCompanion: getCompanionById(source.equippedCompanion, rescuedCats)?.id || null,
    claimedCatQuests: cleanCatQuestClaims(source.claimedCatQuests),
    hideoutDecor: cleanDecor(source.hideoutDecor, rescuedCats.length),
    unlockedSkins,
    equippedSkin,
    upgrades: {
      maxAmmo: Math.max(1, Math.floor(finiteNumber(upgrades.maxAmmo, defaultProgress.upgrades.maxAmmo))),
      jumpPower: Math.max(1, finiteNumber(upgrades.jumpPower, defaultProgress.upgrades.jumpPower)),
      speed: Math.max(1, finiteNumber(upgrades.speed, defaultProgress.upgrades.speed)),
    },
    achievements: cleanStringList(source.achievements),
    dailyQuests: cleanQuestList(source.dailyQuests, defaultProgress.dailyQuests),
    weeklyQuests: cleanQuestList(source.weeklyQuests, defaultProgress.weeklyQuests),
    dailySeed: typeof source.dailySeed === 'string' && source.dailySeed ? source.dailySeed : defaultProgress.dailySeed,
    weeklySeed: typeof source.weeklySeed === 'string' && source.weeklySeed ? source.weeklySeed : defaultProgress.weeklySeed,
    settings: cleanSettings(migrateLegacyAudio(cleanSettings(source.settings))),
    stats: cleanStats(source.stats),
  };
};

export const ProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<PlayerProgress>(() => {
    // Prefer a structurally valid primary save, then the last known good backup,
    // then the pre-versioned file. A syntactically valid `[]` must not hide a
    // recoverable backup.
    const saved = [
      readUnknownJson(STORAGE_KEY),
      readUnknownJson(STORAGE_BACKUP_KEY),
      readUnknownJson('shadow_paw_progress_v1'),
    ].find(isProgressSaveCandidate);
    return saved === undefined ? defaultProgress : normalizeProgressSave(saved);
  });

  useEffect(() => {
    writeJsonWithBackup(STORAGE_KEY, STORAGE_BACKUP_KEY, {
      ...progress,
      schemaVersion: PROGRESS_SCHEMA_VERSION,
    });
  }, [progress]);

  useEffect(() => {
    const today = getTodaySeed();
    const week = getWeekSeed();
    setProgress((p) => {
      const mustResetDaily = p.dailySeed !== today;
      const mustResetWeekly = p.weeklySeed !== week;
      let weeklyQuests = mustResetWeekly ? createWeeklyQuests(week) : (p.weeklyQuests.some((q) => q.id.startsWith('w')) ? p.weeklyQuests : createWeeklyQuests(week));
      if (!weeklyQuests.some((q) => q.id === 'w3')) {
        const w3 = createWeeklyQuests(week).find((q) => q.id === 'w3');
        if (w3) weeklyQuests = [...weeklyQuests, w3];
      }
      return {
        ...p,
        dailySeed: today,
        weeklySeed: week,
        dailyQuests: mustResetDaily ? createDailyQuests(today) : (p.dailyQuests.some((q) => q.id.startsWith('d')) ? p.dailyQuests : createDailyQuests(today)),
        weeklyQuests,
      };
    });
  }, []);

  const claimCatQuest = (id: string) => setProgress(p => applyCatQuest(p, id));

  const rescueCat = (level: number) => {
    setProgress(p => {
      const rescuedCats = cleanRescues([...p.rescuedCats, level]);
      return rescuedCats.length === p.rescuedCats.length ? p : { ...p, rescuedCats };
    });
  };

  const equipCompanion = (id: string | null) => {
    setProgress(p => {
      if (id === null) return p.equippedCompanion === null ? p : { ...p, equippedCompanion: null };
      const companion = getCompanionById(id, p.rescuedCats);
      if (!companion || p.equippedCompanion === companion.id) return p;
      return { ...p, equippedCompanion: companion.id };
    });
  };

  const setHideoutDecor = (decor: HideoutDecor) => {
    setProgress(p => ({ ...p, hideoutDecor: cleanDecor(decor, p.rescuedCats.length) }));
  };

  const collectShadowSecret = (level: number) => {
    setProgress(p => {
      const shadowSecrets = cleanSecrets([...p.shadowSecrets, level]);
      if (shadowSecrets.length === p.shadowSecrets.length) return p;
      const unlockedSkins = shadowSecrets.length >= SECRET_REWARD_COUNT && !p.unlockedSkins.includes('eclipse')
        ? [...p.unlockedSkins, 'eclipse'] : p.unlockedSkins;
      return { ...p, shadowSecrets, unlockedSkins };
    });
  };

  const addCoins = (amount: number) => {
    setProgress(p => ({
      ...p,
      coins: p.coins + amount,
      totalCoinsEarned: p.totalCoinsEarned + amount,
    }));
  };

  const addXP = (amount: number) => {
    setProgress(p => {
      const newXP = p.xp + amount;
      const newLevel = Math.floor(newXP / 1000) + 1;
      return {
        ...p,
        xp: newXP,
        level: newLevel > p.level ? newLevel : p.level,
      };
    });
  };

  const completeQuest = (questId: string) => {
    setProgress(p => ({
      ...p,
      dailyQuests: p.dailyQuests.map(q =>
        q.id === questId && !q.completed ? { ...q, completed: true } : q
      ),
    }));
  };

  const updateQuestProgress = (questId: string, increment: number) => {
    setProgress(p => ({
      ...p,
      dailyQuests: p.dailyQuests.map(q => {
        if (q.id !== questId || q.completed) return q;
        const newCurrent = q.current + increment;
        if (newCurrent >= q.target) {
          return { ...q, current: q.target, completed: true };
        }
        return { ...q, current: newCurrent };
      }),
    }));
  };

  const buyUpgrade = (type: 'maxAmmo' | 'jumpPower' | 'speed', cost: number): boolean => {
    if (progress.coins < cost) return false;
    
    setProgress(p => {
      // Checked again inside the updater: two clicks in the same tick used to
      // pass the outer check twice and buy the upgrade on credit.
      if (p.coins < cost) return p;
      return {
        ...p,
        coins: p.coins - cost,
        upgrades: {
          ...p.upgrades,
          [type]: p.upgrades[type] + (type === 'maxAmmo' ? 1 : 0.5),
        },
      };
    });
    return true;
  };

  const equipSkin = (skinId: string) => {
    if (progress.unlockedSkins.includes(skinId)) {
      setProgress(p => ({ ...p, equippedSkin: skinId }));
    }
  };

  const resetDailyQuests = () => {
    setProgress(p => ({
      ...p,
      dailyQuests: createDailyQuests(getTodaySeed()),
      weeklyQuests: createWeeklyQuests(getWeekSeed()),
      dailySeed: getTodaySeed(),
      weeklySeed: getWeekSeed(),
    }));
  };

  const claimQuestReward = (questId: string) => {
    setProgress(p => {
      const quest = [...p.dailyQuests, ...p.weeklyQuests].find(q => q.id === questId);
      if (!quest || !quest.completed || quest.claimed) return p;
      return {
        ...p,
        coins: p.coins + quest.reward,
        totalCoinsEarned: p.totalCoinsEarned + quest.reward,
        dailyQuests: p.dailyQuests.map(q =>
          q.id === questId ? { ...q, claimed: true } : q
        ),
        weeklyQuests: p.weeklyQuests.map(q =>
          q.id === questId ? { ...q, claimed: true } : q
        ),
      };
    });
  };

  const updateSettings = (updates: Partial<PlayerProgress['settings']>) => {
    setProgress((p) => ({ ...p, settings: { ...p.settings, ...updates } }));
  };

  const setMuted = (muted: boolean) => {
    setProgress((p) => (p.settings.muted === muted ? p : { ...p, settings: { ...p.settings, muted } }));
  };

  const toggleMuted = () => {
    setProgress((p) => ({ ...p, settings: { ...p.settings, muted: !p.settings.muted } }));
  };

  const updateStats = (updates: Partial<PlayerProgress['stats']>) => {
    setProgress((p) => ({ ...p, stats: { ...p.stats, ...updates } }));
  };

  const advanceCampaign = (reachedLevel: number, runStartLevel: number) => {
    setProgress((p) => {
      if (runStartLevel > p.campaignLevel) return p;
      const next = clampCampaignLevel(reachedLevel, p.campaignLevel);
      return next > p.campaignLevel ? { ...p, campaignLevel: next } : p;
    });
  };

  const unlockAchievement = (achievementId: string) => {
    setProgress((p) => {
      if (p.achievements.includes(achievementId)) return p;
      return { ...p, achievements: [...p.achievements, achievementId] };
    });
  };

  const unlockSkin = (skinId: string) => {
    setProgress((p) => {
      if (p.unlockedSkins.includes(skinId)) return p;
      return { ...p, unlockedSkins: [...p.unlockedSkins, skinId] };
    });
  };

  const applyRunResults = (results: {
    fishesCollected: number;
    enemiesDefeated: number;
    levelsCompleted: number;
    perfectLevel: boolean;
    bestCombo: number;
    bossDefeated: boolean;
    deaths: number;
    shadowPasses?: number;
  }) => {
    setProgress((p) => {
      const daily = p.dailyQuests.map((q) => {
        if (q.id === 'd1') {
          const current = Math.min(q.target, q.current + results.fishesCollected);
          return { ...q, current, completed: current >= q.target };
        }
        if (q.id === 'd2') {
          const current = Math.min(q.target, q.current + results.enemiesDefeated);
          return { ...q, current, completed: current >= q.target };
        }
        if (q.id === 'd3') {
          const current = Math.min(q.target, q.current + results.levelsCompleted);
          return { ...q, current, completed: current >= q.target };
        }
        return q;
      });

      const weekly = p.weeklyQuests.map((q) => {
        if (q.id === 'w1') {
          const current = Math.min(q.target, q.current + results.fishesCollected);
          return { ...q, current, completed: current >= q.target };
        }
        if (q.id === 'w2') {
          const current = Math.min(q.target, q.current + results.enemiesDefeated);
          return { ...q, current, completed: current >= q.target };
        }
        if (q.id === 'w3') {
          const current = Math.min(q.target, q.current + (results.shadowPasses || 0));
          return { ...q, current, completed: current >= q.target };
        }
        return q;
      });

      return {
        ...p,
        dailyQuests: daily,
        weeklyQuests: weekly,
        stats: {
          ...p.stats,
          totalFishCollected: p.stats.totalFishCollected + results.fishesCollected,
          totalEnemiesDefeated: p.stats.totalEnemiesDefeated + results.enemiesDefeated,
          totalDeaths: p.stats.totalDeaths + results.deaths,
          perfectLevels: p.stats.perfectLevels + (results.perfectLevel ? 1 : 0),
          bestCombo: Math.max(p.stats.bestCombo, results.bestCombo),
          bossesDefeated: p.stats.bossesDefeated + (results.bossDefeated ? 1 : 0),
          shadowPasses: (p.stats.shadowPasses || 0) + (results.shadowPasses || 0),
        },
      };
    });
  };

  const exportProgressCode = () => {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify({ ...progress, schemaVersion: PROGRESS_SCHEMA_VERSION }))));
    } catch {
      return '';
    }
  };

  const importProgressCode = (encoded: string) => {
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(encoded.trim()))));
      if (!isProgressSaveCandidate(parsed)) return false;
      setProgress(normalizeProgressSave(parsed));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <ProgressContext.Provider value={{
      progress,
      addCoins,
      addXP,
      completeQuest,
      updateQuestProgress,
      buyUpgrade,
      equipSkin,
      resetDailyQuests,
      claimQuestReward,
      updateSettings,
      setMuted,
      toggleMuted,
      updateStats,
      advanceCampaign,
      unlockAchievement,
      unlockSkin,
      collectShadowSecret,
      rescueCat,
      equipCompanion,
      claimCatQuest,
      setHideoutDecor,
      applyRunResults,
      exportProgressCode,
      importProgressCode,
    }}>
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used within ProgressProvider');
  return context;
};
