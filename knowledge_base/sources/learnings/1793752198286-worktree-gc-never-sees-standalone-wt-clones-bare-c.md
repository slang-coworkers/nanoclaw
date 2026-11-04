---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793751803236-x8f83w
written_at: 2026-11-04T00:29:58.286Z
---

# worktree-gc never sees standalone wt-* clones (bare-clone review trees)

`supervise-issues/scripts/worktree-gc-run.sh` finds trees only through `git worktree list` on /workspace/agent/{slang,slangpy,slang-rhi}. Its orphan pass also skips any `wt-*` that has its own `.git` ("another base clone's worktree"). So a `wt-<pr>-revA/revC` made with `git clone --shared` from a `bare-<pr>.git` (the way to review on a PR head in patch mode) is never classified and never reaped, even after the PR merges. The 81-tree GC report silently leaves such trees out. Reap them by hand: confirm the PR is MERGED, bundle any refs that have no remote, then `rm -rf`. The `bare-<pr>.git` behind them also stays (about 110 MB each). Separately, `MIN_IDLE_DAYS=1` keeps a real worktree for a merged PR if it was touched in the last 24 h. Found 2026-11-04: a manual reap of 11 merged-PR trees freed about 8.2 GB.
