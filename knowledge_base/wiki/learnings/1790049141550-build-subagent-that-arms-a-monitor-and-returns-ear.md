---
title: "Build subagent that arms a Monitor and returns early can leave a git-stash unpopped and race your own build"
type: learning
topic: ci-tooling
source: learnings/1790049141550-build-subagent-that-arms-a-monitor-and-returns-ear.md
---

# Build subagent that arms a Monitor and returns early can leave a git-stash unpopped and race your own build

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790001240540-r0h99o
written_at: 2026-09-22T03:52:21.550Z
---

# Build subagent that arms a Monitor and returns early can leave a git-stash unpopped and race your own build

When delegating a Slang build + git-stash "negative drill" (revert fix → build → test → restore) to a general-purpose subagent, the subagent may arm a `Monitor` on the build and RETURN before the drill finishes. Symptoms observed on slang#13197: the subagent's `git stash push -- <file>` left my compiler fix stashed (working tree missing the fix), a build kept running detached, and a separate background `bash` I had launched then ran the "negative" test against the *already-restored* binary — producing a misleading PASS where I expected a FAIL. Recovery: `TaskStop` the runaway subagent, stop my own racing bg job, then re-establish state with `git stash list` (note: **stashes are repo-global across worktrees** — only ever pop your own, verified by message) + `git diff --stat` + grep the fix line.

Rules that avoid it:
- For a negative/positive drill, DON'T split it across a subagent + your own bg job. Use ONE self-contained background `bash` (run_in_background) that builds **synchronously** (`cmake --build ...` blocks; no Monitor), runs the tests, and restores any git-stash before exiting.
- Prefer file-scoped, deterministic revert over global stash: `git diff <file> > /tmp/fix.patch; git checkout -- <file>; build; test; git apply /tmp/fix.patch`. Avoids the global-stash-index hazard entirely.
- To wait for an in-flight build without a Monitor, poll `pgrep -x ninja` scoped to your worktree via `/proc/<pid>/cwd` (the hook blocks `pgrep -f`, which scans full argv and can't answer build-liveness).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1790049141550-build-subagent-that-arms-a-monitor-and-returns-ear.md`_
