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

/** The boss panel is kept outside the game loop so combat feedback can evolve
    without making the 9k-line gameplay view harder to reason about. */
export const BossHud: React.FC<{ stats: HudStats }> = ({ stats }) => {
  const t = useT();
  if (!stats.bossVisible || stats.bossHp <= 0 || stats.bossMaxHp <= 0) return null;

  return (
    <div className="pointer-events-none absolute top-[86px] left-1/2 z-20 w-full max-w-xs -translate-x-1/2 px-3 md:top-[96px]">
      <div
        className="rounded-xl border border-red-500/40 bg-black/80 px-3 py-2 text-center backdrop-blur-md"
        style={{ boxShadow: '0 0 24px rgba(255,50,30,0.4)' }}
      >
        <p className={`mb-1 text-[10px] font-black uppercase tracking-widest ${
          stats.bossAngry ? 'text-rose-300' : stats.bossPhase >= 2 ? 'text-pink-400' : stats.bossPhase === 1 ? 'text-red-400' : 'text-orange-400'
        }`}>
          {stats.bossAngry ? '😡' : '⚔️'} {stats.bossAngry
            ? t('{name} är arg! – FAS {n}', { name: stats.bossName || t('BOSS'), n: (stats.bossPhase || 0) + 1 })
            : t('{name} – FAS {n}', { name: stats.bossName || t('BOSS'), n: (stats.bossPhase || 0) + 1 })}
        </p>
        <div className="h-3 w-full overflow-hidden rounded-full border border-white/10 bg-black/50">
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{
              width: `${Math.max(0, (stats.bossHp / Math.max(1, stats.bossMaxHp)) * 100)}%`,
              background: stats.bossPhase >= 2
                ? 'linear-gradient(90deg, #aa00aa, #ff00ff)'
                : stats.bossPhase === 1
                  ? 'linear-gradient(90deg, #880000, #ff2222)'
                  : 'linear-gradient(90deg, #882200, #ff6b35)',
              boxShadow: stats.bossPhase >= 2
                ? '0 0 12px rgba(255,0,255,0.8)'
                : '0 0 12px rgba(255,80,20,0.8)',
            }}
          />
        </div>
        <p className="mt-0.5 text-[9px] font-bold tabular-nums text-white/50">
          {stats.bossHp} / {stats.bossMaxHp}
        </p>
        {stats.bossCoreExposed && stats.bossCoreExposed > 0 ? (
          <p className="mt-1 animate-pulse rounded-md border border-yellow-300/40 bg-yellow-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-yellow-100">
            {t('KÄRNAN BLOTTAD · DUBBEL SKADA')}
          </p>
        ) : stats.bossTelegraph && stats.bossTelegraph > 0 ? (
          <p className="mt-1 rounded-md border border-orange-300/40 bg-orange-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-orange-100">
            {t('VARNING · {m}', { m: t(stats.bossCounterHint || 'HÅLL DIG I RÖRELSE') })}
          </p>
        ) : null}
      </div>
    </div>
  );
};

/** One always-current sentence that tells the player what to do next, so a run
    never stalls on a full fish counter. */
export const ObjectivePill: React.FC<{ stats: HudStats }> = ({ stats }) => {
  const t = useT();
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-2">
      <div className="hud-panel flex items-center gap-2 px-3 py-1.5">
        <span className="material-symbols-outlined text-[15px] text-primary">
          {stats.bossHp > 0 ? 'swords' : stats.collectedCount >= stats.fishGoal ? 'near_me' : stats.fishDir < 0 ? 'keyboard_backspace' : 'set_meal'}
        </span>
        <span className="max-w-[60vw] truncate text-[10px] font-black uppercase tracking-[0.14em] text-white/80">
          {stats.bossHp > 0
            ? stats.bossAngry
              ? t('{name} är arg!', { name: stats.bossName || t('bossen') })
              : t('Besegra {name}', { name: stats.bossName || t('bossen') })
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
