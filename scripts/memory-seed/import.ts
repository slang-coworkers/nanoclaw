/**
 * Import a scrubbed, integrity-checked memory seed into a coworker's
 * `memory/imported/`.
 *
 * Explicit and opt-in (our custom "copy an instantiated coworker's learnings
 * elsewhere" step) — a template stamp gives a coworker fresh memory by default;
 * this lays prior learnings into it only when chosen. The seed is treated as a
 * potentially-hostile artifact: the `seed-manifest.json` is authoritative, and
 * BEFORE writing anything the importer verifies every listed file's byte count
 * and SHA-256, rejects any file present-but-unlisted (or listed-but-missing), and
 * re-runs the scrubber — refusing the import if a "scrubbed" file still contains
 * secret-shaped content. Files keep their relative path under `imported/` (no
 * flattening, so no basename collisions).
 *
 * Usage:
 *   tsx scripts/memory-seed/import.ts --group <folder> --seed <dir> \
 *     [--mode merge|replace] [--allow-empty] [--force] [--dry-run]
 *
 * --seed points at the exported group dir (holding seed-manifest.json), or a
 * parent that contains exactly one such dir. merge = add/skip-identical, fail on
 * a divergent same-name file unless --force. replace = first remove exactly the
 * files THIS manifest declares (target-origin learnings untouched), then write.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { scrubSecrets } from './scrub.js';

interface Opts {
  group: string;
  seed: string;
  groupsRoot: string;
  mode: 'merge' | 'replace';
  allowEmpty: boolean;
  force: boolean;
  dryRun: boolean;
}

interface ManifestFile {
  path: string;
  bytes: number;
  sha256: string;
}

function parseArgs(argv: string[]): Opts {
  const o: Opts = {
    group: '',
    seed: '',
    groupsRoot: 'groups',
    mode: 'merge',
    allowEmpty: false,
    force: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--group') o.group = argv[++i];
    else if (a === '--seed') o.seed = argv[++i];
    else if (a === '--groups-root') o.groupsRoot = argv[++i];
    else if (a === '--mode') o.mode = argv[++i] as 'merge' | 'replace';
    else if (a === '--allow-empty') o.allowEmpty = true;
    else if (a === '--force') o.force = true;
    else if (a === '--dry-run') o.dryRun = true;
    else throw new Error(`unknown arg: ${a}`);
  }
  if (!o.group) throw new Error('--group <folder> required');
  if (!o.seed) throw new Error('--seed <dir> required');
  if (o.mode !== 'merge' && o.mode !== 'replace') throw new Error('--mode must be merge|replace');
  return o;
}

function assertSafeComponent(name: string, what: string): void {
  if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    throw new Error(`invalid ${what}: ${JSON.stringify(name)} (must be a single path component)`);
  }
}

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function walkMd(dir: string, base = dir): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMd(full, base));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(path.relative(base, full));
  }
  return out;
}

// Resolve the seed dir holding seed-manifest.json. No heuristic tree-walk: either
// --seed IS that dir, or it contains exactly one such dir.
function resolveSeedDir(seed: string): string {
  if (fs.existsSync(path.join(seed, 'seed-manifest.json'))) return seed;
  const hits: string[] = [];
  for (const e of fs.readdirSync(seed, { withFileTypes: true })) {
    if (e.isDirectory() && fs.existsSync(path.join(seed, e.name, 'seed-manifest.json'))) {
      hits.push(path.join(seed, e.name));
    }
  }
  if (hits.length === 1) return hits[0];
  throw new Error(
    hits.length === 0
      ? `no seed-manifest.json in or under ${seed}`
      : `multiple seeds under ${seed} — point --seed at exactly one`,
  );
}

function main(): void {
  const o = parseArgs(process.argv.slice(2));
  assertSafeComponent(o.group, 'group');

  const seedDir = resolveSeedDir(o.seed);
  const manifest = JSON.parse(fs.readFileSync(path.join(seedDir, 'seed-manifest.json'), 'utf8')) as {
    files?: ManifestFile[];
  };
  const files = manifest.files ?? [];
  if (!Array.isArray(manifest.files)) throw new Error('manifest has no files[] array');
  if (files.length === 0 && !o.allowEmpty) throw new Error('seed declares 0 files — refusing (pass --allow-empty)');

  const seedImported = path.join(seedDir, 'memory', 'imported');
  const destImported = path.join(o.groupsRoot, o.group, 'memory', 'imported');

  // Source and destination must be different directories (guards --seed == target).
  const seedCanon = fs.existsSync(seedImported) ? fs.realpathSync(seedImported) : path.resolve(seedImported);
  const destCanon = fs.existsSync(destImported) ? fs.realpathSync(destImported) : path.resolve(destImported);
  if (seedCanon === destCanon) throw new Error('--seed resolves to the target group memory — refusing');

  // 1) Validate the WHOLE seed against the manifest before touching the target.
  const staged: Array<{ rel: string; buf: Buffer }> = [];
  for (const f of files) {
    if (!f.path || f.path.includes('..') || path.isAbsolute(f.path) || f.path.includes('\\')) {
      throw new Error(`unsafe path in manifest: ${JSON.stringify(f.path)}`);
    }
    const src = path.join(seedImported, f.path);
    if (!fs.existsSync(src) || fs.lstatSync(src).isSymbolicLink()) {
      throw new Error(`manifest file missing or symlink: ${f.path}`);
    }
    const buf = fs.readFileSync(src);
    if (buf.length !== f.bytes) throw new Error(`byte mismatch ${f.path}: ${buf.length} != ${f.bytes}`);
    if (sha256(buf) !== f.sha256) throw new Error(`sha256 mismatch ${f.path}`);
    // Defense in depth: a "scrubbed" seed must survive a re-scrub unchanged.
    const dec = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    if (scrubSecrets(dec).redactions.length) {
      throw new Error(`seed file ${f.path} still contains secret-shaped content — rejecting import`);
    }
    staged.push({ rel: f.path, buf });
  }
  // Reject any .md present in the seed but not declared — no smuggled extras.
  const declared = new Set(files.map((f) => f.path));
  for (const rel of walkMd(seedImported)) {
    if (!declared.has(rel)) throw new Error(`seed contains an undeclared file: ${rel}`);
  }

  // 2) Plan writes: skip byte-identical, flag divergent same-name conflicts.
  let write = 0;
  let skipIdentical = 0;
  let conflict = 0;
  const plan: Array<{ rel: string; buf: Buffer }> = [];
  for (const s of staged) {
    const dst = path.join(destImported, s.rel);
    if (fs.existsSync(dst) && !fs.lstatSync(dst).isSymbolicLink()) {
      if (sha256(fs.readFileSync(dst)) === sha256(s.buf)) {
        skipIdentical++;
        continue;
      }
      if (o.mode === 'merge' && !o.force) {
        conflict++;
        console.error(`  CONFLICT (differs, kept target): ${s.rel}`);
        continue;
      }
    }
    plan.push(s);
    write++;
  }
  if (conflict && !o.force) {
    throw new Error(`${conflict} conflicting file(s) differ from the seed — resolve or pass --force (merge overwrites)`);
  }

  // 3) Apply.
  if (!o.dryRun) {
    fs.mkdirSync(destImported, { recursive: true });
    if (o.mode === 'replace') {
      // Namespace-scoped: remove ONLY the files this seed's manifest declares.
      for (const f of files) {
        const p = path.join(destImported, f.path);
        if (fs.existsSync(p) && !fs.lstatSync(p).isSymbolicLink()) fs.rmSync(p);
      }
    }
    for (const s of plan) {
      const dst = path.join(destImported, s.rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, s.buf);
    }
  }

  console.log(`[import-memory-seed] group=${o.group} seed=${seedDir} declared=${files.length}`);
  console.log(`  mode=${o.mode} write=${write} skip-identical=${skipIdentical} conflicts=${conflict}`);
  console.log(
    o.dryRun ? '  DRY RUN — validated seed against manifest, nothing written.' : `  wrote into ${destImported}`,
  );
}

main();
