---
title: "Session reap deletes worktree mid-build — commit tests+code BEFORE the long build"
type: learning
topic: agent-ops
source: learnings/1784385072886-session-reap-deletes-worktree-mid-build-commit-tes.md
---

# Session reap deletes worktree mid-build — commit tests+code BEFORE the long build

# Session reap deletes the worktree mid-build; uncommitted edits are LOST

**Observed (slang#9153, 2026-07):** A fixer session was reaped ~2 days into a `/slang-fix-issue` run (container teardown while the debug build ran in a subagent). The reap deleted the entire `wt-slang-<n>/` worktree directory. The tests + code edits lived only in that working tree and had **never been committed**, so they were gone. The branch stub survived in the base clone but with **0 commits beyond master** (empty diff). No stash, no dangling-commit recovery — `git fsck` showed unrelated danglers only. jkwak (maintainer) had to nudge "PR not coming, did something go wrong?" before anyone noticed.

**Root cause of the silence:** the workflow builds in a subagent that blocks 15-25 min; if the container is reaped during that window, everything uncommitted dies with the worktree, and the session's last word ("build started, ETA 20 min") is stale forever.

**Rules that prevent this:**
1. **Commit tests + code IMMEDIATELY after writing them, before starting the long build.** Editing a file is not durable; a commit on the `fix/issue-<n>` branch is. This is crash-safety, not premature commit — you `--amend` freely afterward. The reap can then only cost the build output (which ninja resumes incrementally), never the source.
2. **Drive long builds detached with a completion marker, not a bare subagent.** `nohup bash -c 'cmake --build ... ; echo "BUILD_EXIT=$?" >> build.log' &` then a background `until grep -qa BUILD_EXIT build.log` waiter + a `Monitor` on `FAILED:|error:|BUILD_EXIT=`. A subagent that hits its own time limit reports an ambiguous final message ("I'll wait for the monitor…") that reads as success but left the binary unbuilt (156/1176 targets done). Always verify the actual `BUILD_EXIT=` marker and binary mtime, never trust the subagent's prose.
3. **On resume after a suspected reap, establish ground truth before reporting:** `ls wt-<n>`, `git -C base-clone log --oneline master..fix/issue-<n>` (0 commits = nothing survived), `git stash list`, `git fsck --lost-found`. Report concrete state (build exit / commits / push attempted / worktree intact), not a guess.

**Recovery is cheap when the design survived:** the plan report (`reports/slang-<n>.md`) is on the durable workspace disk, not the worktree, so re-doing the mechanical edit+build+PR from an intact plan is ~1 clean pass, not a re-investigation.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784385072886-session-reap-deletes-worktree-mid-build-commit-tes.md`_
