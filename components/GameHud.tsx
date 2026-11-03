/**
 * HUD modules extracted from the gameplay view. They receive a plain stats
 * snapshot and no game object, so they can be rendered and tested on their own.
 */
import React from 'react';
import { useT } from '../i18n';
import type { HudStats } from '../game/types';

/** Shadow Shift meter doubles as the touch button: the rest of the HUD is
    pointer-transparent, so one chip serves keyboard, mouse and phone. */
export const ShadowShiftMeter: React.FC<{
  stats: HudStats;
  isTouchDevice: boolean;
  onTrigger: () => void;
}> = ({ stats, isTouchDevice, onTrigger }) => {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onTrigger}
      disabled={stats.shadowCharge < 100 && stats.shadowActive <= 0}
      aria-label={t('Skuggskifte')}
      title={t('Skuggskifte: ladda med fisk, fiender och nästan-träffar · E')}
      className={`hud-chip pointer-events-auto relative overflow-hidden transition-colors ${
        stats.shadowActive > 0
          ? 'border-[#c084fc]/70 bg-[#a855f7]/20 text-[#e9d5ff]'
          : stats.shadowCharge >= 100
            ? 'animate-pulse border-[#c084fc]/60 bg-[#a855f7]/10 text-[#d8b4fe]'
            : 'border-white/10 text-white/45'
      } ${isTouchDevice ? 'px-3 py-1.5' : ''}`}
    >
      <span className="material-symbols-outlined text-[14px]">dark_mode</span>
      <span className="text-[9px] font-black uppercase tracking-wider">
        {stats.shadowActive > 0
          ? t('Skugga {n}s', { n: Math.ceil(stats.shadowActive / 60) })
          : t('SKIFT')}
      </span>
      {stats.shadowActive === 0 && (
        <span className="tabular text-[9px] font-black opacity-75">{Math.floor(stats.shadowCharge)}%</span>
      )}
      <span
        className="absolute inset-x-0 bottom-0 h-[2px] bg-[#c084fc] transition-[width] duration-150"
        style={{
          width: `${stats.shadowActive > 0 ? (stats.shadowActive / 240) * 100 : stats.shadowCharge}%`,
        }}
      />
    </button>
  );
};

/** One always-current sentence that tells the player what to do next, so a run
    never stalls on a full fish counter. */
export const ObjectivePill: React.FC<{ stats: HudStats }> = ({ stats }) => {
  const t = useT();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-2">
      <div className="hud-panel flex items-center gap-2 px-3 py-1.5">
        <span className="material-symbols-outlined text-[15px] text-primary">
          {stats.bossHp > 0 ? 'swords' : stats.collectedCount >= stats.fishGoal ? 'near_me' : stats.fishDir < 0 ? 'keyboard_backspace' : 'set_meal'}
        </span>
        <span className="max-w-[60vw] truncate text-[10px] font-black uppercase tracking-[0.14em] text-white/80">
          {stats.bossHp > 0
            ? t('Besegra {name}', { name: stats.bossName || t('bossen') })
            : stats.collectedCount >= stats.fishGoal
              ? t('Spring till Jerry · {n} m', { n: stats.goalDist })
              : t('Samla {n} fiskar till', { n: Math.max(0, stats.fishGoal - stats.collectedCount) })}
        </span>
        {stats.collectedCount >= stats.fishGoal && (
          <span className="tabular rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-black text-primary">{t('MÅL')}</span>
        )}
      </div>
    </div>
  );
};
