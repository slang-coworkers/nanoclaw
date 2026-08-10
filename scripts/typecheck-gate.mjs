#!/usr/bin/env node
/**
 * typecheck-gate — run the wide typecheck, allow the known debt, block anything new.
 *
 * WHY A RATCHET
 *
 * `pnpm exec tsc --noEmit` only ever covered `src/` — the project tsconfig is
 * `include: ["src*"]`. `setup/` (98 files) and `scripts/` (38) were never
 * typechecked by anything, and that hole was actively hiding real breakage:
 * six failure paths rendering the success glyph, a migration script whose JSDoc
 * closed early so it could not parse at all, a step registry importing a module
 * that does not exist, a migration importing a function renamed out from under
 * it, and two test harnesses drifted past the interfaces they exercise.
 *
 * Fixing all of that before turning the gate on would block the gate behind an
 * open-ended tail. Turning it on non-blocking (`continue-on-error`) would give
 * us a check that looks like a check and enforces nothing — the exact shape of
 * the bug we are fixing. So: enforce from today against NEW errors, and carry
 * the known ones in a readable baseline that may only shrink.
 *
 * THE BASELINE MAY ONLY SHRINK. This fails on a new error AND on a baselined
 * error that no longer occurs. A ratchet that never tightens is just a
 * suppression list: if fixed entries could linger, the file would drift out of
 * date and silently re-admit a regression that happened to match a stale line.
 * Pruning is mandatory, not polite.
 *
 * Errors are keyed `<file>\t<code>\t<count>` — deliberately not by line number,
 * which would churn the baseline on every unrelated edit above an entry. A new
 * occurrence of an already-baselined code in the same file still trips the gate,
 * because the count goes up.
 *
 *   node scripts/typecheck-gate.mjs            check against the baseline
 *   node scripts/typecheck-gate.mjs --write    regenerate it (review the diff!)
 *
 * Exit codes:
 *   0  matches the baseline exactly
 *   1  drift — new errors, or baselined entries that are now fixed
 *   2  the gate could not run (tsc missing, config missing, tsc crashed)
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = 'tsconfig.typecheck.json';
const BASELINE = path.join(ROOT, 'scripts', 'typecheck-baseline.txt');

/**
 * container/agent-runner is typechecked by its OWN tsconfig and its own CI step,
 * against real Bun types installed by `bun install` in that directory. The host
 * gate reaches it transitively (scripts/test-v2-*.ts, setup/migrate-v2/sessions.ts
 * import it) but must not judge it: whether `bun:sqlite` resolves here depends on
 * whether someone ran `bun install` locally, and an error that comes and goes with
 * the environment cannot be baselined — the baseline would be stale on one machine
 * and correct on another.
 */
const OUT_OF_SCOPE = /^container\//;

const ERROR_RE = /^(?<file>[^(]+)\((?<line>\d+),(?<col>\d+)\): error (?<code>TS\d+):/;

function fail(code, ...lines) {
  for (const l of lines) console.error(l);
  process.exit(code);
}

// ─── Run tsc ────────────────────────────────────────────────────────────────
const tsc = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(tsc)) fail(2, `::error::typescript not installed at ${tsc}; run pnpm install`);
if (!fs.existsSync(path.join(ROOT, CONFIG))) fail(2, `::error::missing ${CONFIG}`);

const run = spawnSync(process.execPath, [tsc, '--noEmit', '-p', CONFIG], {
  cwd: ROOT,
  encoding: 'utf-8',
});
// Capture the status IMMEDIATELY, before anything else can overwrite it. The
// same trailing-command bug this repo already shipped once (a `mv` becoming a
// cron script's exit status) would be a spectacular own goal in the gate that
// guards everything else.
const tscStatus = run.status;
const stdout = run.stdout ?? '';
const stderr = run.stderr ?? '';

if (run.error) fail(2, `::error::could not run tsc: ${run.error.message}`);
if (tscStatus === null) fail(2, `::error::tsc was killed by a signal (${run.signal})`);

const found = new Map(); // "file\tcode" -> count
const configErrors = [];
let parsed = 0;
for (const line of stdout.split('\n')) {
  const m = ERROR_RE.exec(line);
  if (!m) continue;
  parsed++;
  const file = m.groups.file.trim();
  // A diagnostic ON the tsconfig means the gate is misconfigured, not that the
  // code grew an error. Reporting it as "new" would invite someone to baseline
  // a broken gate, which is how a check becomes decorative.
  if (file.endsWith('.json')) {
    configErrors.push(line.trim());
    continue;
  }
  if (OUT_OF_SCOPE.test(file)) continue;
  const key = `${file}\t${m.groups.code}`;
  found.set(key, (found.get(key) ?? 0) + 1);
}

if (configErrors.length) {
  fail(2, `::error::${CONFIG} is invalid — the gate did not run:`, ...configErrors.map((e) => `  ${e}`));
}

// A non-zero tsc that produced NO parseable diagnostics did not "find nothing" —
// it failed to run. Treating that as a clean tree would report every baselined
// entry as fixed and then, once pruned, wave everything through.
if (tscStatus !== 0 && parsed === 0) {
  fail(2, '::error::tsc exited non-zero without emitting diagnostics — the gate did not run.',
       stderr.trim() || stdout.trim() || '(no output)');
}

// ─── --write ────────────────────────────────────────────────────────────────
const HEADER = `# Known typecheck debt for tsconfig.typecheck.json. Generated by
# scripts/typecheck-gate.mjs --write; enforced by the same script in CI.
#
# THIS FILE MAY ONLY SHRINK. The gate fails on a NEW error and equally on an
# entry here that no longer occurs — fix something, delete its line in the same
# PR. A baseline that is allowed to go stale silently re-admits regressions.
#
# Format:  <file>  <TScode>  x<count>  # <why it is still here>
# Keyed by file+code+count, not line number, so unrelated edits above an entry
# do not churn it. container/** is out of scope: it has its own tsconfig and CI
# step (see OUT_OF_SCOPE in the gate script).
#
# NO ENTRIES BELOW THIS LINE IS THE GOAL STATE, NOT A BROKEN FILE. The debt is
# paid: the gate now demands zero errors across src/, setup/ and scripts/. Do
# not add a line to get a red build green — the ratchet only turns one way, and
# an empty baseline is the whole point of having had one.
`;

function render(map, reasons) {
  const rows = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  const width = Math.max(...rows.map(([k]) => k.split('\t')[0].length), 1);
  return (
    HEADER +
    rows
      .map(([k, n]) => {
        const [file, code] = k.split('\t');
        const why = reasons.get(k) ?? 'TODO: explain or fix';
        return `${file.padEnd(width)}  ${code}  x${n}  # ${why}`;
      })
      .join('\n') + '\n'
  );
}

function parseBaseline(text) {
  const map = new Map();
  const reasons = new Map();
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [file, code, count] = line.split(/\s+/);
    if (!file || !code || !/^x\d+$/.test(count ?? '')) continue;
    const key = `${file}\t${code}`;
    map.set(key, Number(count.slice(1)));
    const why = raw.includes('#') ? raw.slice(raw.indexOf('#') + 1).trim() : '';
    if (why) reasons.set(key, why);
  }
  return { map, reasons };
}

const existing = fs.existsSync(BASELINE)
  ? parseBaseline(fs.readFileSync(BASELINE, 'utf-8'))
  : { map: new Map(), reasons: new Map() };

if (process.argv.includes('--write')) {
  fs.writeFileSync(BASELINE, render(found, existing.reasons));
  console.log(`wrote ${path.relative(ROOT, BASELINE)} (${found.size} entries, ${parsed} diagnostics)`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  fail(2, `::error::missing ${path.relative(ROOT, BASELINE)}; generate it with --write`);
}

// ─── Compare ────────────────────────────────────────────────────────────────
const added = [];
const fixed = [];
for (const [key, n] of found) {
  const was = existing.map.get(key) ?? 0;
  if (n > was) added.push(`${key.replace('\t', '  ')}  now x${n}, baseline x${was}`);
}
for (const [key, was] of existing.map) {
  const n = found.get(key) ?? 0;
  if (n < was) fixed.push(`${key.replace('\t', '  ')}  now x${n}, baseline x${was}`);
}

if (added.length) {
  console.error(`::error::${added.length} new typecheck error(s) outside the baseline:`);
  for (const a of added) console.error(`  ${a}`);
  console.error('');
  console.error('Fix them. Do NOT add them to the baseline — it may only shrink.');
}

if (fixed.length) {
  console.error(`::error::${fixed.length} baselined entr(y/ies) no longer occur:`);
  for (const f of fixed) console.error(`  ${f}`);
  console.error('');
  console.error('Good — you fixed them. Now prune those lines:');
  console.error('  node scripts/typecheck-gate.mjs --write');
  console.error('A baseline that keeps fixed entries goes stale and stops catching regressions.');
}

if (added.length || fixed.length) process.exit(1);

console.log(
  `ok: ${parsed} diagnostic(s), ${found.size} baselined entr(y/ies), no drift.`,
);
process.exit(0);
