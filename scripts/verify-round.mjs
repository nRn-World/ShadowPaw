/**
 * One command that verifies an improvement round before it is shown to a
 * player: unit checks for the 10-minute shift logic, TypeScript, translations
 * and a production build.
 *
 * The shift module is TypeScript; instead of adding a test runner dependency we
 * transpile that single file with the already-installed TypeScript compiler and
 * import it from a data URL. No temp files, no extra packages.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const fail = (message) => {
  console.error(`\n❌ ${message}`);
  process.exit(1);
};

const assert = (condition, message) => {
  if (!condition) fail(message);
};

// ---------------------------------------------------------------- unit checks
const source = readFileSync(new URL('../services/neonShift.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const shift = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const { SHIFT_WINDOW_MS, NEON_SHIFTS, getNeonShift, getShiftWindow, msUntilNextShift, formatShiftCountdown } = shift;

assert(SHIFT_WINDOW_MS === 600000, 'A shift window must be exactly ten minutes.');
assert(NEON_SHIFTS.length >= 4, 'There should be several shifts to rotate through.');
assert(
  NEON_SHIFTS.every((s) => s.dashCooldown > 0 && s.gravityScale > 0 && s.comboWindow > 0),
  'A shift must never zero out a core game value.',
);
assert(
  NEON_SHIFTS.every((s) => s.label && s.desc && s.icon && s.color),
  'Every shift needs a label, description, icon and accent colour.',
);

// Deterministic within a window, and the boundary really is a boundary.
const t0 = 1_800_000_000_000;
const a = getNeonShift(t0);
const b = getNeonShift(t0 + SHIFT_WINDOW_MS - 1);
assert(a.id === b.id && a.windowIndex === b.windowIndex, 'The same window must always give the same shift.');
assert(getNeonShift(t0 + SHIFT_WINDOW_MS).windowIndex === a.windowIndex + 1, 'Windows must advance by one.');
assert(getShiftWindow(t0).endsAt - t0 === msUntilNextShift(t0), 'Countdown must match the window end.');
assert(msUntilNextShift(t0) > 0 && msUntilNextShift(t0) <= SHIFT_WINDOW_MS, 'Countdown must stay inside the window.');

// All shifts are reachable, and no two consecutive windows repeat a shift.
const seen = new Set();
for (let i = 0; i < 400; i++) {
  const now = i * SHIFT_WINDOW_MS + 1234;
  const current = getNeonShift(now);
  seen.add(current.id);
  const previous = getNeonShift(now - SHIFT_WINDOW_MS);
  assert(current.id !== previous.id, `Shift ${current.id} repeated in two consecutive windows.`);
  assert(!Number.isNaN(current.endsAt) && current.endsAt > now, 'Window metadata must be sane.');
}
assert(seen.size === NEON_SHIFTS.length, `Only ${seen.size}/${NEON_SHIFTS.length} shifts were reachable in 400 windows.`);

assert(formatShiftCountdown(0) === '0:00', 'Zero countdown should read 0:00.');
assert(formatShiftCountdown(61_900) === '1:02', 'Countdown should round up to whole seconds.');
assert(formatShiftCountdown(-500) === '0:00', 'Negative countdowns must clamp to zero.');
console.log(`✓ Neon-skift: ${NEON_SHIFTS.length} bonusar, 400 fönster verifierade.`);

// ---------------------------------------------------------------- repo checks
const steps = [
  ['Typkontroll', 'npm', ['run', 'typecheck']],
  ['Översättningar', 'npm', ['run', 'check:i18n']],
  ['Produktionsbygge', 'npm', ['run', 'build']],
];

for (const [label, command, args] of steps) {
  process.stdout.write(`\n→ ${label} ... `);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) fail(`${label} misslyckades.`);
}

console.log('\n✅ Rundan är verifierad: spelet går att bygga och all logik håller.\n');
