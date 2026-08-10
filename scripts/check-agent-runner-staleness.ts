#!/usr/bin/env tsx
/**
 * Assert that every agent group is actually RUNNING the agent-runner source in
 * this checkout — and refresh the ones that provably are not.
 *
 * WHY THIS EXISTS
 *
 * `src/group-init.ts` copies `container/agent-runner/src/` into
 * `data/v2-sessions/<group-id>/agent-runner-src/` behind an `if (!existsSync)`,
 * and `container-runner.ts` bind-mounts that copy at `/app/src`. The copy is made
 * ONCE, when the group is created, and nothing refreshes it. So for every group
 * that already existed, a merged fix under `container/agent-runner/src/**` is
 * inert: the repo is fixed, the container is not, `git log` says the bug is
 * closed, and nothing goes red.
 *
 * That is not hypothetical. `#1105` (a silent turn never acked completed) and the
 * agent-runner half of `#1110` were both counted as closed by the 2026-08-07
 * audit while still running the pre-fix code on every existing group.
 *
 * WHY IT DOES NOT JUST RE-COPY
 *
 * `/app/src` is writable on purpose. `container/skills/self-customize/SKILL.md`
 * routes source changes through a builder agent that edits it, and
 * `.claude/skills/add-opencode/SKILL.md` writes provider files into it. A blind
 * overwrite would destroy both. So each file is classified first, and only the
 * classes that provably carry no local work are ever written:
 *
 *   stale     differs from the repo, and the content is a blob this repository
 *             already holds — i.e. a genuine older version. Safe to replace.
 *   missing   in the repo, absent from the copy. Safe to add.
 *   modified  differs, and git has never seen this content. Somebody wrote it.
 *             REPORTED, never overwritten.
 *   extra     in the copy only — an install skill's file. Left alone.
 *
 * Usage:
 *   pnpm run check:runner-staleness              report; non-zero if stale
 *   pnpm run check:runner-staleness -- --refresh apply the safe classes
 *   pnpm run check:runner-staleness -- --json    machine-readable
 *
 * Exit codes:
 *   0  every group is current (or was refreshed to current)
 *   1  at least one group is running stale agent-runner code
 *   2  the check could not run — never reported as "current"
 */
import fs from 'fs';
import path from 'path';
import {
  applySafeRefresh,
  classifyCopy,
  findGroupCopies,
  gitKnownBlobs,
  summarize,
  type FileFinding,
} from '../src/agent-runner-staleness.js';

const PROJECT_ROOT = process.cwd();
const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
const REPO_SRC = path.join(PROJECT_ROOT, 'container', 'agent-runner', 'src');

/**
 * Exit codes, kept distinct because the CALLER acts differently on each.
 *
 * merge-train reports a non-zero exit as "some groups still run stale
 * agent-runner code" — a statement about the GROUPS. But an argument error or a
 * missing source tree means the checker never looked at a single group, and
 * reporting that as a finding about groups is a false statement dressed as a
 * result. On lego's first real run this said exactly that after crashing on a
 * bare `--`.
 */
export const EXIT_STALE_FOUND = 1;
export const EXIT_CANNOT_RUN = 2;

function main(argv: string[]): number {
  // A bare `--` is a SEPARATOR, not an argument. `pnpm run <script> -- --refresh`
  // forwards the separator along with the flag, so a strict unknown-arg check
  // rejects the very invocation the deploy path uses — which is how this exited
  // 2 on lego's first real run, from merge-train.sh's own call site.
  const args = argv.filter((a) => a !== '--');
  const refresh = args.includes('--refresh');
  const asJson = args.includes('--json');
  const unknown = args.filter((a) => !['--refresh', '--json'].includes(a));
  if (unknown.length > 0) {
    console.error(`unknown argument(s): ${unknown.join(' ')}`);
    return EXIT_CANNOT_RUN;
  }

  if (!fs.existsSync(REPO_SRC)) {
    console.error(`::error::no agent-runner source at ${REPO_SRC} — cannot judge staleness.`);
    console.error('Without it every group would trivially look current.');
    return EXIT_CANNOT_RUN;
  }

  const groups = findGroupCopies(DATA_DIR);
  const knownBlobs = gitKnownBlobs(PROJECT_ROOT);

  const report = groups.map((g) => {
    let files: FileFinding[] = classifyCopy(REPO_SRC, g.copyDir, knownBlobs);
    let refreshed: string[] = [];
    if (refresh) {
      refreshed = applySafeRefresh(REPO_SRC, g.copyDir, files);
      if (refreshed.length > 0) files = classifyCopy(REPO_SRC, g.copyDir, knownBlobs);
    }
    return { ...g, files, refreshed, counts: summarize(files) };
  });

  if (asJson) {
    console.log(JSON.stringify({ repoSrc: REPO_SRC, groups: report }, null, 2));
  }

  const behind = report.filter((r) => r.counts.stale > 0 || r.counts.missing > 0);
  const edited = report.filter((r) => r.counts.modified > 0);

  if (!asJson) {
    if (groups.length === 0) {
      // Not a silent pass: say plainly that there was nothing to check, so a
      // clean run on a box with no groups is never mistaken for a verified one.
      console.log('No per-group agent-runner copies under data/v2-sessions/ — nothing to check.');
      return 0;
    }
    for (const r of report) {
      const c = r.counts;
      const flag = c.stale > 0 || c.missing > 0 ? 'STALE' : 'ok   ';
      console.log(
        `${flag} ${r.groupId}  current=${c.current} stale=${c.stale} missing=${c.missing} ` +
          `modified=${c.modified} extra=${c.extra}`,
      );
      for (const f of r.files) {
        if (f.cls === 'current' || f.cls === 'extra') continue;
        console.log(`        ${f.cls.padEnd(8)} ${f.file}`);
      }
      if (r.refreshed.length > 0) {
        console.log(`        → refreshed ${r.refreshed.length} file(s) from this checkout`);
      }
    }
    console.log();

    if (edited.length > 0) {
      console.log(`${edited.length} group(s) carry locally-MODIFIED runner files. These are never`);
      console.log('overwritten automatically — a builder agent or an install skill wrote them.');
      console.log('Review them by hand and reconcile deliberately.');
      console.log();
    }

    if (behind.length === 0) {
      console.log(`ok: all ${groups.length} group(s) run this checkout's agent-runner source.`);
    } else {
      console.log(`::error::${behind.length} group(s) are running STALE agent-runner code.`);
      console.log('Every merged fix under container/agent-runner/src/ is inert for them.');
      console.log();
      console.log('Refresh the provably-safe files (stale + missing only):');
      console.log('  pnpm run check:runner-staleness -- --refresh');
      console.log();
      console.log('Then restart the affected groups so containers remount the copy:');
      console.log('  ncl groups restart --id <group-id>');
    }
  }

  return behind.length > 0 ? EXIT_STALE_FOUND : 0;
}

process.exit(main(process.argv.slice(2)));
