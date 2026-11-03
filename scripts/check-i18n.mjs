/**
 * Guards the translation table before deploy.
 *
 * i18nStrings.ts is just a TypeScript array literal, so it can be read as JSON
 * by stripping the wrapper. That keeps the check dependency-free and fast.
 *
 * Fails when:
 *  - a row does not have exactly five columns (sv, en, tr, es, ar)
 *  - a row has an empty translation for any language
 *  - a `{placeholder}` present in the Swedish source is missing from another
 *    language, which would leave a raw "Samla {n} fiskar" on screen
 *  - the same Swedish key appears twice (the first row silently wins)
 *  - the file is not valid UTF-8
 */
import { readFileSync } from 'node:fs';

const FILE = new URL('../i18nStrings.ts', import.meta.url);
const LANGS = ['sv', 'en', 'tr', 'es', 'ar'];

let source;
try {
  source = readFileSync(FILE, 'utf8');
} catch (err) {
  console.error(`Could not read ${FILE.pathname}: ${err.message}`);
  process.exit(1);
}

if (source.includes('\uFFFD')) {
  console.error('i18nStrings.ts contains U+FFFD replacement characters. The file was saved with the wrong encoding.');
  process.exit(1);
}

const start = source.indexOf('export const STRINGS');
const open = source.indexOf('[', start);
const close = source.lastIndexOf(']');
if (start === -1 || open === -1 || close === -1) {
  console.error('Could not locate the STRINGS array in i18nStrings.ts.');
  process.exit(1);
}

let rows;
try {
  /* eslint-disable-next-line no-new-func */
  rows = new Function(`return ${source.slice(open, close + 1)};`)();
} catch (err) {
  console.error(`STRINGS is not a valid array literal: ${err.message}`);
  process.exit(1);
}

const placeholders = (text) => (String(text).match(/\{(\w+)\}/g) || []).sort().join(',');
const problems = [];
const seen = new Map();

rows.forEach((row, index) => {
  const line = index + 2; // 1-based line, roughly where the array starts.
  if (!Array.isArray(row) || row.length !== LANGS.length) {
    problems.push(`row ${index}: expected ${LANGS.length} columns, found ${Array.isArray(row) ? row.length : typeof row}`);
    return;
  }
  const [sv] = row;
  if (seen.has(sv)) problems.push(`row ${index}: duplicate Swedish key (already on row ${seen.get(sv)}): ${sv}`);
  else seen.set(sv, index);

  LANGS.forEach((lang, col) => {
    const value = row[col];
    if (typeof value !== 'string') {
      problems.push(`row ${index} [${lang}]: not a string`);
      return;
    }
    if (value.trim() === '') {
      problems.push(`row ${index} [${lang}]: empty translation for "${sv}"`);
      return;
    }
    if (lang !== 'sv' && placeholders(value) !== placeholders(sv)) {
      problems.push(`row ${index} [${lang}]: placeholders "${placeholders(sv) || '(none)'}" lost, found "${placeholders(value) || '(none)'}" for "${sv}"`);
    }
  });
});

if (problems.length) {
  console.error(`Translation table has ${problems.length} problem(s):\n`);
  problems.slice(0, 40).forEach((p) => console.error(`  - ${p}`));
  if (problems.length > 40) console.error(`  ...and ${problems.length - 40} more`);
  process.exit(1);
}

console.log(`Translations OK: ${rows.length} strings x ${LANGS.length} languages.`);
