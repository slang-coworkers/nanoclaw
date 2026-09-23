/**
 * Export a coworker's OKF learnings as a scrubbed, integrity-checked seed.
 *
 * A typed coworker accumulates learnings in `groups/<folder>/memory/imported/`.
 * Templates carry IDENTITY (persona/skills/MCP) and by design never touch memory,
 * so copying an instantiated coworker's learnings to another deployment needs a
 * separate, explicit carrier. This produces that carrier: it reads
 * `memory/imported/` READ-ONLY, redacts credential-shaped values (scrub.ts), and
 * writes a portable seed (`memory/imported/<rel>` preserving structure) plus a
 * `seed-manifest.json` — schema/scrubber version + per-file byte count and
 * SHA-256, which `import.ts` verifies before it writes anything.
 *
 * Scope is `memory/imported/` only — the derived root `MEMORY.md` index and other
 * top-level state are NOT carried (import regenerates the index). Read-only w.r.t.
 * the source box: only reads memory, only writes under --out (atomically).
 *
 * The regex scrub is best-effort — run a second secret scanner + human review of
 * the printed redaction report before committing the seed to any transport repo.
 *
 * Usage:
 *   tsx scripts/memory-seed/export.ts --group <folder> --out <dir> [--force] [--dry-run]
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { scrubSecrets } from './scrub.js';

const SCHEMA_VERSION = 1;
const SCRUBBER_VERSION = 2;

interface Opts {
  group: string;
  out: string;
  groupsRoot: string;
  force: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Opts {
  const o: Opts = { group: '', out: '', groupsRoot: 'groups', force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--group') o.group = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--groups-root') o.groupsRoot = argv[++i];
    else if (a === '--force') o.force = true;
    else if (a === '--dry-run') o.dryRun = true;
    else throw new Error(`unknown arg: ${a}`);
  }
  if (!o.group) throw new Error('--group <folder> required');
  if (!o.out && !o.dryRun) throw new Error('--out <dir> required (or --dry-run)');
  return o;
}

function assertSafeComponent(name: string, what: string): void {
  if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    throw new Error(`invalid ${what}: ${JSON.stringify(name)} (must be a single path component)`);
  }
}

function decodeStrict(buf: Buffer, rel: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    throw new Error(`invalid UTF-8 in ${rel} — refusing to export it (fix or remove the file)`);
  }
}

// Walk *.md under dir, rejecting symlinks (never follow out of the tree).
function walkMd(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMd(full, base));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(path.relative(base, full));
  }
  return out;
}

function main(): void {
  const o = parseArgs(process.argv.slice(2));
  assertSafeComponent(o.group, 'group');

  const importedDir = path.join(o.groupsRoot, o.group, 'memory', 'imported');
  if (!fs.existsSync(importedDir)) throw new Error(`no learnings dir at ${importedDir}`);

  const rels = walkMd(importedDir).sort();
  const outGroupDir = o.out ? path.join(o.out, o.group) : '';
  const staging = o.out ? `${outGroupDir}.staging-${process.pid}` : '';

  if (o.out && !o.dryRun) {
    if (fs.existsSync(outGroupDir) && !o.force) {
      throw new Error(`${outGroupDir} already exists — pass --force to replace it`);
    }
    fs.rmSync(staging, { recursive: true, force: true });
    fs.mkdirSync(path.join(staging, 'memory', 'imported'), { recursive: true });
  }

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    scrubberVersion: SCRUBBER_VERSION,
    sourceGroup: o.group,
    scope: 'memory/imported' as const,
    exportedAt: new Date().toISOString(),
    files: [] as Array<{ path: string; bytes: number; sha256: string; redactions: number }>,
    redactionsByType: {} as Record<string, number>,
  };

  for (const rel of rels) {
    const scrubbed0 = decodeStrict(fs.readFileSync(path.join(importedDir, rel)), rel);
    const { text, redactions } = scrubSecrets(scrubbed0);
    const buf = Buffer.from(text, 'utf8');
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    let red = 0;
    for (const r of redactions) {
      manifest.redactionsByType[r.type] = (manifest.redactionsByType[r.type] ?? 0) + r.count;
      red += r.count;
    }
    manifest.files.push({ path: rel, bytes: buf.length, sha256, redactions: red });
    if (o.out && !o.dryRun) {
      const dst = path.join(staging, 'memory', 'imported', rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, buf);
    }
  }

  if (o.out && !o.dryRun) {
    fs.writeFileSync(path.join(staging, 'seed-manifest.json'), JSON.stringify(manifest, null, 2));
    fs.rmSync(outGroupDir, { recursive: true, force: true });
    fs.renameSync(staging, outGroupDir);
  }

  const totalRed = Object.values(manifest.redactionsByType).reduce((a, b) => a + b, 0);
  const filesWithRed = manifest.files.filter((f) => f.redactions > 0).length;
  console.log(`[export-memory-seed] group=${o.group} scope=memory/imported files=${manifest.files.length}`);
  console.log(`  redactions: ${totalRed} across ${filesWithRed} file(s) ${JSON.stringify(manifest.redactionsByType)}`);
  console.log('  NOTE: regex scrub is best-effort — run a 2nd secret scanner + human review before committing the seed.');
  console.log(o.dryRun ? '  DRY RUN — nothing written.' : `  wrote seed to ${outGroupDir}`);
}

main();
