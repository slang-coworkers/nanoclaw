---
title: "Worktree-GC reap: safe-execution facts (branch refs survive; workflows-perm blocks wip/reap; pipefail bug)"
type: learning
topic: misc
source: learnings/1782710777380-worktree-gc-reap-safe-execution-facts-branch-refs-.md
---

# Worktree-GC reap: safe-execution facts (branch refs survive; workflows-perm blocks wip/reap; pipefail bug)

Durable facts from executing an operator-authorized worktree GC reap (slang-fixer, 2026-06-29, ~33G reclaimed, disk 97%→82%):

**1. `git worktree remove --force` does NOT delete the branch ref.** It removes the working dir + `.git/worktrees/<id>` admin entry only. The branch (`refs/heads/<branch>`) and its commits remain in the main repo's shared object store, reachable via `git -C <main-repo> log <branch>`. So even if the "save" step fails, removing a worktree never loses committed work as long as you don't separately `git branch -D` it. Verify post-reap with `git -C /workspace/agent/slang rev-parse refs/heads/<branch>`.

**2. The bot cannot push branches that touch `.github/workflows/*.yml`** — origin rejects with "refusing to allow a GitHub App to create or update workflow `…` without `workflows` permission" (or a timeout). This kills the `save-then-remove` recipe's `git push origin HEAD:wip/reap/<branch>` for any worktree whose unpushed commits modify workflow files (e.g. Falcor-CI branches #11495/#11586/#11600). Fallback preservation = the local branch ref (fact #1); the wip/reap off-box backup is simply unavailable for those branches. Don't treat the failed push as "work lost."

**3. Process bug — never gate on a pipeline's tail.** `if git push … 2>&1 | tail -2; then rm…; fi` tests `tail`'s exit (always 0), NOT git's — so it removes even when the push failed. Use `set -o pipefail`, or capture `git push …; rc=$?` before piping, or `${PIPESTATUS[0]}`. (Here it was harmless only because of fact #1.)

**4. Reap classification that worked:** dirty (`git status --porcelain` non-empty) = uncommitted WIP → KEEP. Clean + has unpushed commits (`rev-list master..HEAD > 0`, SHA not on any `origin/*` ref) + issue CLOSED + no PR → abandoned, safe to reap (commits preserved via fact #1). Clean + 0 commits + issue OPEN → empty scaffold, KEEP (not terminal-class). Open PR (`gh pr list --head <branch> --state open`) → KEEP (it's the follow-up checkout). MERGED/CLOSED-PR worktrees → terminal, reap. A "dirty" merged worktree is usually just build logs / submodule-pointer drift / generated-doc reformat — inspect before assuming real work.

**5. Authorization:** worktree-GC reap is operator-gated; a `/supervise` auto-cron re-deriving the GC set is NOT the grant (see chain-conflict rule). Only execute on an explicit operator authorization relayed by parent.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782710777380-worktree-gc-reap-safe-execution-facts-branch-refs-.md`_
