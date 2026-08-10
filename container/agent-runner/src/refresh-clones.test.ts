import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

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

/**
 * Who owns the lease according to the bytes on disk.
 *
 * Read here rather than imported from the module on purpose: these assertions
 * have to be runnable against the PRE-FIX tree, where the lock is a directory
 * with no owner at all. Importing a helper that only exists post-fix would turn
 * a behavioural failure into a module-load error, which proves nothing.
 */
function ownerOnDisk(clone: string): string | null {
  try {
    const p = path.join(clone, '.git', REFRESH_LOCK);
    if (fs.statSync(p).isDirectory()) return null;
    const doc = JSON.parse(fs.readFileSync(p, 'utf-8')) as { token?: string };
    return typeof doc.token === 'string' ? doc.token : null;
  } catch {
    return null;
  }
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
  // the lock file's REAL mtime, so a fabricated epoch (e.g. 2001) makes the
  // age negative and the arithmetic meaningless. In production `nowMs` is
  // `Date.now()`, so the test has to sit on the same clock the filesystem uses.
  const now = Date.now();
  it('first caller wins, second is refused', () => {
    const clone = makeClone();
    try {
      expect(acquireLock(clone, now)).toBeTruthy();
      expect(acquireLock(clone, now)).toBeNull();
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });
  it('the acquired token is what is actually written into the lease', () => {
    const clone = makeClone();
    try {
      const token = acquireLock(clone, now)!;
      expect(token).toBeTruthy();
      expect(ownerOnDisk(clone)).toBe(token);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });
  it('releasing lets the next caller in', () => {
    const clone = makeClone();
    try {
      const token = acquireLock(clone, now)!;
      releaseLock(clone, token);
      expect(acquireLock(clone, now)).toBeTruthy();
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });
  it('breaks a lock left behind by a container killed mid-refresh', () => {
    const clone = makeClone();
    try {
      expect(acquireLock(clone, now)).toBeTruthy();
      // Derive from the lock's OWN mtime, not from a captured `now`: the
      // file is created some milliseconds after `now` is read, and that
      // drift is exactly the width of the staleness boundary being tested.
      expect(acquireLock(clone, lockMtime(clone) + LOCK_STALE_MS + 1)).toBeTruthy();
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });
  it('does NOT break a lock merely held by a slow-but-live refresh', () => {
    const clone = makeClone();
    try {
      expect(acquireLock(clone, now)).toBeTruthy();
      expect(acquireLock(clone, lockMtime(clone) + LOCK_STALE_MS - 1)).toBeNull();
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });
  it('reclaims a pre-lease DIRECTORY lock once it is stale, and not before', () => {
    // Compatibility with a container still running the old image, which took
    // the lock by `mkdir`. It carries no token, so age is the only thing it can
    // be judged by — exactly the old rule, and only after LOCK_STALE_MS.
    const clone = makeClone();
    try {
      const lock = path.join(clone, '.git', REFRESH_LOCK);
      fs.mkdirSync(lock);
      expect(acquireLock(clone, lockMtime(clone) + LOCK_STALE_MS - 1)).toBeNull();
      const token = acquireLock(clone, lockMtime(clone) + LOCK_STALE_MS + 1);
      expect(token).toBeTruthy();
      expect(fs.statSync(lock).isDirectory()).toBe(false);
      expect(ownerOnDisk(clone)).toBe(token!);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });
});

describe('releaseLock (ownership is the token, not the path)', () => {
  const now = Date.now();

  it('a slow holder whose lease was reclaimed does NOT delete the new owner’s lease', () => {
    // Step 5 of the F16 interleaving. A ran long, B judged it dead and took
    // over; A then finished and released. Unconditional deletion here strips a
    // live owner's lease and hands the clone to a third contender while B is
    // still pulling.
    const clone = makeClone();
    try {
      const slow = acquireLock(clone, now)!;
      const reclaimer = acquireLock(clone, lockMtime(clone) + LOCK_STALE_MS + 1)!;
      expect(reclaimer).not.toBe(slow);

      releaseLock(clone, slow); // the straggler finally finishes

      expect(ownerOnDisk(clone)).toBe(reclaimer);
      expect(acquireLock(clone, now)).toBeNull(); // still excluded, as it must be
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });

  it('releasing with the right token frees the clone', () => {
    const clone = makeClone();
    try {
      const token = acquireLock(clone, now)!;
      releaseLock(clone, token);
      expect(fs.existsSync(path.join(clone, '.git', REFRESH_LOCK))).toBe(false);
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  });
});

describe('stale reclamation under REAL concurrency', () => {
  // The existing coverage breaks stale locks SEQUENTIALLY, which cannot see the
  // defect: the whole point is that two breakers both pass the staleness check
  // before either acts. This spawns real OS processes that block on a shared
  // start deadline and then contend for the same stale lease.
  const CONTENDERS = 6;
  const ROUNDS = 120;
  /** Gap between round barriers. Generous next to the microseconds of work. */
  const SLOT_MS = 15;

  /**
   * A child process that contends for one stale lease per round.
   *
   * The module is imported BEFORE the first barrier so interpreter startup —
   * tens of milliseconds, far wider than the window being tested — is spent
   * before any round begins. Each round then releases on a shared wall-clock
   * deadline, so all six processes enter the reclaim path within microseconds
   * of one another. Rounds are batched into one spawn because the contention
   * window is only a few syscalls wide: catching it needs many attempts, and
   * paying process startup per attempt would make that unaffordable.
   */
  function writeContender(dir: string): string {
    const file = path.join(dir, 'contend.ts');
    fs.writeFileSync(
      file,
      `import fs from 'fs';
import path from 'path';
const [, , mod, rounds, count, startAt, slot, winners] = process.argv;
const { acquireLock } = await import(mod);
for (let k = 0; k < Number(count); k++) {
  const at = Number(startAt) + k * Number(slot);
  while (Date.now() < at) { /* spin to this round's barrier */ }
  const got = acquireLock(path.join(rounds, String(k)), Date.now(), 1000);
  if (got) fs.appendFileSync(path.join(winners, String(k)), String(got) + '\\n');
}
`,
    );
    return file;
  }

  it('exactly ONE of several simultaneous breakers takes a stale lease', async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-race-'));
    const roundsDir = path.join(scratch, 'rounds');
    const winnersDir = path.join(scratch, 'winners');
    fs.mkdirSync(roundsDir);
    fs.mkdirSync(winnersDir);
    const contender = writeContender(scratch);
    const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), 'refresh-clones.ts');

    try {
      // One clone per round, each already holding an ABANDONED lease: present,
      // and old enough that every contender independently judges it stale
      // before any of them acts. That shared judgement is the precondition of
      // the defect — the old break path was `rmSync` + `mkdir`, which every
      // contender could complete "successfully".
      for (let k = 0; k < ROUNDS; k++) {
        const clone = path.join(roundsDir, String(k));
        fs.mkdirSync(path.join(clone, '.git'), { recursive: true });
        const lock = path.join(clone, '.git', REFRESH_LOCK);
        fs.writeFileSync(lock, JSON.stringify({ token: `abandoned-by-a-killed-container-${k}` }));
        const old = Date.now() / 1000 - 60;
        fs.utimesSync(lock, old, old);
        fs.writeFileSync(path.join(winnersDir, String(k)), '');
      }

      const startAt = Date.now() + 1500; // every child is spinning well before this
      const kids = Array.from({ length: CONTENDERS }, () =>
        Bun.spawn({
          cmd: [
            process.execPath,
            contender,
            mod,
            roundsDir,
            String(ROUNDS),
            String(startAt),
            String(SLOT_MS),
            winnersDir,
          ],
          stdout: 'ignore',
          stderr: 'inherit',
        }),
      );
      await Promise.all(kids.map((k) => k.exited));

      const multiWinner: Array<{ round: number; winners: string[] }> = [];
      const wrongOwner: number[] = [];
      for (let k = 0; k < ROUNDS; k++) {
        const won = fs
          .readFileSync(path.join(winnersDir, String(k)), 'utf-8')
          .split('\n')
          .filter((l) => l.trim());
        if (won.length !== 1) multiWinner.push({ round: k, winners: won });
        else if (ownerOnDisk(path.join(roundsDir, String(k))) !== won[0]) wrongOwner.push(k);
      }

      // The defect, stated: pre-fix several contenders each removed the stale
      // lock and created their own, so more than one believed it held the
      // clone and only the last writer's lock was left standing.
      expect(multiWinner).toEqual([]);
      // …and in every round the lease on disk belongs to that single winner.
      expect(wrongOwner).toEqual([]);
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  }, 120_000);
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
