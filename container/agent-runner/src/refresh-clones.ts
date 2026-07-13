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
 *   - RECENCY GUARD. A group restart boots 15+ containers of one group at once,
 *     all sharing the clone. Skip when `FETCH_HEAD` was written within the TTL
 *     so the simultaneous boots don't storm the remote or churn the tree; the
 *     first boot refreshes, the rest no-op.
 *   - BEST-EFFORT. Never block or fail boot on a refresh problem (offline
 *     remote, token hiccup, non-FF, detached HEAD). Log and move on.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const FETCH_TTL_MS = 30 * 60 * 1000; // 30 min — config drift is slow; don't refresh on every boot

/**
 * Pure: is a clone due for a refresh? Due when never fetched (no FETCH_HEAD) or
 * its FETCH_HEAD is older than the TTL. `nowMs`/`fetchHeadMtimeMs` injected for
 * deterministic tests.
 */
export function shouldRefresh(
  fetchHeadMtimeMs: number | null,
  nowMs: number,
  ttlMs: number = FETCH_TTL_MS,
): boolean {
  if (fetchHeadMtimeMs === null) return true;
  return nowMs - fetchHeadMtimeMs >= ttlMs;
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

function fetchHeadMtimeMs(clone: string): number | null {
  try {
    return fs.statSync(path.join(clone, '.git', 'FETCH_HEAD')).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Fast-forward each primary clone in `dirs` that is due (per the recency guard).
 * Returns the list actually refreshed. Side-effectful (runs git); the decision
 * logic is factored into the pure helpers above for testing. `log`/`nowMs`/
 * `ttlMs` are injectable.
 */
export function refreshPrimaryClones(
  dirs: string[],
  opts: { log?: (m: string) => void; nowMs?: number; ttlMs?: number } = {},
): string[] {
  const log = opts.log ?? (() => {});
  const nowMs = opts.nowMs ?? Date.now();
  const ttlMs = opts.ttlMs ?? FETCH_TTL_MS;
  const refreshed: string[] = [];
  for (const dir of dirs) {
    if (!isPrimaryClone(dir)) continue;
    if (!shouldRefresh(fetchHeadMtimeMs(dir), nowMs, ttlMs)) continue;
    try {
      // Fetch + fast-forward the checked-out branch. `--ff-only` makes this a
      // no-op (non-zero exit → caught) when the base isn't a clean FF, so we
      // never merge, rebase, or clobber. Bounded so a hung remote can't stall
      // boot indefinitely.
      execFileSync('git', ['-C', dir, 'pull', '--ff-only', '--quiet'], {
        stdio: 'ignore',
        timeout: 120_000,
      });
      // Slang (and slang-rhi) carry submodules; a FF that moved submodule
      // pointers leaves the submodule working trees behind until synced.
      // --init picks up newly-added submodules; --recursive covers nested ones.
      execFileSync('git', ['-C', dir, 'submodule', 'update', '--init', '--recursive', '--quiet'], {
        stdio: 'ignore',
        timeout: 300_000,
      });
      refreshed.push(dir);
      log(`Refreshed primary clone ${dir}`);
    } catch (err) {
      // Best-effort: offline remote / token hiccup / non-FF / dirty tree must
      // not block boot. The clone stays at its last-known state.
      log(`Clone refresh skipped for ${dir}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return refreshed;
}
