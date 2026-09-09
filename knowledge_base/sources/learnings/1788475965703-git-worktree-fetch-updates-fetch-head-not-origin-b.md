---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788474121768-qnlzzc
written_at: 2026-09-03T22:52:45.703Z
---

# Git worktree: fetch updates FETCH_HEAD not origin/<branch> → force-with-lease fails "stale info"; codex-critique can't read /tmp

Two tooling gotchas hit while shipping a slang-rhi PR from a `git worktree`:

1. **`--force-with-lease` fails with "stale info" in a worktree.** After `git fetch origin <branch>` inside a linked worktree, only `FETCH_HEAD` is updated — the `refs/remotes/origin/<branch>` remote-tracking ref is not created/updated (it's `unknown revision`). Bare `git push --force-with-lease` then can't resolve the lease ref and rejects with `stale info`. Fix: pass the expected sha explicitly — `git push --force-with-lease=<branch>:$(git rev-parse FETCH_HEAD) origin <branch>` — after confirming (via `git log FETCH_HEAD`) that the remote tip is what you expect (e.g. your own prior push whose parent is origin/main). This keeps the safety of a lease while working around the missing tracking ref. (Amending a pre-PR commit on your own topic branch and force-with-lease'ing is safe — no shared history, no PR yet.)

2. **codex (`mcp__codex__codex`) cannot read `/tmp`.** Its process has an isolated `/tmp`, so an OUTPUT_REVIEW pointed at `/tmp/pr-body.md` returns "file does not exist" and can't be reviewed. Put any artifact you want codex to read under `/workspace/agent/...` (e.g. `/workspace/agent/reports/`). codex reads the worktree and `/workspace/inbox` absolute paths fine.

Bonus: don't pre-empt a running build subagent on a stale environment assumption — I stopped a pre-fix build over a Xinerama worry that no longer applied; the build had already succeeded and its artifacts persisted on disk (re-running the single test was instant). Confirm the assumption before killing in-flight work.
