/**
 * Keep a group's primary git clones fresh at container boot.
 *
 * Why: the SDK reads each additional directory's `.claude/agents/` + `CLAUDE.md`
 * from the PRIMARY clone's WORKING TREE (linked worktrees are skipped — see
 * additional-directories.ts). If the clone drifts stale the agent loads outdated
 * agent definitions / project memory, and worktrees branched from it start
 * behind `origin`. A boot-time refresh keeps both current.
 *
 * We use `git pull --ff-only` (not bare `fetch`): a plain fetch only advances
 * the remote-tracking refs, leaving the working-tree files the SDK actually
 * loads stale. `--ff-only` fetches AND fast-forwards the checked-out branch's
 * working tree — but ONLY when it is a clean fast-forward.
 *
 * Hard constraints (all group sessions SHARE one clone on disk — see the group
 * mount in container-runner.ts):
 *   - FAST-FORWARD ONLY. `--ff-only` refuses to merge/rebase and never touches
 *     the tree when the base has diverged or is dirty — so we never clobber
 *     local base state and never create a conflict. (Deliberately NOT
 *     `reset --hard`, which would destroy any uncommitted base state.)
 *   - WORKTREES ARE SAFE. Linked worktrees are independent checkouts (own HEAD,
 *     index, working tree); fast-forwarding the base clone's branch does not
 *     touch them — it only advances objects they already share.
 *   - MUTUAL EXCLUSION + RECENCY GUARD. A group restart boots 15+ containers of
 *     one group at once, all sharing the clone. Exactly one of them should
 *     refresh; the rest no-op. See the two notes below — this used to be true
 *     only by luck.
 *   - BEST-EFFORT. Never block or fail boot on a refresh problem (offline
 *     remote, token hiccup, non-FF, detached HEAD). Log and move on.
 *
 * TWO DEFECTS THIS FILE EXISTS TO NOT HAVE (F16 / #918):
 *
 * 1. CHECK-THEN-ACT WITH NO LOCK. The recency guard read `FETCH_HEAD`'s mtime
 *    and then ran `git pull`. Fifteen containers booting together all read the
 *    same stale mtime before any of them had written a new one, so all fifteen
 *    pulled at once — the opposite of "first refreshes, rest no-op". Now: take
 *    an exclusive per-clone lock FIRST, then RE-CHECK the recency guard inside
 *    it. The re-check is the whole point; without it the winner of the lock
 *    still refreshes something the previous holder just refreshed.
 *
 * 2. GIT'S OWN STAMP MASKED PARTIAL FAILURE. `FETCH_HEAD` is written by `git
 *    pull` as a side effect, so it went fresh the instant the pull succeeded —
 *    before submodules were updated. Pull and submodule update shared ONE try
 *    block, so if the pull advanced and the submodule update then failed, the
 *    catch reported a skipped refresh while the freshly written `FETCH_HEAD`
 *    made every subsequent boot skip for the next 30 minutes. A partially
 *    refreshed checkout, hidden by its own TTL, with stale submodules.
 *    Now: the two steps are tracked SEPARATELY and the recency guard reads OUR
 *    OWN stamp file, written only after BOTH succeed. A partial refresh leaves
 *    the stamp untouched, so the next boot retries instead of skipping.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const FETCH_TTL_MS = 30 * 60 * 1000; // 30 min — config drift is slow; don't refresh on every boot

/**
 * Success stamp. Deliberately NOT `.git/FETCH_HEAD`: that one is git's, written
 * mid-refresh, and it is what let a half-finished refresh look complete.
 * This one is ours and is touched only when pull AND submodules both finished.
 */
export const REFRESH_STAMP = 'nanoclaw-refresh-ok';

/** Exclusive per-clone lock. A directory because `mkdir` is atomic and fails
 *  with EEXIST if it already exists — no read-then-create window. */
export const REFRESH_LOCK = 'nanoclaw-refresh.lock';

/**
 * A lock older than this is assumed abandoned by a killed container rather than
 * held by a live one. Ceiling of the work it guards: 120s pull + 300s submodule
 * update, plus margin. Too low and we double-refresh; too high and one SIGKILLed
 * boot freezes refreshes for that long.
 */
export const LOCK_STALE_MS = 10 * 60 * 1000;

/**
 * Pure: is a clone due for a refresh? Due when never successfully refreshed (no
 * stamp) or the last SUCCESSFUL refresh is older than the TTL.
 * `nowMs`/`stampMtimeMs` injected for deterministic tests.
 */
export function shouldRefresh(stampMtimeMs: number | null, nowMs: number, ttlMs: number = FETCH_TTL_MS): boolean {
  if (stampMtimeMs === null) return true;
  return nowMs - stampMtimeMs >= ttlMs;
}

/** A primary clone is a directory whose `.git` is itself a directory (not a
 *  worktree gitdir-file, not absent). */
export function isPrimaryClone(dir: string): boolean {
  try {
    return fs.statSync(path.join(dir, '.git')).isDirectory();
  } catch {
    return false;
  }
}

function stampMtimeMs(clone: string): number | null {
  try {
    return fs.statSync(path.join(clone, '.git', REFRESH_STAMP)).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Take the per-clone lock. Returns true if acquired. Non-blocking on purpose:
 * if another booting container holds it, that container is already doing the
 * work, and the right move for this one is to carry on booting.
 */
export function acquireLock(clone: string, nowMs: number, staleMs: number = LOCK_STALE_MS): boolean {
  const lock = path.join(clone, '.git', REFRESH_LOCK);
  try {
    fs.mkdirSync(lock); // atomic: throws EEXIST if another boot holds it
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') return false;
  }
  // Held. Break it only if it is old enough to be an orphan from a container
  // that was killed mid-refresh, then retry the atomic create once.
  try {
    if (nowMs - fs.statSync(lock).mtimeMs < staleMs) return false;
    fs.rmSync(lock, { recursive: true, force: true });
    fs.mkdirSync(lock);
    return true;
  } catch {
    return false;
  }
}

export function releaseLock(clone: string): void {
  try {
    fs.rmSync(path.join(clone, '.git', REFRESH_LOCK), { recursive: true, force: true });
  } catch {
    /* best-effort — a stale lock is broken by the next boot after LOCK_STALE_MS */
  }
}

/** Injectable git runner so tests can drive failures without a real remote. */
export type GitRunner = (dir: string, args: string[], timeoutMs: number) => void;

const realGit: GitRunner = (dir, args, timeoutMs) => {
  execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore', timeout: timeoutMs });
};

/**
 * Fast-forward each primary clone in `dirs` that is due (per the recency guard).
 * Returns the list actually refreshed — meaning pull AND submodules both
 * completed. Side-effectful (runs git); the decision logic is factored into the
 * pure helpers above for testing. `log`/`nowMs`/`ttlMs`/`git` are injectable.
 */
export function refreshPrimaryClones(
  dirs: string[],
  opts: { log?: (m: string) => void; nowMs?: number; ttlMs?: number; git?: GitRunner; staleMs?: number } = {},
): string[] {
  const log = opts.log ?? (() => {});
  const nowMs = opts.nowMs ?? Date.now();
  const ttlMs = opts.ttlMs ?? FETCH_TTL_MS;
  const git = opts.git ?? realGit;
  const staleMs = opts.staleMs ?? LOCK_STALE_MS;
  const refreshed: string[] = [];

  for (const dir of dirs) {
    if (!isPrimaryClone(dir)) continue;
    // Cheap pre-check outside the lock: skips the common "already fresh" case
    // without touching the filesystem lock at all. It is only an optimisation —
    // the authoritative check is the re-check inside the lock below.
    if (!shouldRefresh(stampMtimeMs(dir), nowMs, ttlMs)) continue;

    if (!acquireLock(dir, nowMs, staleMs)) {
      log(`Clone refresh for ${dir} skipped: another boot holds the refresh lock`);
      continue;
    }

    try {
      // RE-CHECK inside the lock. Between the pre-check and acquiring the lock,
      // another container may have completed the whole refresh and released.
      // Without this, every one of 15 simultaneous boots still refreshes, just
      // in a queue instead of in parallel.
      if (!shouldRefresh(stampMtimeMs(dir), nowMs, ttlMs)) {
        log(`Clone refresh for ${dir} skipped: another boot refreshed it while we waited`);
        continue;
      }

      // Step 1 — fetch + fast-forward the checked-out branch. `--ff-only` makes
      // this a no-op (non-zero exit → caught) when the base isn't a clean FF, so
      // we never merge, rebase, or clobber. Bounded so a hung remote can't stall
      // boot indefinitely.
      let pulled = false;
      try {
        git(dir, ['pull', '--ff-only', '--quiet'], 120_000);
        pulled = true;
      } catch (err) {
        log(`Clone pull failed for ${dir}: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (!pulled) continue; // stamp untouched → next boot retries

      // Step 2 — Slang (and slang-rhi) carry submodules; a FF that moved
      // submodule pointers leaves the submodule working trees behind until
      // synced. --init picks up newly-added submodules; --recursive covers
      // nested ones. Tracked separately from the pull ON PURPOSE: this is the
      // step whose failure used to be hidden behind a fresh FETCH_HEAD.
      let submodulesUpdated = false;
      try {
        git(dir, ['submodule', 'update', '--init', '--recursive', '--quiet'], 300_000);
        submodulesUpdated = true;
      } catch (err) {
        log(
          `Clone submodule update FAILED for ${dir} after the pull advanced — ` +
            `checkout is partially refreshed and will be retried on the next boot ` +
            `(not stamped): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (!submodulesUpdated) continue; // stamp untouched → next boot retries

      // Both steps done — only now is the refresh complete enough to suppress
      // the next 30 minutes of boots.
      try {
        fs.writeFileSync(path.join(dir, '.git', REFRESH_STAMP), `${new Date(nowMs).toISOString()}\n`);
      } catch (err) {
        // Refresh really did happen; we just cannot record it. Say so — the
        // consequence is repeated refreshes, not a stale checkout.
        log(`Clone refreshed ${dir} but could not write the stamp: ${err instanceof Error ? err.message : String(err)}`);
      }
      refreshed.push(dir);
      log(`Refreshed primary clone ${dir}`);
    } finally {
      releaseLock(dir);
    }
  }
  return refreshed;
}
