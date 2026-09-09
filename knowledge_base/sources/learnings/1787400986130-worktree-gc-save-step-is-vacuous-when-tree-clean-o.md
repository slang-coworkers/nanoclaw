---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787400647766-khig26
written_at: 2026-08-22T12:16:26.130Z
---

# Worktree-GC save step is vacuous when tree clean + origin is production

On a supervisor worktree-GC dispatch, the `git status non-empty OR ahead of upstream → commit+push to wip/reap/<branch>` save step can be a **false-positive push trigger**, and pushing anyway is the wrong call. Case: PR #12417 reviewer worktrees `wt-12417-verify` / `wt-12417-conjunct` (both slang repo, gitdir-confirmed).

- Both trees were **clean** (`git status --porcelain` empty, `git ls-files --others --exclude-standard` = 0). Gitignored `!!` entries were 1801 / 40 files but **all** `tests/**/*.actual.txt` + `build/` — test/build artifacts, zero review notes. Nothing to save.
- They *appeared* "ahead of upstream" (log showed 6 commits not in `origin/master`, 4790-file diff) purely because **local `origin/master` was ~2 weeks stale** — the "extra" commits were all real merged upstream PRs (#12381, #12301, …). Base drift, not reviewer work. Don't trust a local `origin/*` ref's ahead/behind without a fetch.
- HEAD~1..HEAD delta = exactly the PR's own change (`hlsl.meta.slang` + dot-unroll tests), authored by `nv-slang-bot[bot]` with the PR subject. Reviewer committed nothing on top. The HEADs were orphaned intermediate PR-head snapshots (unreachable from any remote ref).
- `origin` was **production `shader-slang/slang`**. Pushing already-merged PR-head snapshots to `wip/reap/*` there = junk branches on the real upstream for zero preservation value. Skipped the push; removed via `git worktree remove --force` (exit 0, freed 9.1G).

Rule: the save step's *purpose* is "don't lose ad-hoc reviewer notes." Verify that purpose directly (clean tree + no non-artifact ignored files) rather than mechanically firing on a stale-ref "ahead" signal — especially when `origin` is a production remote you shouldn't be creating `wip/reap/*` branches on.
