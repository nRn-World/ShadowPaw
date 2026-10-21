import React, { useEffect, useRef, useState } from 'react';
import { STRINGS } from './i18nStrings';
import { useProgress } from './context/ProgressContext';

export type Lang = 'en' | 'sv' | 'tr' | 'es' | 'ar';

export const LANGUAGES: { code: Lang; name: string; short: string }[] = [
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'sv', name: 'Svenska', short: 'SV' },
  { code: 'tr', name: 'Türkçe', short: 'TR' },
  { code: 'es', name: 'Español', short: 'ES' },
  { code: 'ar', name: 'العربية', short: 'AR' },
];

const INDEX: Record<Lang, number> = { sv: 0, en: 1, tr: 2, es: 3, ar: 4 };
const TABLE = new Map(STRINGS.map((row) => [row[0], row]));

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && v in INDEX;

// Module-level so non-React code (the game loop's toasts) translates too.
let current: Lang = 'en';
export const setLang = (lang: Lang) => {
  current = lang;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
};

/** Translate a Swedish source string; `{x}` placeholders are filled from vars. */
export const tr = (sv: string, vars?: Record<string, string | number>): string => {
  const row = TABLE.get(sv);
  let out = row && current !== 'sv' ? row[INDEX[current]] : sv;
  if (vars) for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
};

/** Subscribes the component to language changes and returns tr. */
export const useT = () => {
  const { progress } = useProgress();
  setLang(progress.settings.language);
  return tr;
};

/** Renders `<b>word</b>` in a translation as an emphasised span. */
export const renderRich = (text: string, strongClass: string): React.ReactNode =>
  text.split(/(<b>.*?<\/b>)/g).map((part, i) =>
    part.startsWith('<b>') ? (
      <strong key={i} className={strongClass}>{part.slice(3, -4)}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );

const starPoints = (cx: number, cy: number, radius: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.4;
    return `${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');

/** Hand-drawn flags: nothing is fetched and they look the same everywhere. Arabic uses the UAE flag. */
export const Flag: React.FC<{ code: Lang; className?: string }> = ({ code, className = 'h-4 w-6' }) => {
  const common = { viewBox: '0 0 24 16', className: `${className} shrink-0 rounded-[2px]`, 'aria-hidden': true } as const;
  switch (code) {
    case 'sv':
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#006AA7" />
          <rect x="7" width="3.2" height="16" fill="#FECC00" />
          <rect y="6.4" width="24" height="3.2" fill="#FECC00" />
        </svg>
      );
    case 'tr':
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#E30A17" />
          <circle cx="9" cy="8" r="4.2" fill="#fff" />
          <circle cx="10.2" cy="8" r="3.4" fill="#E30A17" />
          <polygon points={starPoints(14.2, 8, 2.3)} fill="#fff" />
        </svg>
      );
    case 'es':
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#AA151B" />
          <rect y="4" width="24" height="8" fill="#F1BF00" />
        </svg>
      );
    case 'ar':
      return (
        <svg {...common}>
          <rect width="24" height="5.34" fill="#00732F" />
          <rect y="5.33" width="24" height="5.34" fill="#fff" />
          <rect y="10.66" width="24" height="5.34" fill="#000" />
          <rect width="6.4" height="16" fill="#FF0000" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#012169" />
          <path d="M0 0L24 16M24 0L0 16" stroke="#fff" strokeWidth="3.2" />
          <path d="M0 0L24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.2" />
          <path d="M12 0V16M0 8H24" stroke="#fff" strokeWidth="5.4" />
          <path d="M12 0V16M0 8H24" stroke="#C8102E" strokeWidth="3.2" />
        </svg>
      );
  }
};

/** Flag + code button that opens a menu of every language, the current one ticked. */
export const LanguageSwitch: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { progress, updateSettings } = useProgress();
  const t = useT();
  const lang = progress.settings.language;
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={box} className={`relative ${className}`} dir="ltr">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('Språk')}: ${current.name}`}
        className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-black uppercase tracking-wider text-white/80 transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-white"
      >
        <Flag code={current.code} />
        <span>{current.short}</span>
        <span className={`material-symbols-outlined text-base opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t('Välj språk')}
          className="absolute right-0 top-[calc(100%+6px)] z-[200] min-w-[11rem] overflow-hidden rounded-xl border border-white/15 bg-[#080d19]/95 p-1 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
        >
          {LANGUAGES.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === lang}>
              <button
                type="button"
                onClick={() => {
                  updateSettings({ language: l.code });
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                  l.code === lang ? 'bg-primary/10 text-white' : 'text-white/75 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <Flag code={l.code} />
                <span className="flex-1">{l.name}</span>
                {l.code === lang && <span className="material-symbols-outlined text-base text-primary">check</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Flag grid for the settings screen. */
export const LanguageButtons: React.FC = () => {
  const { progress, updateSettings } = useProgress();
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={t('Språk')} dir="ltr">
      {LANGUAGES.map((l) => {
        const on = progress.settings.language === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => updateSettings({ language: l.code })}
            aria-pressed={on}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
              on ? 'border-primary/60 bg-primary/15 text-primary' : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white'
            }`}
          >
            <Flag code={l.code} />
            <span className="flex-1 text-left">{l.name}</span>
            {on && <span className="material-symbols-outlined text-base">check</span>}
          </button>
        );
      })}
    </div>
  );
};
