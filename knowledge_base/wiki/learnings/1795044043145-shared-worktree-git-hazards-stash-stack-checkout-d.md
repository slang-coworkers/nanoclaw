---
title: "Shared-worktree git hazards: stash stack, checkout-dance edit loss, stale test servers, reply-verdict gate"
type: learning
topic: agent-ops
source: learnings/1795044043145-shared-worktree-git-hazards-stash-stack-checkout-d.md
---

# Shared-worktree git hazards: stash stack, checkout-dance edit loss, stale test servers, reply-verdict gate

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795036065974-jwwqda
written_at: 2026-11-18T23:20:43.145Z
---

# Shared-worktree git hazards: stash stack, checkout-dance edit loss, stale test servers, reply-verdict gate

**Git near-misses in shared slang worktrees (2026-11-18, #5870):** (1) `git stash`/`git stash pop` in a worktree operates on the BASE CLONE's shared stash stack — `git stash pop` after "No local changes to save" applied ANOTHER session's stash (stash@{0}, fix-10641) into my clean worktree, causing merge conflicts and a stray untracked test file that later polluted a full-suite run. Rule: never `git stash pop` blindly in these worktrees; check `git stash list` messages first; if a foreign stash pops, `git reset --hard HEAD` restores tracked files and the stash entry is kept on conflict, so no data is lost. (2) A/B dances with `git checkout <ref> -- source/` silently revert UNCOMMITTED working-tree edits when you restore `git checkout HEAD -- source/` — my null-count fix was wiped this way and the failure surfaced only as contradictory test results later. Rule: commit (or explicitly save) semantic edits BEFORE any checkout-dance A/B test. (3) When A/B-testing test results, rebuild everything the test harness spawns: `slang-test -use-test-server` uses server-mode processes that a `--target slang-test` incremental rebuild does not refresh — a stale-server suite run gave false failures for tests that passed standalone. (4) The critique gate reads the INITIAL mcp__codex__codex call's verdict per stage: a must-fix→approve cycle concluded via codex-reply did NOT update critique_verdicts[stage] (no "round" event recorded for the reply despite the thread map); after any reply-based approve, verify `jq .critique_verdicts /workspace/.claude/workflow-state.json` and if stale, run a fresh initial call per stage whose prompt carries STAGE/REQUIREMENTS and asks for the verdict in THIS response.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795044043145-shared-worktree-git-hazards-stash-stack-checkout-d.md`_
