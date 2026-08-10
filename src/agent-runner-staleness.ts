/**
 * Is each agent group actually RUNNING the agent-runner source we merged?
 *
 * THE PROBLEM
 *
 * `src/group-init.ts` copies `container/agent-runner/src/` to
 * `data/v2-sessions/<group-id>/agent-runner-src/` behind an `if (!existsSync)`,
 * and `src/container-runner.ts` bind-mounts that copy at `/app/src`. The copy is
 * made once, at group creation, and no deploy path refreshes it. So every merged
 * fix under `container/agent-runner/src/**` is INERT on every pre-existing group
 * — the repo is fixed, production is not, and nothing anywhere says so.
 *
 * WHY NOT JUST RE-COPY
 *
 * `/app/src` is mounted WRITABLE on purpose (`container/Dockerfile`,
 * `container-runner.ts`): `container/skills/self-customize/SKILL.md` routes
 * source-level changes through a builder agent that edits `/app/src`, and
 * `.claude/skills/add-opencode/SKILL.md` writes provider files straight into
 * this tree. A blind `cpSync` over it would silently destroy both. Trading a
 * silent-inertness bug for a silent-data-loss bug is not progress.
 *
 * THE DISTINCTION THAT MAKES A SAFE REFRESH POSSIBLE
 *
 * A file in the group copy that differs from the repo is one of two things, and
 * they are NOT the same:
 *
 *   - an OLD VERSION of that file — the group was created before the fix landed
 *     and nobody has touched it since. Overwriting it loses nothing.
 *   - a LOCAL EDIT — a builder agent or an install skill wrote it. Overwriting
 *     it destroys work.
 *
 * Git can tell them apart. Every version of a tracked file that ever existed is
 * a blob in the object database, addressed by content. So: hash the group's copy
 * and ask whether that blob is known to this repository. An old version is
 * known; novel content is not. That is a provable property, not a heuristic —
 * which is what lets `stale` be refreshed automatically while `modified` is
 * never touched without an explicit human decision.
 *
 * The failure modes all point the safe way. A shallow clone (no history) or a
 * pruned object DB makes old versions look novel, so files get classified
 * `modified` and are REPORTED rather than overwritten. The check degrades to
 * "tell the operator", never to "overwrite silently".
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * What a single file in a group's copy is, relative to the repo's source.
 *
 * `stale` and `missing` are safe to apply automatically — provably no local work
 * is lost. `modified` and `extra` are somebody's deliberate content and are only
 * ever reported.
 */
export type FileClass = 'current' | 'stale' | 'modified' | 'missing' | 'extra';

/** Classes an automated refresh may write. Everything else needs a human. */
export const SAFE_TO_REFRESH: readonly FileClass[] = ['stale', 'missing'];

export interface FileFinding {
  /** Path relative to the agent-runner source root, POSIX separators. */
  file: string;
  cls: FileClass;
}

export interface GroupFinding {
  groupId: string;
  copyDir: string;
  files: FileFinding[];
}

/**
 * Given absolute paths, return the subset whose CONTENT is a blob this
 * repository already knows. Injected so the classifier stays pure and testable;
 * `gitKnownBlobs` below is the real implementation.
 */
export type KnownBlobLookup = (absPaths: string[]) => Set<string>;

/**
 * The real provenance oracle: "has this repository ever stored this content?"
 *
 * Two subprocesses for the whole batch — `hash-object` to address the candidate
 * files by content, `cat-file --batch-check` to ask which of those addresses the
 * object database actually holds. Using git's own hasher rather than computing
 * SHA-1 here keeps this correct on repositories using a non-default object
 * format.
 *
 * Returns an EMPTY set on any failure (git missing, not a repo, unreadable
 * path). Empty means "nothing is provably stale", which classifies every
 * differing file as `modified` — reported to a human, never auto-overwritten.
 * The degraded mode is the safe one.
 */
export function gitKnownBlobs(repoRoot: string): KnownBlobLookup {
  return (absPaths: string[]): Set<string> => {
    const empty = new Set<string>();
    if (absPaths.length === 0) return empty;
    // `--stdin-paths` is newline-delimited with no quoting, so a path containing
    // a newline cannot be expressed. Ours never do; refuse rather than misalign
    // the hash-to-path mapping and mislabel somebody's edit as stale.
    if (absPaths.some((p) => p.includes('\n'))) return empty;

    const hashed = spawnSync('git', ['-C', repoRoot, 'hash-object', '--no-filters', '--stdin-paths'], {
      input: absPaths.join('\n') + '\n',
      encoding: 'utf-8',
    });
    if (hashed.status !== 0 || !hashed.stdout) return empty;
    const oids = hashed.stdout.split('\n').filter(Boolean);
    if (oids.length !== absPaths.length) return empty; // misaligned — refuse

    const checked = spawnSync('git', ['-C', repoRoot, 'cat-file', '--batch-check'], {
      input: oids.join('\n') + '\n',
      encoding: 'utf-8',
    });
    if (checked.status !== 0 || !checked.stdout) return empty;

    // One line per input oid: "<oid> blob <size>" when present, "<oid> missing"
    // when the object database has never held that content.
    const lines = checked.stdout.split('\n').filter(Boolean);
    if (lines.length !== oids.length) return empty;
    const known = new Set<string>();
    lines.forEach((line, i) => {
      if (/\bblob\b/.test(line)) known.add(absPaths[i]);
    });
    return known;
  };
}

/** Every file under `root`, relative and POSIX-separated, sorted. */
export function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), rel);
      else if (e.isFile()) out.push(rel);
    }
  };
  walk(root, '');
  return out.sort();
}

function sameContent(a: string, b: string): boolean {
  try {
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

/**
 * Classify every file in one group's copy against the repo's source tree.
 *
 * `knownBlobs` is consulted ONCE, in a single batch, for exactly the files that
 * differ — the only ones whose provenance is in question.
 */
export function classifyCopy(repoSrcDir: string, copyDir: string, knownBlobs: KnownBlobLookup): FileFinding[] {
  const repoFiles = new Set(listFiles(repoSrcDir));
  const copyFiles = new Set(listFiles(copyDir));

  const differing: string[] = [];
  const findings = new Map<string, FileClass>();

  for (const f of repoFiles) {
    if (!copyFiles.has(f)) {
      findings.set(f, 'missing');
    } else if (sameContent(path.join(repoSrcDir, f), path.join(copyDir, f))) {
      findings.set(f, 'current');
    } else {
      differing.push(f);
    }
  }
  for (const f of copyFiles) {
    if (!repoFiles.has(f)) findings.set(f, 'extra');
  }

  if (differing.length > 0) {
    const known = knownBlobs(differing.map((f) => path.join(copyDir, f)));
    for (const f of differing) {
      findings.set(f, known.has(path.join(copyDir, f)) ? 'stale' : 'modified');
    }
  }

  return [...findings.entries()].map(([file, cls]) => ({ file, cls })).sort((a, b) => a.file.localeCompare(b.file));
}

/** Group ids that have a per-group runner copy, i.e. that this check applies to. */
export function findGroupCopies(dataDir: string): Array<{ groupId: string; copyDir: string }> {
  const sessionsRoot = path.join(dataDir, 'v2-sessions');
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(sessionsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ groupId: e.name, copyDir: path.join(sessionsRoot, e.name, 'agent-runner-src') }))
    .filter((g) => fs.existsSync(g.copyDir))
    .sort((a, b) => a.groupId.localeCompare(b.groupId));
}

export function summarize(files: FileFinding[]): Record<FileClass, number> {
  const counts: Record<FileClass, number> = {
    current: 0,
    stale: 0,
    modified: 0,
    missing: 0,
    extra: 0,
  };
  for (const f of files) counts[f.cls]++;
  return counts;
}

/**
 * Copy the provably-safe classes (`stale`, `missing`) from the repo into the
 * group's copy. Returns what it wrote. Never touches `modified` or `extra` — a
 * caller that wants those must take that decision itself, in the open.
 */
export function applySafeRefresh(repoSrcDir: string, copyDir: string, files: FileFinding[]): string[] {
  const written: string[] = [];
  for (const { file, cls } of files) {
    if (!SAFE_TO_REFRESH.includes(cls)) continue;
    const dst = path.join(copyDir, file);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(repoSrcDir, file), dst);
    written.push(file);
  }
  return written;
}
