import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { FETCH_TTL_MS, isPrimaryClone, shouldRefresh } from './refresh-clones.js';

describe('shouldRefresh (recency guard)', () => {
  const now = 1_000_000_000_000;
  it('refreshes when never fetched (no FETCH_HEAD)', () => {
    expect(shouldRefresh(null, now)).toBe(true);
  });
  it('skips when fetched within the TTL (concurrent-boot storm guard)', () => {
    expect(shouldRefresh(now - (FETCH_TTL_MS - 1), now)).toBe(false);
  });
  it('refreshes when FETCH_HEAD is older than the TTL', () => {
    expect(shouldRefresh(now - (FETCH_TTL_MS + 1), now)).toBe(true);
  });
  it('refreshes exactly at the TTL boundary', () => {
    expect(shouldRefresh(now - FETCH_TTL_MS, now)).toBe(true);
  });
});

describe('isPrimaryClone', () => {
  it('true when .git is a directory (real clone)', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-clone-'));
    try {
      fs.mkdirSync(path.join(base, '.git'));
      expect(isPrimaryClone(base)).toBe(true);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
  it('false when .git is a file (linked worktree) — those must NOT be fetched', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-wt-'));
    try {
      fs.writeFileSync(path.join(base, '.git'), 'gitdir: /repo/.git/worktrees/x\n');
      expect(isPrimaryClone(base)).toBe(false);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
  it('false when there is no .git (plain dir, e.g. /workspace/agent)', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-plain-'));
    try {
      expect(isPrimaryClone(base)).toBe(false);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});
