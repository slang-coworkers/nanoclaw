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
import { randomUUID } from 'crypto';
import fs from 'fs';
import { hostname } from 'os';
import path from 'path';

export const FETCH_TTL_MS = 30 * 60 * 1000; // 30 min — config drift is slow; don't refresh on every boot

/**
 * Success stamp. Deliberately NOT `.git/FETCH_HEAD`: that one is git's, written
 * mid-refresh, and it is what let a half-finished refresh look complete.
 * This one is ours and is touched only when pull AND submodules both finished.
 */
export const REFRESH_STAMP = 'nanoclaw-refresh-ok';

/**
 * Exclusive per-clone LEASE. A regular file, published by `link()` so it appears
 * atomically and already carrying its owner token — see acquireLock for why the
 * token, rather than the file's mere existence, is what ownership means.
 */
export const REFRESH_LOCK = 'nanoclaw-refresh.lock';

/**
 * A lease older than this is assumed abandoned by a killed container rather than
 * held by a live one. Ceiling of the work it guards: 120s pull + 300s submodule
 * update, plus margin. Too low and we double-refresh; too high and one SIGKILLed
 * boot freezes refreshes for that long.
 */
export const LOCK_STALE_MS = 10 * 60 * 1000;

/** How many times acquireLock re-tries after losing a reclaim race. */
const ACQUIRE_ATTEMPTS = 3;

/**
 * What is written inside the lease file.
 *
 * `token` is a fresh random id per acquisition and is the ONLY thing ownership
 * is decided by. Deliberately NOT a pid: these clones are shared between
 * containers (the group mount in container-runner.ts), and pids are per-PID-
 * namespace — container A's pid 41 and container B's pid 41 are different
 * processes that a pid check would call the same owner. `pid` and `host` are
 * recorded for a human reading the file during an incident, never compared.
 */
interface LeaseDoc {
  token: string;
  acquired_at: string;
  pid: number;
  host: string;
}

/** What is at the lease path right now. */
type LeaseState =
  | { kind: 'absent' }
  | { kind: 'lease'; token: string; mtimeMs: number }
  /** A file we cannot parse — a torn write from a foreign writer. Unownable. */
  | { kind: 'opaque'; mtimeMs: number }
  /** A DIRECTORY: the pre-lease lock format. See the compatibility note below. */
  | { kind: 'legacy-dir'; mtimeMs: number };

/** A lock that is actually there — the only thing reclamation can act on. */
type PresentLease = Exclude<LeaseState, { kind: 'absent' }>;

/**
 * Read the lease, taking its token and its mtime FROM THE SAME INODE.
 *
 * This is not fussiness. Stat-then-read by path can straddle a reclamation and
 * return a pair that never existed: the OLD lease's mtime with the NEW lease's
 * token. A contender holding that pair judges a lease that is seconds old to be
 * ten minutes stale, and every downstream guard then works perfectly on a
 * premise that is false — including the reclaim claim, which would be keyed on
 * the live owner's token and so exclude nobody. Measured, that produced two
 * simultaneous owners in roughly 1 round in 200 of the concurrency test below.
 *
 * Opening once and using `fstat` on that descriptor makes the pair consistent
 * by construction: both describe the file the descriptor points at, whatever
 * has since been linked over the path.
 */
function readLeaseState(lockPath: string): LeaseState {
  let st: fs.Stats;
  try {
    st = fs.statSync(lockPath);
  } catch {
    return { kind: 'absent' };
  }
  // Directories are the pre-lease format; this code never writes one, so there
  // is no replace-under-us hazard and the path stat is enough.
  if (st.isDirectory()) return { kind: 'legacy-dir', mtimeMs: st.mtimeMs };

  let fd: number;
  try {
    fd = fs.openSync(lockPath, 'r');
  } catch {
    return { kind: 'absent' }; // vanished between the stat and the open
  }
  try {
    const mtimeMs = fs.fstatSync(fd).mtimeMs;
    try {
      const doc = JSON.parse(fs.readFileSync(fd, 'utf-8')) as LeaseDoc;
      if (typeof doc.token === 'string' && doc.token) return { kind: 'lease', token: doc.token, mtimeMs };
    } catch {
      /* falls through to opaque */
    }
    return { kind: 'opaque', mtimeMs };
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      /* nothing useful to do */
    }
  }
}

/** The token currently written at the lease path, if any. Exported for tests. */
export function leaseOwner(clone: string): string | null {
  const s = readLeaseState(path.join(clone, '.git', REFRESH_LOCK));
  return s.kind === 'lease' ? s.token : null;
}

/**
 * Publish a fully-formed lease at `lockPath`, atomically. Returns false if
 * someone else already holds it.
 *
 * `link()` rather than `writeFileSync(..., {flag:'wx'})`: `wx` is an atomic
 * CREATE, but the content lands in a second syscall, so a concurrent reader can
 * observe a zero-length lease and mistake a live owner for a torn file. The
 * temp is written and fsynced first, then linked into place — so the lease is
 * never visible without its token.
 */
function publishLease(lockPath: string, doc: LeaseDoc): boolean {
  const tmp = `${lockPath}.new-${doc.token}`;
  try {
    const fd = fs.openSync(tmp, 'wx');
    try {
      fs.writeSync(fd, JSON.stringify(doc));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false; // cannot even stage — treat as "not acquired"
  }
  try {
    fs.linkSync(tmp, lockPath); // atomic; EEXIST if another boot holds the lease
    return true;
  } catch {
    return false;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* the link succeeded or the tmp is already gone */
    }
  }
}

function rmQuiet(p: string): void {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {
    /* best-effort; anything left behind is swept by sweepLeaseLitter */
  }
}

/**
 * A name identifying the exact lease a reclaimer judged stale, so two
 * reclaimers that saw the SAME lease contend on one path — and one acting on an
 * older observation does not contend at all.
 */
function claimKey(lockPath: string, observed: PresentLease): string {
  const id =
    observed.kind === 'lease'
      ? observed.token
      : // No token to key on; the mtime the reclaimer observed is the next best
        // identity, and it is stable for as long as that lock exists. Two
        // successive tokenless locks sharing an mtime millisecond would collide,
        // which costs the second one a reclaim until the sweep expires the
        // tombstone — bounded, and only reachable through the legacy shapes.
        `${observed.kind}-${Math.floor(observed.mtimeMs)}`;
  return `${lockPath}.claim-${id}`;
}

/**
 * Exclusively take a STALE lease out of the way, or fail.
 *
 * TWO STEPS, and the first is the one that makes this correct.
 *
 * 1. CLAIM THE RIGHT TO RECLAIM *THIS* LEASE — an atomic `link` on a path named
 *    after the lease we observed. Only one process can create it, and because
 *    the name carries the observed token, a process acting on an OUT-OF-DATE
 *    observation loses here instead of touching the lock at all.
 *
 *    That second property is what a bare rename cannot give. Renaming is
 *    exclusive but not *correct*: a reclaimer descheduled between reading the
 *    lease and acting on it wakes up and renames away whatever is at the path
 *    by then — including a live lease the winner had just published. Restoring
 *    it leaves a window in which a third contender can publish, and two
 *    processes end up each convinced they hold the clone. Measured on the
 *    multi-process test below, that happened in 1 round out of 120.
 *
 *    THE CLAIM IS A TOMBSTONE — it is never deleted, only expired by the litter
 *    sweep after `staleMs`. An earlier version released it as soon as the slot
 *    was emptied, which reopened the very window it existed to close: the claim
 *    names the OLD lease, so once released, a straggler still holding a stale
 *    observation of that lease could re-take it and rename away the REPLACEMENT
 *    lease the winner had just published. Restoring that lease leaves a gap, and
 *    a third contender publishes into it — two owners.
 *
 *    That is not theory. It survived 1680 rounds on macOS and failed on the
 *    first Linux CI run; the winners' own diagnostics showed both of them
 *    reading a 62-second-old lease exactly on the round barrier, i.e. both
 *    racing the ABANDONED lease rather than one arriving late. Keeping the
 *    tombstone means no straggler can ever act on a superseded observation, so
 *    the lease genuinely cannot change under a reclaimer's feet.
 *
 * 2. EMPTY THE SLOT — `rename` to a private path. The caller then publishes
 *    into the empty slot with `link`, which fails if another contender got
 *    there first, in which case we concede having taken nothing.
 *
 * What this replaces is `rmSync(lock, {recursive:true}) + mkdirSync(lock)`,
 * which EVERY contender could complete "successfully": all of them believed
 * they held the lock, the last one's directory was left standing, and the first
 * one's release then deleted it.
 */
function reclaimStaleLease(
  lockPath: string,
  observed: PresentLease,
  myToken: string,
  log: (m: string) => void,
): boolean {
  const claim = claimKey(lockPath, observed);
  const claimDoc = { token: myToken, acquired_at: new Date().toISOString(), pid: process.pid, host: hostname() };
  if (!publishLease(claim, claimDoc)) return false; // someone else owns the right to reclaim this lease

  const parked = `${lockPath}.reclaim-${myToken}`;
  try {
    fs.renameSync(lockPath, parked);
  } catch {
    // The owner released it while we were claiming. The slot is free, which is
    // all we wanted; the caller's publish decides who gets it.
    return true;
  }

  const moved = readLeaseState(parked);
  const sameLease =
    (observed.kind === 'lease' && moved.kind === 'lease' && moved.token === observed.token) ||
    // An opaque or legacy-dir lock carries no token to compare; the claim above
    // is what made this exclusive, and neither shape is one this code writes.
    (observed.kind !== 'lease' && moved.kind === observed.kind);

  if (!sameLease) {
    // Should be unreachable now that the claim is a tombstone — kept as a
    // restore rather than a deletion, and said out loud, because silently
    // discarding a live owner's lease is the failure this function removes.
    log(`Clone refresh lock: reclaimed an unexpected lease at ${lockPath} — restoring it and standing down`);
    try {
      fs.linkSync(parked, lockPath);
    } catch {
      /* a third party already published; theirs wins */
    }
    rmQuiet(parked);
    return false;
  }

  rmQuiet(parked);
  return true;
}

/** Remove `.claim-*` / `.reclaim-*` / `.new-*` litter left by a killed container. */
function sweepLeaseLitter(gitDir: string, nowMs: number, staleMs: number): void {
  let names: string[];
  try {
    names = fs.readdirSync(gitDir);
  } catch {
    return;
  }
  const litter = [`${REFRESH_LOCK}.claim-`, `${REFRESH_LOCK}.reclaim-`, `${REFRESH_LOCK}.new-`];
  for (const name of names) {
    if (!litter.some((prefix) => name.startsWith(prefix))) continue;
    const p = path.join(gitDir, name);
    try {
      if (nowMs - fs.statSync(p).mtimeMs < staleMs) continue;
      fs.rmSync(p, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
}

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
 * Take the per-clone lease. Returns the OWNER TOKEN when acquired, else null.
 * Non-blocking on purpose: if another booting container holds it, that
 * container is already doing the work, and the right move for this one is to
 * carry on booting.
 *
 * THE DEFECT THIS REPLACES. The lease used to be a directory, taken with
 * `mkdir` and broken with `rmSync(lock, {recursive: true, force: true})`
 * followed by a fresh `mkdir`. `mkdir` alone is a fine mutual exclusion for
 * fresh contenders, but the BREAK path was not mutually exclusive at all:
 *
 *   1. A and B both fail `mkdir` on the same old, stale lock
 *   2. both stat it and both conclude it is stale
 *   3. A removes it and creates a fresh lock
 *   4. B removes that path — now A's FRESH lock — and creates its own
 *   5. both return "acquired", and A's release later deletes B's lock
 *
 * So the one moment the lock existed for — recovering from a container killed
 * mid-refresh — was the moment it permitted the concurrent pulls it was
 * supposed to prevent. Three changes close it:
 *
 *   - ownership is a random TOKEN inside the lease, not the path's existence;
 *   - reclaiming a stale lease is a `rename` to a token-named path, which only
 *     one reclaimer can win, and the moved file is re-checked to confirm it is
 *     the lease we judged stale;
 *   - nothing ever recursively deletes a lease it has not verified it owns.
 *
 * Returning null is a normal outcome, not an error: the caller skips the
 * refresh, which is exactly what a losing contender should do.
 */
export function acquireLock(
  clone: string,
  nowMs: number,
  staleMs: number = LOCK_STALE_MS,
  log: (m: string) => void = () => {},
): string | null {
  const gitDir = path.join(clone, '.git');
  const lock = path.join(gitDir, REFRESH_LOCK);
  sweepLeaseLitter(gitDir, nowMs, staleMs);

  for (let attempt = 0; attempt < ACQUIRE_ATTEMPTS; attempt++) {
    const token = randomUUID();
    if (publishLease(lock, { token, acquired_at: new Date(nowMs).toISOString(), pid: process.pid, host: hostname() })) {
      return token;
    }

    const held = readLeaseState(lock);
    if (held.kind === 'absent') continue; // released between our two calls — retry
    if (nowMs - held.mtimeMs < staleMs) return null; // a live holder; leave it alone

    if (held.kind === 'legacy-dir') {
      // Compatibility: a container still running the pre-lease code holds a
      // DIRECTORY here. It carries no token, so it can only ever be judged by
      // age — the same rule the old code used, and only after LOCK_STALE_MS,
      // by which time its owner is presumed dead. This window closes as soon
      // as every container of the group is on this image.
      log(`Clone refresh lock: reclaiming a pre-lease directory lock at ${lock}`);
    }
    if (!reclaimStaleLease(lock, held, token, log)) return null;
    log(`Clone refresh lock: reclaimed a stale lease at ${lock}`);
  }
  return null;
}

/**
 * Release a lease we hold. Requires the token `acquireLock` returned.
 *
 * Token-verified on purpose: if this container was slow enough to be judged
 * dead, another one has legitimately reclaimed the lease and is refreshing
 * right now. An unconditional delete here would strip a live owner's lease —
 * step 5 of the interleaving above — and hand the clone to a third contender
 * while two refreshes were already in flight.
 */
export function releaseLock(clone: string, token: string): void {
  const lock = path.join(clone, '.git', REFRESH_LOCK);
  const held = readLeaseState(lock);
  if (held.kind !== 'lease' || held.token !== token) return; // not ours — never touch it
  try {
    fs.unlinkSync(lock);
  } catch {
    /* best-effort — a stale lease is reclaimed by the next boot after LOCK_STALE_MS */
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

    const token = acquireLock(dir, nowMs, staleMs, log);
    if (!token) {
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
        log(
          `Clone refreshed ${dir} but could not write the stamp: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      refreshed.push(dir);
      log(`Refreshed primary clone ${dir}`);
    } finally {
      // Say so if the lease changed hands underneath us: it means this refresh
      // ran past LOCK_STALE_MS, someone judged it dead and reclaimed, and two
      // refreshes were briefly in flight. Harmless for `pull --ff-only`, but it
      // is the signal that LOCK_STALE_MS is under-sized for this clone, and
      // that is not something to discover from a mystery later.
      if (leaseOwner(dir) !== token) {
        log(`Clone refresh for ${dir} lost its lease mid-refresh — another boot reclaimed it as stale`);
      }
      releaseLock(dir, token);
    }
  }
  return refreshed;
}
