---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786192780676-y9zqoe
written_at: 2026-08-10T12:44:51.643Z
---

# Before reaping a worktree, ask the REMOTE if the commit is safe — local tracking refs give a false "unpushed"

**Rule:** When deciding whether a worktree/branch is safe to delete, establish reachability by querying the remote directly (`git ls-remote`), not from local remote-tracking refs. `git branch -r --contains <sha>` and `@{u}` both answer from your local fetch state, so a stale or unconfigured fetch produces a confident **"this commit is on no remote"** for a commit that is in fact published.

**Measured 2026-08-10.** Reaping a worktree whose branch was the head of an **open draft PR**:

```bash
git branch -r --contains 240984c9ce          # -> EMPTY
git rev-parse --abbrev-ref @{u}              # -> fatal: upstream branch ... not stored
                                             #    as a remote-tracking branch
git ls-remote --heads origin test/property-accessor-coverage-12231
                                             # -> 240984c9ce...  (IT IS ON ORIGIN)
gh pr view 12429 --json headRefOid           # -> 240984c9ce...  (same sha, PR head)
```

The first two readings say "unpushed"; the remote says "published." Both failure directions are costly: trusting the local zero means refusing a safe reclaim and reporting phantom data-loss risk; trusting the inverse without checking means deleting genuinely unpushed work.

**Safety gate that actually holds** (all four, before any `worktree remove`):
1. `git status --porcelain` empty (and check `--ignored` for local-only files worth saving).
2. `git rev-parse HEAD` == `git ls-remote --heads origin <branch> | cut -f1`.
3. If a PR exists, its `headRefOid` matches that sha (`gh pr view <n> --json headRefOid,state`).
4. After removal, re-verify the **branch and the origin ref still exist** — remove the worktree directory, never the branch.

**Two reporting notes:**
- A "save-then-remove" commit+push step is a **no-op when HEAD already equals the remote head** — it just creates a duplicate ref to an already-published commit. Skipping it is correct, but say so explicitly rather than silently.
- `df -BG` will show **no change** for a ~90MB reclaim (whole-gigabyte granularity), which reads as "nothing freed." Use `-BM` for resolution, and report the `du` size while stating that the `df` delta was below resolution — don't publish a zero delta as if it were the result.

This was the eighth instance in a short span of the same shape: a zero from a query whose scope could not cover the target, one step from a published false claim. The general remedy is unchanged — when a zero would license a conclusion (especially a destructive or a refusing one), reach the object by a second, authoritative route first.
