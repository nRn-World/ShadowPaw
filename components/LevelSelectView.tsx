import React from 'react';
import { useProgress } from '../context/ProgressContext';
import { useT } from '../i18n';

/**
 * Chapter map for the campaign.
 *
 * The start screen could only ever offer "continue" or a random daily level, so
 * a player who wanted to replay a favourite stage, or see how far they had come,
 * had no way in. This screen lists all 40 story levels grouped into eight
 * chapters, marks the checkpoint, and starts any cleared level directly.
 *
 * It reads `campaignLevel` only - no extra save state - because that value
 * already means "the next level that is unlocked".
 */

const LEVELS_PER_CHAPTER = 5;

const CHAPTERS: { name: string; tint: string }[] = [
  { name: 'PARKEN', tint: 'from-emerald-400/20' },
  { name: 'REGZONEN', tint: 'from-sky-400/20' },
  { name: 'NEONKVARTEREN', tint: 'from-fuchsia-400/20' },
  { name: 'HAMNEN', tint: 'from-cyan-400/20' },
  { name: 'SKYLINE', tint: 'from-indigo-400/20' },
  { name: 'UNDERJORDEN', tint: 'from-amber-400/20' },
  { name: 'FABRIKEN', tint: 'from-orange-400/20' },
  { name: 'SKUGGTORNET', tint: 'from-rose-400/20' },
];

const TOTAL_LEVELS = CHAPTERS.length * LEVELS_PER_CHAPTER;

const LevelSelectView: React.FC<{
  onBack: () => void;
  onStart: (level: number) => void;
}> = ({ onBack, onStart }) => {
  const { progress } = useProgress();
  const t = useT();

  // Beyond the last chapter the campaign is simply complete; never show a
  // "next level 47" tile that does not exist on the map.
  const clearedThrough = Math.min(TOTAL_LEVELS, Math.max(0, progress.campaignLevel - 1));
  const nextLevel = Math.min(TOTAL_LEVELS, Math.max(1, progress.campaignLevel));
  const percent = Math.round((clearedThrough / TOTAL_LEVELS) * 100);
  const allCleared = clearedThrough >= TOTAL_LEVELS;

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-in-up px-4 py-6 md:py-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/40 transition-colors hover:text-white/80"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            {t('Tillbaka till menyn')}
          </button>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
            {t('Kapitel')}
          </h1>
          <p className="mt-1 text-sm text-white/45">
            {t('{a} av {b} nivåer klara', { a: clearedThrough, b: TOTAL_LEVELS })}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            onClick={() => onStart(nextLevel)}
            className="btn-primary px-6 py-3 text-sm"
          >
            <span className="material-symbols-outlined text-lg">
              {allCleared ? 'replay' : 'play_arrow'}
            </span>
            {allCleared
              ? t('Spela om sista nivån')
              : t('Fortsätt · nivå {n}', { n: nextLevel })}
          </button>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-[width] duration-500"
                style={{ width: `${Math.max(2, percent)}%` }}
              />
            </div>
            <span className="tabular text-[10px] font-black text-primary">{percent}%</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {CHAPTERS.map((chapter, chapterIndex) => {
          const firstLevel = chapterIndex * LEVELS_PER_CHAPTER + 1;
          const levels = Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => firstLevel + i);
          const chapterCleared = levels.filter((n) => n <= clearedThrough).length;
          const chapterDone = chapterCleared === LEVELS_PER_CHAPTER;
          const chapterLocked = firstLevel > nextLevel;

          return (
            <section
              key={chapter.name}
              aria-label={`${t('Kapitel')} ${chapterIndex + 1}: ${t(chapter.name)}`}
              className={`card-premium relative overflow-hidden p-4 transition-opacity ${
                chapterLocked ? 'opacity-55' : ''
              }`}
            >
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${chapter.tint} to-transparent`}
                aria-hidden="true"
              />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`tabular flex size-9 shrink-0 items-center justify-center rounded-xl border text-xs font-black ${
                      chapterDone
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-white/10 bg-white/[0.04] text-white/45'
                    }`}
                  >
                    {String(chapterIndex + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-black uppercase tracking-[0.1em] text-white">
                      {t(chapter.name)}
                    </h2>
                    <p className="truncate text-[10px] font-bold uppercase tracking-wider text-white/30">
                      {t('{a}/{b} klart', { a: chapterCleared, b: LEVELS_PER_CHAPTER })}
                    </p>
                  </div>
                </div>
                {chapterDone ? (
                  <span className="material-symbols-outlined text-lg text-primary" aria-label={t('Klart')}>
                    verified
                  </span>
                ) : chapterLocked ? (
                  <span className="material-symbols-outlined text-lg text-white/25" aria-hidden="true">
                    lock
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/80">
                    {t('Pågår')}
                  </span>
                )}
              </div>

              <div className="relative mt-3 grid grid-cols-5 gap-1.5">
                {levels.map((level) => {
                  const cleared = level <= clearedThrough;
                  const next = level === nextLevel && !allCleared;
                  const locked = !cleared && !next;
                  const isBoss = level % LEVELS_PER_CHAPTER === 0;

                  return (
                    <button
                      key={level}
                      onClick={() => onStart(level)}
                      disabled={locked}
                      aria-label={
                        locked
                          ? t('Nivå {n} · låst', { n: level })
                          : t('Spela nivå {n}', { n: level })
                      }
                      title={
                        locked
                          ? t('Klara nivå {n} först', { n: level - 1 })
                          : t('Spela nivå {n}', { n: level })
                      }
                      className={`group relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-black transition-all duration-150 ${
                        next
                          ? 'border-primary bg-primary text-[#06210f] shadow-[0_0_22px_-6px_rgba(43,238,121,0.9)] hover:brightness-110'
                          : cleared
                            ? 'border-primary/30 bg-primary/[0.08] text-primary hover:border-primary/60 hover:bg-primary/15'
                            : 'cursor-not-allowed border-white/[0.07] bg-white/[0.025] text-white/25'
                      }`}
                    >
                      {next && (
                        <span
                          className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary/30"
                          aria-hidden="true"
                        />
                      )}
                      <span className="tabular leading-none">{level}</span>
                      <span className="flex h-3 items-center gap-0.5">
                        {locked ? (
                          <span className="material-symbols-outlined text-[11px]" aria-hidden="true">
                            lock
                          </span>
                        ) : isBoss ? (
                          <span className="material-symbols-outlined text-[11px]" aria-hidden="true">
                            swords
                          </span>
                        ) : cleared ? (
                          <span className="material-symbols-outlined text-[11px]" aria-hidden="true">
                            check
                          </span>
                        ) : (
                          <span className="text-[8px] font-black uppercase tracking-wider">
                            {t('Nästa')}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
        {t('Var femte nivå är en boss. Klara en nivå för att låsa upp nästa.')}
      </p>
    </div>
  );
};

export default LevelSelectView;
