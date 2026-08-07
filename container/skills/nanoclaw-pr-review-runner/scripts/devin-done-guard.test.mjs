// Extracts the live DONE_EXPR out of devin-fetch.sh and executes it, so the
// test exercises the shipped expression rather than a copy of it.
// Run: node devin-done-guard.test.mjs
import {readFileSync} from 'fs';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';
const here = dirname(fileURLToPath(import.meta.url));
const sh = readFileSync(join(here, 'devin-fetch.sh'), 'utf8');
const m = sh.match(/DONE_EXPR='([\s\S]*?)'\n/);
if (!m) { console.error('could not extract DONE_EXPR from devin-fetch.sh'); process.exit(2); }
const expr = m[1];
const cases = [
 ["FALSE-CLEAN slang-rhi#815: heading + partial rail, verdict behind View results",
  "Devin's AI analysis\nView results\nChecks 12/22", false],
 ["skeleton-load: heading + partial rail + Loading diffs",
  "Devin's AI analysis\nChecks 3/22\nLoading diffs…", false],
 ["genuine done: N Flags", "Devin's AI analysis\n2 Flags\nChecks 22/22", true],
 ["genuine done: No flags + banner", "Devin's AI analysis\nNo flags\nAll checks passed", true],
 ["JULY-10 REGRESSION TARGET: settled rail 22/22, banner not yet rendered",
  "Devin's AI analysis\nChecks 22/22", true],
 ["checks failed is still a verdict-bearing summary",
  "Devin's AI analysis\n1 Flag\n2 checks failed", true],
 ["still generating", "Devin's AI analysis\nGenerating...\nNo flags", false],
 ["in-progress, no result", "PR analysis in progress\nDevin's AI analysis", false],
 ["partial rail ONLY, no heading", "Checks 12/22", false],
];
let bad = 0;
for (const [name, text, want] of cases) {
  global.document = { body: { innerText: text } };
  const got = eval(expr);
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'BAD '} want=${String(want).padEnd(5)} got=${String(got).padEnd(5)} ${name}`);
}
console.log(`\n${bad} failing / ${cases.length} cases`);
process.exit(bad ? 1 : 0);
