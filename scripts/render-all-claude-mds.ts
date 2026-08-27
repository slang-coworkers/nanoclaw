// Render every coworker CLAUDE.md scenario to /tmp/claude-md-scenarios/.
// Pure composer call per scenario — no DB reads, no container spawn.
//
// Run: pnpm exec tsx scripts/render-all-claude-mds.ts

import * as fs from 'node:fs';
import * as path from 'node:path';
import { composeCoworkerSpine, readCoworkerTypes } from '../src/claude-composer.js';

const OUT = '/tmp/claude-md-scenarios';
const ROOT = process.cwd();
// Optional suffix (e.g. --suffix=_new) lets the renderer write to sibling files
// like `01-default-untyped_new.md` so you can diff against the originals
// without overwriting them.
const suffixArg = process.argv.find((a) => a.startsWith('--suffix='));
const SUFFIX = suffixArg ? suffixArg.split('=')[1] ?? '' : '';

type Scenario = {
  tier: number;
  file: string;
  type: string;
  disableOverlays?: boolean;
  overlays?: string[];
  cliScope?: 'disabled' | 'group' | 'global';
  extraInstructions?: string;
  note: string;
};

const scenarios: Scenario[] = [
  // ── Tier 1: Foundations ───────────────────────────────────────────────
  { tier: 1, file: '01-default-untyped.md',         type: 'default',           note: 'Untyped fallback. Just base-common spine.' },
  { tier: 1, file: '02-main-admin.md',              type: 'main',              cliScope: 'global', note: 'Flat admin orchestrator. Verbatim prose, no slash workflows. Global cli_scope (owner agent default).' },

  // ── Tier 2: One typed reader per project ──────────────────────────────
  { tier: 2, file: '03-nanoclaw-reader.md',         type: 'nanoclaw-reader',   note: 'Read-only NanoClaw coworker. Plan workflow only.' },
  { tier: 2, file: '04-slang-reader.md',            type: 'slang-reader',      note: 'Read-only Slang coworker. Plan workflow only.' },
  { tier: 2, file: '05-slangpy-reader.md',          type: 'slangpy-reader',    note: 'Read-only SlangPy coworker. Plan workflow only.' },

  // ── Tier 3: Writers (plan + implement) ────────────────────────────────
  { tier: 3, file: '06-nanoclaw-writer.md',         type: 'nanoclaw-writer',   note: 'Write-capable NanoClaw. Adds code-writer + docs skills, implement workflow.' },
  { tier: 3, file: '07-slang-writer.md',            type: 'slang-writer',      note: 'Write-capable Slang. Same shape as nanoclaw-writer but per-project skills.' },
  { tier: 3, file: '08-slangpy-writer.md',          type: 'slangpy-writer',    note: 'Write-capable SlangPy.' },

  // ── Tier 4: Specialty types ───────────────────────────────────────────
  { tier: 4, file: '09-slang-maintainer.md',        type: 'slang-maintainer',  note: 'Recurring sweeps. Read-only + slang-maintainer-tools skill.' },
  { tier: 4, file: '10-slang-triage.md',            type: 'slang-triage',      note: 'Issue triage. Read-only.' },
  { tier: 4, file: '11-slang-fixer.md',             type: 'slang-fixer',       note: 'Fix workflow with repro test. Extends slang-writer.' },
  { tier: 4, file: '12-slang-reviewer.md',          type: 'slang-reviewer',    note: 'PR review runner. Read-only.' },
  { tier: 4, file: '13-slang-discord.md',           type: 'slang-discord',     note: 'Discord support. Read-only with Discord-scoped context.' },
  { tier: 4, file: '14-nanoclaw-reviewer.md',       type: 'nanoclaw-reviewer', note: 'Devin Review driver. Read-only.' },

  // ── Tier 5: Variants of slang-writer ──────────────────────────────────
  { tier: 5, file: '15-slang-writer-baseline.md',           type: 'slang-writer',                                                              note: 'Baseline (same as #07) — kept here for diffing against the variants below.' },
  { tier: 5, file: '16-slang-writer-overlays-disabled.md',  type: 'slang-writer', disableOverlays: true,                                       note: 'disable_overlays=1 (Codex agents). No critique gates inlined.' },
  { tier: 5, file: '17-slang-writer-with-critique.md',      type: 'slang-writer', overlays: ['critique-overlay'],                              note: 'Explicit overlays=[critique-overlay] from agent_groups.overlays.' },
  { tier: 5, file: '18-slang-writer-with-buddy.md',         type: 'slang-writer', overlays: ['buddy-monitor'],                                 note: 'Buddy overlay attached at runtime — splices "invoke /buddy at session start" reminder into plan/implement first step.' },
  { tier: 5, file: '18b-slang-writer-with-critique-and-buddy.md', type: 'slang-writer', overlays: ['critique-overlay', 'buddy-monitor'],         note: 'Both overlays simultaneously — critique gates at diagnose/change/deliver + buddy reminder at workflow start.' },
  { tier: 5, file: '19-slang-writer-cli-disabled.md',       type: 'slang-writer', cliScope: 'disabled',                                        note: 'cli_scope=disabled — ncl tool instructions stripped.' },
  { tier: 5, file: '20-slang-writer-cli-global.md',         type: 'slang-writer', cliScope: 'global',                                          note: 'cli_scope=global — unrestricted ncl access (owner agents).' },
  { tier: 5, file: '21-slang-writer-extra-instructions.md', type: 'slang-writer', extraInstructions: '## Custom Tail\n\nProject-specific note appended by the operator.\n', note: 'extraInstructions appended after the spine.' },
];

fs.mkdirSync(OUT, { recursive: true });

const knownTypes = new Set(Object.keys(readCoworkerTypes(ROOT)));
const indexLines: string[] = [
  '# CLAUDE.md scenarios',
  '',
  'Generated by `scripts/render-all-claude-mds.ts`.',
  '',
  '| # | Tier | Type | Variant | Bytes | File |',
  '|---|------|------|---------|------:|------|',
];

let idx = 0;
for (const s of scenarios) {
  idx++;
  if (!knownTypes.has(s.type)) {
    console.error(`SKIP ${s.file}: type "${s.type}" not in registry`);
    continue;
  }
  let body: string;
  try {
    body = composeCoworkerSpine({
      coworkerType: s.type,
      projectRoot: ROOT,
      disableOverlays: s.disableOverlays,
      overlays: s.overlays,
      cliScope: s.cliScope,
      extraInstructions: s.extraInstructions ?? null,
    });
  } catch (e: any) {
    console.error(`FAIL ${s.file} (${s.type}):`, e.message);
    continue;
  }
  const bytes = Buffer.byteLength(body, 'utf8');
  const outFile = SUFFIX ? s.file.replace(/\.md$/, `${SUFFIX}.md`) : s.file;
  fs.writeFileSync(path.join(OUT, outFile), body);
  const variant: string[] = [];
  if (s.disableOverlays) variant.push('disableOverlays');
  if (s.overlays?.length) variant.push(`overlays=[${s.overlays.join(',')}]`);
  if (s.cliScope) variant.push(`cli=${s.cliScope}`);
  if (s.extraInstructions) variant.push('+extraInstructions');
  indexLines.push(`| ${idx} | ${s.tier} | \`${s.type}\` | ${variant.join(' ') || '—'} | ${bytes.toLocaleString()} | [${s.file}](./${s.file}) |`);
  console.log(`  ${s.file.padEnd(46)} ${bytes.toString().padStart(7)} bytes  (${s.note})`);
}

const indexFile = SUFFIX ? `INDEX${SUFFIX}.md` : 'INDEX.md';
fs.writeFileSync(path.join(OUT, indexFile), indexLines.join('\n') + '\n');
console.log(`\nWrote ${idx} scenarios to ${OUT}/`);
console.log(`Index: ${OUT}/INDEX.md`);
