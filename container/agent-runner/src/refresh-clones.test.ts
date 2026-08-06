import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  FETCH_TTL_MS,
  LOCK_STALE_MS,
  REFRESH_LOCK,
  REFRESH_STAMP,
  acquireLock,
  isPrimaryClone,
  refreshPrimaryClones,
  releaseLock,
  shouldRefresh,
} from './refresh-clones.js';

/** A throwaway directory shaped like a primary clone (`.git` is a directory). */
function makeClone(): string {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-clone-'));
  fs.mkdirSync(path.join(base, '.git'));
  return base;
}

function stampPath(clone: string): string {
  return path.join(clone, '.git', REFRESH_STAMP);
}

function lockMtime(clone: string): number {
  return fs.statSync(path.join(clone, '.git', REFRESH_LOCK)).mtimeMs;
}

describe('shouldRefresh (recency guard)', () => {
  const now = 1_000_000_000_000;
  it('refreshes when never successfully refreshed (no stamp)', () => {
    expect(shouldRefresh(null, now)).toBe(true);
  });
  it('skips when refreshed within the TTL (concurrent-boot storm guard)', () => {
    expect(shouldRefresh(now - (FETCH_TTL_MS - 1), now)).toBe(false);
  });
  it('refreshes when the last success is older than the TTL', () => {
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

describe('acquireLock (mutual exclusion)', () => {
  // Real-clock base on purpose: staleness compares the injected `nowMs` against
  // the lock directory's REAL mtime, so a fabricated epoch (e.g. 2001) makes the
  // age negative and the arithmetic meaningless. In production `nowMs` is
  // `Date.now()`, so the test has to sit on the same clock the filesystem uses.
  const now = Date.now();
  it('first caller wins, second is refused', () => {
    const clone = makeClone();
    try {
      expect(acquireLock(clone, now)).toBe(true);
      expect(acquireLock(clone, now)).toBe(false);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });
  it('releasing lets the next caller in', () => {
    const clone = makeClone();
    try {
      expect(acquireLock(clone, now)).toBe(true);
      releaseLock(clone);
      expect(acquireLock(clone, now)).toBe(true);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });
  it('breaks a lock left behind by a container killed mid-refresh', () => {
    const clone = makeClone();
    try {
      expect(acquireLock(clone, now)).toBe(true);
      // Derive from the lock's OWN mtime, not from a captured `now`: the
      // directory is created some milliseconds after `now` is read, and that
      // drift is exactly the width of the staleness boundary being tested.
      expect(acquireLock(clone, lockMtime(clone) + LOCK_STALE_MS + 1)).toBe(true);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });
  it('does NOT break a lock merely held by a slow-but-live refresh', () => {
    const clone = makeClone();
    try {
      expect(acquireLock(clone, now)).toBe(true);
      expect(acquireLock(clone, lockMtime(clone) + LOCK_STALE_MS - 1)).toBe(false);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });
});

describe('refreshPrimaryClones', () => {
  const now = 1_000_000_000_000;

  it('stamps success only after BOTH pull and submodule update finish', () => {
    const clone = makeClone();
    try {
      const calls: string[][] = [];
      const refreshed = refreshPrimaryClones([clone], {
        nowMs: now,
        git: (_d, args) => {
          calls.push(args);
        },
      });
      expect(refreshed).toEqual([clone]);
      expect(calls[0][0]).toBe('pull');
      expect(calls[1][0]).toBe('submodule');
      expect(fs.existsSync(stampPath(clone))).toBe(true);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });

  // The F16 defect, directly: the pull advances, submodules fail. Previously the
  // pull's own FETCH_HEAD went fresh and suppressed retries for 30 minutes while
  // the submodules stayed stale.
  it('does NOT stamp when the pull advances but the submodule update fails', () => {
    const clone = makeClone();
    try {
      const log: string[] = [];
      const refreshed = refreshPrimaryClones([clone], {
        nowMs: now,
        log: (m) => log.push(m),
        git: (_d, args) => {
          if (args[0] === 'submodule') throw new Error('submodule fetch failed');
        },
      });
      expect(refreshed).toEqual([]);
      expect(fs.existsSync(stampPath(clone))).toBe(false);
      expect(log.join('\n')).toContain('submodule update FAILED');
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });

  it('retries on the very next boot after a partial refresh (no TTL masking)', () => {
    const clone = makeClone();
    try {
      // Boot 1: submodules fail → no stamp.
      refreshPrimaryClones([clone], {
        nowMs: now,
        git: (_d, args) => {
          if (args[0] === 'submodule') throw new Error('nope');
        },
      });
      expect(fs.existsSync(stampPath(clone))).toBe(false);

      // Boot 2, one second later — well inside the 30-minute TTL. The old code
      // skipped here because git had already refreshed FETCH_HEAD.
      const calls: string[][] = [];
      const refreshed = refreshPrimaryClones([clone], {
        nowMs: now + 1000,
        git: (_d, args) => {
          calls.push(args);
        },
      });
      expect(refreshed).toEqual([clone]);
      expect(calls.map((c) => c[0])).toEqual(['pull', 'submodule']);
      expect(fs.existsSync(stampPath(clone))).toBe(true);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });

  it('does not stamp or run submodules when the pull itself fails', () => {
    const clone = makeClone();
    try {
      const calls: string[][] = [];
      const refreshed = refreshPrimaryClones([clone], {
        nowMs: now,
        git: (_d, args) => {
          calls.push(args);
          if (args[0] === 'pull') throw new Error('non-fast-forward');
        },
      });
      expect(refreshed).toEqual([]);
      expect(calls.map((c) => c[0])).toEqual(['pull']); // submodule never attempted
      expect(fs.existsSync(stampPath(clone))).toBe(false);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });

  // The other half of F16: 15 group containers boot at once. Exactly one should
  // touch the remote. Simulated by re-entering refreshPrimaryClones from inside
  // the git runner — precisely the interleaving the lock has to stop.
  it('only ONE of several simultaneous boots pulls (lock + re-check)', () => {
    const clone = makeClone();
    try {
      let pulls = 0;
      let reentered = 0;
      const inner = (): void => {
        // Nine more containers boot while the first one is mid-pull.
        for (let i = 0; i < 9; i++) {
          reentered++;
          refreshPrimaryClones([clone], {
            nowMs: now,
            git: (_d, a) => {
              if (a[0] === 'pull') pulls++;
            },
          });
        }
      };
      refreshPrimaryClones([clone], {
        nowMs: now,
        git: (_d, args) => {
          if (args[0] === 'pull') {
            pulls++;
            inner(); // contend for the lock while this pull is in flight
          }
        },
      });
      expect(reentered).toBe(9);
      expect(pulls).toBe(1);
      expect(fs.existsSync(stampPath(clone))).toBe(true);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });

  it('a boot arriving after another finished skips without pulling', () => {
    const clone = makeClone();
    try {
      // Someone else completed a refresh moments ago.
      fs.writeFileSync(stampPath(clone), 'x\n');
      let pulls = 0;
      const refreshed = refreshPrimaryClones([clone], {
        nowMs: now,
        git: (_d, a) => {
          if (a[0] === 'pull') pulls++;
        },
      });
      expect(refreshed).toEqual([]);
      expect(pulls).toBe(0);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });

  it('always releases the lock, even when git throws', () => {
    const clone = makeClone();
    try {
      refreshPrimaryClones([clone], {
        nowMs: now,
        git: () => {
          throw new Error('boom');
        },
      });
      expect(fs.existsSync(path.join(clone, '.git', REFRESH_LOCK))).toBe(false);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });

  it('skips linked worktrees entirely', () => {
    const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-wt-'));
    try {
      fs.writeFileSync(path.join(wt, '.git'), 'gitdir: /repo/.git/worktrees/x\n');
      let calls = 0;
      expect(
        refreshPrimaryClones([wt], {
          nowMs: now,
          git: () => {
            calls++;
          },
        }),
      ).toEqual([]);
      expect(calls).toBe(0);
    } finally {
      fs.rmSync(wt, { recursive: true, force: true });
    }
  });
});
