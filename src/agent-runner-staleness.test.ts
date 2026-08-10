/**
 * Tests for the agent-runner staleness classifier.
 *
 * The check itself needs no live install: it is a function over two directory
 * trees plus a provenance oracle. These build both from scratch, and build a
 * REAL git repository for the oracle so the "is this content known to git"
 * property is exercised for real rather than mocked into always agreeing.
 *
 * What is NOT covered here, stated rather than implied: nothing asserts that a
 * running container picks up a refreshed file. That needs a live install with a
 * container runtime, and no test in this repo does it.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  applySafeRefresh,
  classifyCopy,
  findGroupCopies,
  gitKnownBlobs,
  listFiles,
  summarize,
  type FileFinding,
} from './agent-runner-staleness.js';

function withTmp<T>(fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-stale-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function write(root: string, rel: string, body: string): void {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

/**
 * A repo whose agent-runner source has EVOLVED: `poll-loop.ts` was committed as
 * v1, then fixed to v2. That makes v1 an old-but-known blob — exactly the shape
 * of a group created before a fix landed.
 */
function repoWithHistory(root: string): { repo: string; srcDir: string } {
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main', '.');
  const srcRel = path.join('container', 'agent-runner', 'src');
  write(repo, path.join(srcRel, 'poll-loop.ts'), 'v1 — the silent-turn bug\n');
  write(repo, path.join(srcRel, 'index.ts'), 'entry\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'v1');
  write(repo, path.join(srcRel, 'poll-loop.ts'), 'v2 — silent turn acked\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'v2 (the merged fix)');
  return { repo, srcDir: path.join(repo, srcRel) };
}

describe('agent-runner staleness — classification', () => {
  it('calls an old committed version STALE, not modified', () => {
    withTmp((root) => {
      const { repo, srcDir } = repoWithHistory(root);
      // The group was created at v1 and never refreshed.
      const copy = path.join(root, 'copy');
      write(copy, 'poll-loop.ts', 'v1 — the silent-turn bug\n');
      write(copy, 'index.ts', 'entry\n');

      const files = classifyCopy(srcDir, copy, gitKnownBlobs(repo));
      const byName = Object.fromEntries(files.map((f) => [f.file, f.cls]));
      expect(byName['poll-loop.ts']).toBe('stale');
      expect(byName['index.ts']).toBe('current');
    });
  });

  it('calls content git has never seen MODIFIED, so it is never auto-overwritten', () => {
    withTmp((root) => {
      const { repo, srcDir } = repoWithHistory(root);
      const copy = path.join(root, 'copy');
      // A builder agent edited the group's runner (self-customize workflow).
      write(copy, 'poll-loop.ts', 'v2 — silent turn acked\n// local: extra logging\n');
      write(copy, 'index.ts', 'entry\n');

      const files = classifyCopy(srcDir, copy, gitKnownBlobs(repo));
      const byName = Object.fromEntries(files.map((f) => [f.file, f.cls]));
      expect(byName['poll-loop.ts']).toBe('modified');
    });
  });

  it('a file added upstream after the group was created is MISSING', () => {
    withTmp((root) => {
      const { repo, srcDir } = repoWithHistory(root);
      write(repo, path.join('container', 'agent-runner', 'src', 'new-module.ts'), 'new\n');
      git(repo, 'add', '-A');
      git(repo, 'commit', '-qm', 'add a module');

      const copy = path.join(root, 'copy');
      write(copy, 'poll-loop.ts', 'v2 — silent turn acked\n');
      write(copy, 'index.ts', 'entry\n');

      const byName = Object.fromEntries(classifyCopy(srcDir, copy, gitKnownBlobs(repo)).map((f) => [f.file, f.cls]));
      expect(byName['new-module.ts']).toBe('missing');
    });
  });

  it('a file only the group has is EXTRA — an install skill wrote it', () => {
    withTmp((root) => {
      const { repo, srcDir } = repoWithHistory(root);
      const copy = path.join(root, 'copy');
      write(copy, 'poll-loop.ts', 'v2 — silent turn acked\n');
      write(copy, 'index.ts', 'entry\n');
      // /add-opencode copies provider files straight into the group overlay.
      write(copy, 'providers/opencode.ts', 'opencode provider\n');

      const byName = Object.fromEntries(classifyCopy(srcDir, copy, gitKnownBlobs(repo)).map((f) => [f.file, f.cls]));
      expect(byName['providers/opencode.ts']).toBe('extra');
    });
  });

  it('degrades to MODIFIED when git cannot answer, rather than guessing stale', () => {
    withTmp((root) => {
      const { srcDir } = repoWithHistory(root);
      const copy = path.join(root, 'copy');
      write(copy, 'poll-loop.ts', 'v1 — the silent-turn bug\n');
      write(copy, 'index.ts', 'entry\n');

      // Point the oracle at a directory that is not a git repository at all —
      // the shallow-clone / pruned-objects case. It must not claim provenance.
      const notARepo = path.join(root, 'not-a-repo');
      fs.mkdirSync(notARepo);
      const byName = Object.fromEntries(
        classifyCopy(srcDir, copy, gitKnownBlobs(notARepo)).map((f) => [f.file, f.cls]),
      );
      expect(byName['poll-loop.ts']).toBe('modified');
    });
  });
});

describe('agent-runner staleness — refresh is safe by construction', () => {
  it('refreshes stale and missing, and leaves modified and extra untouched', () => {
    withTmp((root) => {
      const { repo, srcDir } = repoWithHistory(root);
      write(repo, path.join('container', 'agent-runner', 'src', 'added.ts'), 'added upstream\n');
      git(repo, 'add', '-A');
      git(repo, 'commit', '-qm', 'add');

      const copy = path.join(root, 'copy');
      write(copy, 'poll-loop.ts', 'v1 — the silent-turn bug\n'); // stale
      write(copy, 'index.ts', 'HAND EDITED\n'); // modified
      write(copy, 'providers/opencode.ts', 'opencode provider\n'); // extra
      // 'added.ts' absent → missing

      const files = classifyCopy(srcDir, copy, gitKnownBlobs(repo));
      const written = applySafeRefresh(srcDir, copy, files);

      expect(written.sort()).toEqual(['added.ts', 'poll-loop.ts']);
      // The merged fix is now what the group would mount.
      expect(fs.readFileSync(path.join(copy, 'poll-loop.ts'), 'utf-8')).toBe('v2 — silent turn acked\n');
      expect(fs.readFileSync(path.join(copy, 'added.ts'), 'utf-8')).toBe('added upstream\n');
      // …and nobody's work was destroyed to get there.
      expect(fs.readFileSync(path.join(copy, 'index.ts'), 'utf-8')).toBe('HAND EDITED\n');
      expect(fs.readFileSync(path.join(copy, 'providers/opencode.ts'), 'utf-8')).toBe('opencode provider\n');
    });
  });

  it('is idempotent — a second pass writes nothing', () => {
    withTmp((root) => {
      const { repo, srcDir } = repoWithHistory(root);
      const copy = path.join(root, 'copy');
      write(copy, 'poll-loop.ts', 'v1 — the silent-turn bug\n');
      write(copy, 'index.ts', 'entry\n');

      applySafeRefresh(srcDir, copy, classifyCopy(srcDir, copy, gitKnownBlobs(repo)));
      const second = applySafeRefresh(srcDir, copy, classifyCopy(srcDir, copy, gitKnownBlobs(repo)));
      expect(second).toEqual([]);
    });
  });

  it('never writes a class outside the safe set, even if asked', () => {
    withTmp((root) => {
      const { srcDir } = repoWithHistory(root);
      const copy = path.join(root, 'copy');
      write(copy, 'poll-loop.ts', 'local\n');
      // Hand it findings that claim everything needs writing.
      const hostile: FileFinding[] = [
        { file: 'poll-loop.ts', cls: 'modified' },
        { file: 'index.ts', cls: 'extra' },
        { file: 'index.ts', cls: 'current' },
      ];
      expect(applySafeRefresh(srcDir, copy, hostile)).toEqual([]);
      expect(fs.readFileSync(path.join(copy, 'poll-loop.ts'), 'utf-8')).toBe('local\n');
    });
  });
});

describe('agent-runner staleness — discovery and summary', () => {
  it('finds only group dirs that actually carry a runner copy', () => {
    withTmp((root) => {
      const data = path.join(root, 'data');
      write(data, 'v2-sessions/group-a/agent-runner-src/index.ts', 'x\n');
      write(data, 'v2-sessions/group-b/agent-runner-src/index.ts', 'x\n');
      // A group with sessions but no runner copy — nothing to be stale about.
      fs.mkdirSync(path.join(data, 'v2-sessions', 'group-c'), { recursive: true });

      expect(findGroupCopies(data).map((g) => g.groupId)).toEqual(['group-a', 'group-b']);
    });
  });

  it('returns nothing rather than throwing when there are no sessions at all', () => {
    withTmp((root) => {
      expect(findGroupCopies(path.join(root, 'nope'))).toEqual([]);
    });
  });

  it('counts every class', () => {
    const counts = summarize([
      { file: 'a', cls: 'stale' },
      { file: 'b', cls: 'stale' },
      { file: 'c', cls: 'current' },
      { file: 'd', cls: 'modified' },
    ]);
    expect(counts).toEqual({ current: 1, stale: 2, modified: 1, missing: 0, extra: 0 });
  });

  it('walks nested directories', () => {
    withTmp((root) => {
      write(root, 'a.ts', '1');
      write(root, 'deep/b.ts', '2');
      write(root, 'deep/deeper/c.ts', '3');
      expect(listFiles(root)).toEqual(['a.ts', 'deep/b.ts', 'deep/deeper/c.ts']);
    });
  });
});
