---
title: "A closed PR does not license reaping its branch's worktree — one branch hosts many PRs, and a direction pivot leaves the SUCCESSOR open"
type: learning
topic: misc
source: learnings/1786193893035-a-closed-pr-does-not-license-reaping-its-branch-s-.md
---

# A closed PR does not license reaping its branch's worktree — one branch hosts many PRs, and a direction pivot leaves the SUCCESSOR open

A worktree-GC dispatch told me: *"issue #11877's PR **#11879 is CLOSED**; `wt-slang-11877` (~6.9 G) is reclaimable."* Both facts were true. Reaping would have destroyed the tree behind an **OPEN** PR.

`fix/issue-11877` has hosted **two** PRs:
- **#11879** — CLOSED-unmerged 2026-07-15, head `c6db778075` (the PR the dispatch named)
- **#12162** — **OPEN, draft**, head `4187e5816f` = **the worktree's exact HEAD**, awaiting a maintainer ready-flip

The maintainer closed #11879 on a *direction change* (honor-the-overload → emit an error) and the fix was re-shipped as #12162 on the same branch. **CLOSED is precisely the state a successor PR lives behind** — a pivot closes one PR and opens another, so "the PR is closed" is evidence about *that PR* and never about the branch.

**The check that works:**
```bash
gh pr list --head <branch> --state all --json number,state,isDraft,headRefOid
```
Two rows here; only the *second* one decides. Note a same-branch-name check does **not** catch this (an earlier variant of this trap was a *different* branch — `fix/issue-11967` vs `…-runtime` — so "confirm the branch matches" passes and proves nothing here).

**Second trap, same reap — a stale tracking ref manufactured a fake "unpushed commit".** The recipe said *a CLOSED-unmerged PR is exactly where the tree may be the only copy — do not skip the push.* That felt confirmed:
```bash
git rev-parse origin/fix/issue-11877   # c6db778075  ← #11879's OLD head, STALE
git rev-parse HEAD                     # 4187e5816f  ← looks 1 ahead ⇒ "unpushed!"
git ls-remote origin refs/heads/fix/issue-11877
#                                        4187e5816f  ← IDENTICAL to HEAD; already pushed
```
`/workspace/agent/slang` is a shallow clone with refspec `+refs/heads/master:refs/remotes/origin/master` only, so `git fetch origin <branch>` moves **FETCH_HEAD but not** `refs/remotes/origin/<branch>` — the tracking ref stays frozen at whatever it was. **Only `git ls-remote` is authoritative for a remote tip.** A `wip/reap/` push would have been pure noise.

Both errors point the same way: the dispatch arrives with its conclusion pre-formed and a save-then-remove recipe attached, which makes the recipe feel like the task and the premise feel already checked. The dispatcher said outright it could not inspect git state — so the premise is the callee's job.

**Before any reap, in one pass:** (1) enumerate *all* PRs on the branch (`--state all`); any OPEN ⇒ reply `active` and stop. (2) `ls-remote` vs local `HEAD`; equal ⇒ nothing to save. (3) `git status --porcelain` for uncommitted work. (4) re-read the issue with `--json state,stateReason,assignees`. ~5 calls against 6.9 G and an open PR's only local tree.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786193893035-a-closed-pr-does-not-license-reaping-its-branch-s-.md`_
