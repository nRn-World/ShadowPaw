import React from 'react';
import { useProgress } from '../context/ProgressContext';
import { useT } from '../i18n';
import { getLevelDesign } from '../game/level';

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

/** Chapter titles follow the places their five stages actually visit, so the
    map never promises "Neon Blocks" and then shows a forest. The names are the
    same strings the level card and HUD use. */
const CHAPTERS: { name: string; tagline: string; tint: string }[] = [
  { name: 'PARKEN', tagline: 'Gröna ängar och första steget', tint: 'from-emerald-400/25' },
  { name: 'REGZONEN', tagline: 'Vått, kallt och brant', tint: 'from-sky-400/25' },
  { name: 'NEONKVARTEREN', tagline: 'Stad, tak och byggen', tint: 'from-fuchsia-400/25' },
  { name: 'HAMNEN', tagline: 'Is, kraft och glömda kvarter', tint: 'from-cyan-400/25' },
  { name: 'SKYLINE', tagline: 'Rymd, vulkan och himmelsbroar', tint: 'from-indigo-400/25' },
  { name: 'UNDERJORDEN', tagline: 'Laboratorier och krigszoner', tint: 'from-amber-400/25' },
  { name: 'FABRIKEN', tagline: 'Heta, mörka och kaotiska trakter', tint: 'from-orange-400/25' },
  { name: 'SKUGGTORNET', tagline: 'Återstoden av allt', tint: 'from-rose-400/25' },
];

const TOTAL_LEVELS = CHAPTERS.length * LEVELS_PER_CHAPTER;

/** A picture per stage theme, so the map reads as a journey through places
    instead of forty identical numbers. Matches the world the stage actually
    draws (see getLevelDesign). */
const THEME_ICONS: Record<string, string> = {
  park: 'park',
  suburban: 'holiday_village',
  city: 'apartment',
  downtown: 'location_city',
  industrial: 'factory',
  construction: 'engineering',
  beach: 'beach_access',
  mountain: 'landscape',
  forest: 'forest',
  harbor: 'directions_boat',
  sewers: 'water',
  alpine: 'downhill_skiing',
  rooftops: 'roofing',
  countryside: 'agriculture',
  ice_cave: 'ac_unit',
  glacier: 'ac_unit',
  arctic_base: 'severe_cold',
  power_plant: 'bolt',
  nuclear: 'radioactive',
  datacenter: 'dns',
  laboratory: 'science',
  quantum: 'blur_on',
  abandoned: 'domain_disabled',
  highway: 'add_road',
  warzone: 'local_fire_department',
  underground: 'landslide',
  sky_bridge: 'air',
  space_station: 'rocket_launch',
  volcano: 'volcano',
  hell: 'local_fire_department',
  inferno: 'whatshot',
  hades: 'skull',
  tartarus: 'skull',
  void: 'brightness_empty',
  abyss: 'waves',
  oblivion: 'visibility_off',
  nightmare: 'nightlight',
  chaos: 'cyclone',
  pandemonium: 'grain',
  apocalypse: 'thunderstorm',
  armageddon: 'thunderstorm',
  titan: 'landscape',
  nexus: 'hub',
  omega: 'hexagon',
  infinity: 'all_inclusive',
  transcendence: 'flare',
  enlightenment: 'light_mode',
  ascension: 'north',
  legendary: 'military_tech',
};

const iconForLevel = (level: number) => THEME_ICONS[getLevelDesign(level).theme] ?? 'flag';

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
            className="mb-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/45 transition-colors hover:text-white/85"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            {t('Tillbaka till menyn')}
          </button>
          <h1 className="toon-title font-display text-3xl font-black uppercase tracking-tight md:text-5xl">
            {t('Kapitel')}
          </h1>
          <p className="mt-1.5 text-sm font-bold text-white/60">
            {t('{a} av {b} nivåer klara', { a: clearedThrough, b: TOTAL_LEVELS })}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            onClick={() => onStart(nextLevel)}
            className="toon-btn toon-btn-green px-6 py-3 text-sm uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-lg">
              {allCleared ? 'replay' : 'play_arrow'}
            </span>
            {allCleared
              ? t('Spela om sista nivån')
              : t('Fortsätt · nivå {n}', { n: nextLevel })}
          </button>
          <div className="flex items-center gap-2">
            <div className="toon-bar w-40">
              <span style={{ width: `${Math.max(2, percent)}%` }} />
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
              className={`toon-card relative overflow-hidden p-4 transition-opacity ${
                chapterLocked ? 'opacity-70' : ''
              }`}
            >
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${chapter.tint} to-transparent`}
                aria-hidden="true"
              />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`tabular flex size-9 shrink-0 items-center justify-center rounded-xl border-2 text-xs font-black ${
                      chapterDone
                        ? 'border-[#0c3a20] bg-[#22cf66] text-[#06210f] shadow-[0_3px_0_0_#0c3a20]'
                        : 'border-[#12182b] bg-white text-[#12182b] shadow-[0_2px_0_0_#12182b]'
                    }`}
                  >
                    {String(chapterIndex + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-black uppercase tracking-[0.1em] text-[#12182b]">
                      {t(chapter.name)}
                    </h2>
                    <p className="truncate text-[10px] font-bold text-[#12182b]/55">
                      {t(chapter.tagline)}
                    </p>
                    <p className="truncate text-[9px] font-black uppercase tracking-wider text-[#12182b]/35">
                      {t('{a}/{b} klart', { a: chapterCleared, b: LEVELS_PER_CHAPTER })}
                    </p>
                  </div>
                </div>
                {chapterDone ? (
                  <span className="material-symbols-outlined text-lg text-[#16a34a]" aria-label={t('Klart')}>
                    verified
                  </span>
                ) : chapterLocked ? (
                  <span className="material-symbols-outlined text-lg text-[#12182b]/30" aria-hidden="true">
                    lock
                  </span>
                ) : (
                  <span className="rounded-full border-2 border-[#0c3a20] bg-[#8ff5b6] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#0c3a20]">
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
                      className={`group relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-sm font-black transition-all duration-150 ${
                        next
                          ? 'border-[#0c3a20] bg-gradient-to-b from-[#5cfa9e] to-[#22cf66] text-[#06210f] shadow-[0_4px_0_0_#0c3a20] hover:-translate-y-0.5'
                          : cleared
                            ? 'border-[#0c3a20] bg-[#c9fbd9] text-[#0c3a20] shadow-[0_3px_0_0_#0c3a20] hover:bg-[#b4f8ca]'
                            : 'cursor-not-allowed border-[#12182b]/25 bg-[#12182b]/[0.06] text-[#12182b]/30'
                      }`}
                    >
                      {next && (
                        <span
                          className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary/30"
                          aria-hidden="true"
                        />
                      )}
                      <span className="tabular leading-none">{level}</span>
                      <span className="flex h-3.5 items-center gap-0.5 opacity-80">
                        {locked ? (
                          <span className="material-symbols-outlined text-[11px]" aria-hidden="true">
                            lock
                          </span>
                        ) : isBoss ? (
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                            swords
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                            {iconForLevel(level)}
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

      <p className="mt-5 text-center text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
        {t('Var femte nivå är en boss. Klara en nivå för att låsa upp nästa.')}
      </p>
    </div>
  );
};

export default LevelSelectView;
