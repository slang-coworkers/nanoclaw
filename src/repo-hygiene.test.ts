import { execFileSync } from 'child_process';

import { describe, expect, it } from 'vitest';

/**
 * The tracked tree carries no symlinks beyond the two the repo owns. A
 * worktree convenience link (a `node_modules` pointing at some absolute local
 * path) that slips into a commit breaks every fresh checkout — install tools
 * hit a self-referencing link before they can run.
 */
const ALLOWED_SYMLINKS = new Set(['AGENTS.md', '.agents/skills']);

describe('repo hygiene', () => {
  it('tracks no symlinks outside the allowlist', () => {
    // maxBuffer, not the 1 MiB default: this runs against the composed deploy
    // tree too, which is based on nv-coworkers (~22k tracked files, ~3.4 MB of
    // listing) rather than nv-main (~1.5k files, ~150 KB). The default silently
    // turned that into `spawnSync git ENOBUFS` in compose-check and nowhere
    // else, so the symlink guard never actually ran on the tree setup ships.
    const listing = execFileSync('git', ['ls-files', '-s'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const symlinks = listing
      .split('\n')
      .filter((line) => line.startsWith('120000'))
      .map((line) => line.split('\t')[1]);
    expect(symlinks.filter((path) => !ALLOWED_SYMLINKS.has(path))).toEqual([]);
  });
});
