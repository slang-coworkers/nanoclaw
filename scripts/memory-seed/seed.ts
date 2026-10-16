/**
 * Coworker memory seed — export an agent group's whole OKF memory tree as a
 * scrubbed, integrity-checked bundle, and import it into another install.
 *
 * Custom and opt-in. Templates carry a coworker's IDENTITY and by design never
 * touch memory; this is the separate carrier for what it has LEARNED, used when
 * seeding a new install (another prod box, or Astra) from an existing coworker.
 * A template stamp with no import is a clean coworker — the safe default.
 *
 * Bundle = everything under `groups/<folder>/memory/` that scope.ts admits, laid
 * back down at the same relative paths on the target. Each file is scrubbed on
 * export and re-scrubbed on import; `seed-manifest.json` pins every file's byte
 * count and SHA-256, and import verifies the whole seed before writing anything.
 *
 * The regex scrub is best-effort: a second, independent secret scanner and a human
 * review of the redaction report are required before a seed is committed to any
 * transport repository.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { excludeReason, isSafeSeedPath, type ExcludeReason } from './scope.js';
import { scrubSecrets } from './scrub.js';

export const SCHEMA_VERSION = 2;
export const SCRUBBER_VERSION = 3;
export const MANIFEST = 'seed-manifest.json';
/** Install-local provenance record written on the target; a dotfile, so never re-exported. */
export const PROVENANCE = '.memory-seed-import.json';

/** Files the runtime scaffolds from templates when missing (agent-runner memory/scaffold.ts). */
export const SCAFFOLD_FILES = ['index.md', 'system/index.md', 'system/definition.md'];
export const DEFAULT_SCAFFOLD_DIR = 'container/agent-runner/src/memory/templates';

export interface ManifestFile {
  path: string;
  bytes: number;
  sha256: string;
  redactions: number;
}

export interface Manifest {
  schemaVersion: number;
  scrubberVersion: number;
  sourceGroup: string;
  scope: 'memory';
  exportedAt: string;
  files: ManifestFile[];
  excluded: Array<{ path: string; reason: ExcludeReason }>;
  skipped: Array<{ path: string; reason: 'non-utf8' }>;
  redactionsByType: Record<string, number>;
}

export function assertSafeComponent(name: string, what: string): void {
  if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..' || name.startsWith('.')) {
    throw new Error(`invalid ${what}: ${JSON.stringify(name)} (must be a single, non-hidden path component)`);
  }
}

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function decodeUtf8(buf: Buffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}

/** Regular files and symlinks under dir, as POSIX paths relative to dir. Symlinks are listed, never followed. */
export function walkTree(dir: string, base = dir): { files: string[]; symlinks: string[] } {
  const files: string[] = [];
  const symlinks: string[] = [];
  if (!fs.existsSync(dir)) return { files, symlinks };
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (e.isSymbolicLink()) symlinks.push(rel);
    else if (e.isDirectory()) {
      const sub = walkTree(full, base);
      files.push(...sub.files);
      symlinks.push(...sub.symlinks);
    } else if (e.isFile()) files.push(rel);
  }
  return { files: files.sort(), symlinks: symlinks.sort() };
}

function isInside(child: string, parent: string): boolean {
  return child === parent || child.startsWith(parent + path.sep);
}

// ---------------------------------------------------------------- export

export interface ExportOptions {
  groupsRoot: string;
  group: string;
  /** Seed destination root; the seed lands at <out>/<group>/. Required unless dryRun. */
  out?: string;
  force?: boolean;
  dryRun?: boolean;
}

export function exportSeed(o: ExportOptions): { manifest: Manifest; seedDir: string | null } {
  assertSafeComponent(o.group, 'group');
  const memDir = path.join(o.groupsRoot, o.group, 'memory');
  if (!fs.existsSync(memDir) || !fs.statSync(memDir).isDirectory()) throw new Error(`no memory dir at ${memDir}`);
  if (!o.out && !o.dryRun) throw new Error('out is required unless dryRun');

  const outGroupDir = o.out ? path.join(o.out, o.group) : null;
  if (outGroupDir && isInside(path.resolve(outGroupDir), fs.realpathSync(memDir))) {
    throw new Error('the seed output must be outside the source memory tree');
  }
  const write = Boolean(outGroupDir) && !o.dryRun;
  const staging = outGroupDir ? `${outGroupDir}.staging-${process.pid}` : '';
  if (write) {
    if (fs.existsSync(outGroupDir!) && !o.force)
      throw new Error(`${outGroupDir} already exists — pass --force to replace it`);
    fs.rmSync(staging, { recursive: true, force: true });
    fs.mkdirSync(path.join(staging, 'memory'), { recursive: true });
  }

  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    scrubberVersion: SCRUBBER_VERSION,
    sourceGroup: o.group,
    scope: 'memory',
    exportedAt: new Date().toISOString(),
    files: [],
    excluded: [],
    skipped: [],
    redactionsByType: {},
  };

  const { files, symlinks } = walkTree(memDir);
  for (const rel of symlinks) manifest.excluded.push({ path: rel, reason: 'symlink' });
  for (const rel of files) {
    const why = excludeReason(rel);
    if (why) {
      manifest.excluded.push({ path: rel, reason: why });
      continue;
    }
    // Text only: a binary blob cannot be vetted by the scrubber, so it stays behind (and is reported).
    const text = decodeUtf8(fs.readFileSync(path.join(memDir, rel)));
    if (text === null) {
      manifest.skipped.push({ path: rel, reason: 'non-utf8' });
      continue;
    }
    const { text: scrubbed, redactions } = scrubSecrets(text);
    const buf = Buffer.from(scrubbed, 'utf8');
    let count = 0;
    for (const r of redactions) {
      manifest.redactionsByType[r.type] = (manifest.redactionsByType[r.type] ?? 0) + r.count;
      count += r.count;
    }
    manifest.files.push({ path: rel, bytes: buf.length, sha256: sha256(buf), redactions: count });
    if (write) {
      const dst = path.join(staging, 'memory', rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, buf);
    }
  }

  if (write) {
    fs.writeFileSync(path.join(staging, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
    fs.rmSync(outGroupDir!, { recursive: true, force: true });
    fs.renameSync(staging, outGroupDir!);
  }
  return { manifest, seedDir: write ? outGroupDir : null };
}

// ---------------------------------------------------------------- import

export interface ImportOptions {
  groupsRoot: string;
  group: string;
  /** The exported seed dir (holding seed-manifest.json) or a parent containing exactly one. */
  seed: string;
  /** Overwrite target files that differ from the seed (default: fail on any such conflict). */
  force?: boolean;
  allowEmpty?: boolean;
  dryRun?: boolean;
  /** Where the runtime's memory templates live; a target file identical to one is safe to replace. */
  scaffoldDir?: string;
}

export interface ImportResult {
  seedDir: string;
  sourceGroup: string;
  declared: number;
  /** Paths written (or, on dryRun, that would be written). */
  write: string[];
  skippedIdentical: string[];
  /** Target files that were still the pristine runtime scaffold and are replaced by the seed's version. */
  replacedScaffold: string[];
  /** Target files that differ from the seed and were overwritten because force was set. */
  overwritten: string[];
  applied: boolean;
}

export class SeedConflictError extends Error {
  constructor(readonly conflicts: string[]) {
    super(
      `${conflicts.length} target file(s) differ from the seed — nothing was written. Pass --force to overwrite:\n  ${conflicts.join('\n  ')}`,
    );
  }
}

export function resolveSeedDir(seed: string): string {
  if (fs.existsSync(path.join(seed, MANIFEST))) return seed;
  const hits = fs.existsSync(seed)
    ? fs
        .readdirSync(seed, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(seed, e.name, MANIFEST)))
        .map((e) => path.join(seed, e.name))
    : [];
  if (hits.length === 1) return hits[0];
  throw new Error(
    hits.length === 0
      ? `no ${MANIFEST} in or under ${seed}`
      : `multiple seeds under ${seed} — point --seed at exactly one`,
  );
}

function loadScaffold(dir: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const rel of SCAFFOLD_FILES) {
    const p = path.join(dir, rel);
    if (fs.existsSync(p)) m.set(rel, sha256(fs.readFileSync(p)));
  }
  return m;
}

export function importSeed(o: ImportOptions): ImportResult {
  assertSafeComponent(o.group, 'group');
  const seedDir = resolveSeedDir(o.seed);
  const manifest = JSON.parse(fs.readFileSync(path.join(seedDir, MANIFEST), 'utf8')) as Partial<Manifest>;
  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `seed schemaVersion ${manifest.schemaVersion} is not ${SCHEMA_VERSION} — re-export it with the current tool`,
    );
  }
  if (!Array.isArray(manifest.files)) throw new Error('manifest has no files[] array');
  const files = manifest.files;
  if (files.length === 0 && !o.allowEmpty) throw new Error('seed declares 0 files — refusing (pass --allow-empty)');

  const seedMem = path.join(seedDir, 'memory');
  const destMem = path.join(o.groupsRoot, o.group, 'memory');
  const canon = (p: string): string => (fs.existsSync(p) ? fs.realpathSync(p) : path.resolve(p));
  const seedCanon = canon(seedMem);
  const destCanon = canon(destMem);
  if (isInside(seedCanon, destCanon) || isInside(destCanon, seedCanon)) {
    throw new Error('seed and target memory overlap — refusing');
  }

  // 1) Validate the WHOLE seed against its manifest before touching the target.
  const declared = new Set<string>();
  const staged: Array<{ rel: string; buf: Buffer }> = [];
  for (const f of files) {
    if (!isSafeSeedPath(f.path)) throw new Error(`unsafe or install-local path in manifest: ${JSON.stringify(f.path)}`);
    if (declared.has(f.path)) throw new Error(`duplicate path in manifest: ${f.path}`);
    declared.add(f.path);
    const src = path.join(seedMem, f.path);
    let st: fs.Stats;
    try {
      st = fs.lstatSync(src);
    } catch {
      throw new Error(`manifest file missing from seed: ${f.path}`);
    }
    if (!st.isFile()) throw new Error(`seed entry is not a regular file: ${f.path}`);
    const buf = fs.readFileSync(src);
    if (buf.length !== f.bytes) throw new Error(`byte mismatch ${f.path}: ${buf.length} != ${f.bytes}`);
    if (sha256(buf) !== f.sha256) throw new Error(`sha256 mismatch ${f.path}`);
    const text = decodeUtf8(buf);
    if (text === null) throw new Error(`seed file ${f.path} is not valid UTF-8`);
    if (scrubSecrets(text).redactions.length) {
      throw new Error(`seed file ${f.path} still contains secret-shaped content — rejecting import`);
    }
    staged.push({ rel: f.path, buf });
  }
  const seedTree = walkTree(seedMem);
  if (seedTree.symlinks.length) throw new Error(`seed contains symlinks: ${seedTree.symlinks.join(', ')}`);
  for (const rel of seedTree.files) {
    if (!declared.has(rel)) throw new Error(`seed contains an undeclared file: ${rel}`);
  }

  // 2) Plan: new files are written; identical files skipped; a target file that is
  //    still the pristine runtime scaffold is replaced; any other difference is a
  //    conflict unless force is set.
  const scaffold = loadScaffold(o.scaffoldDir ?? DEFAULT_SCAFFOLD_DIR);
  const result: ImportResult = {
    seedDir,
    sourceGroup: String(manifest.sourceGroup ?? ''),
    declared: files.length,
    write: [],
    skippedIdentical: [],
    replacedScaffold: [],
    overwritten: [],
    applied: false,
  };
  const conflicts: string[] = [];
  const plan: typeof staged = [];
  for (const s of staged) {
    const dst = path.join(destMem, s.rel);
    let st: fs.Stats | null = null;
    try {
      st = fs.lstatSync(dst);
    } catch {
      /* absent — a plain write */
    }
    if (st) {
      if (!st.isFile()) throw new Error(`target path is not a regular file (symlink or directory): ${s.rel}`);
      const cur = sha256(fs.readFileSync(dst));
      if (cur === sha256(s.buf)) {
        result.skippedIdentical.push(s.rel);
        continue;
      }
      if (scaffold.get(s.rel) === cur) result.replacedScaffold.push(s.rel);
      else if (o.force) result.overwritten.push(s.rel);
      else {
        conflicts.push(s.rel);
        continue;
      }
    }
    plan.push(s);
  }
  if (conflicts.length) throw new SeedConflictError(conflicts);
  result.write = plan.map((s) => s.rel);
  if (o.dryRun) return result;

  // 3) Apply — every write is confined to the target memory dir, even through symlinked subdirs.
  fs.mkdirSync(destMem, { recursive: true });
  const destReal = fs.realpathSync(destMem);
  for (const s of plan) {
    const dst = path.join(destMem, s.rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (!isInside(fs.realpathSync(path.dirname(dst)), destReal)) {
      throw new Error(`refusing to write outside the target memory dir: ${s.rel}`);
    }
    fs.writeFileSync(dst, s.buf);
  }
  fs.writeFileSync(
    path.join(destMem, PROVENANCE),
    JSON.stringify(
      {
        importedAt: new Date().toISOString(),
        sourceGroup: result.sourceGroup,
        exportedAt: manifest.exportedAt ?? null,
        schemaVersion: manifest.schemaVersion,
        scrubberVersion: manifest.scrubberVersion ?? null,
        files: result.write,
      },
      null,
      2,
    ) + '\n',
  );
  result.applied = true;
  return result;
}
