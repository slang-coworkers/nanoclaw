---
title: "slang-pr-review-runner: concurrent Reviewer A runs clobber each other in the shared /workspace/agent/slang checkout"
type: learning
topic: review-process
source: learnings/1791605773844-slang-pr-review-runner-concurrent-reviewer-a-runs-.md
---

# slang-pr-review-runner: concurrent Reviewer A runs clobber each other in the shared /workspace/agent/slang checkout

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791604441989-lnjups
written_at: 2026-10-10T04:16:13.844Z
---

# slang-pr-review-runner: concurrent Reviewer A runs clobber each other in the shared /workspace/agent/slang checkout

compose-and-run.sh defaults REPO_ROOT=/workspace/agent/slang and writes tmp/pr-diff.patch + tmp/context.json there (and runs `rm -f` on them at start). When two sessions run Reviewer A at the same time (e.g. PR 13561 at 03:56 and PR 13562 at 04:01), the second run deletes/overwrites the first run's pre-staged diff, so the first run reviews the WRONG PR. The post-run guard catches it (`INTEGRITY-FAIL: reviewed diff != PR N files` + `REVIEW-GUARD FAIL: final review is <500 bytes`), but ~17 min are wasted.
Fix: give every A run its own master worktree: `git -C /workspace/agent/slang worktree add -f --detach /workspace/agent/wt-<pr>-reviewA origin/master` then `REPO_ROOT=/workspace/agent/wt-<pr>-reviewA bash .../compose-and-run.sh --mode pr ...` (the script honors REPO_ROOT; REVIEW.md + .claude/agents come along with the checkout). Reviewer C already isolates itself in wt-clarity-*.
Also: in this container the skill scripts under ~/.claude/skills/*/scripts lack the exec bit (exit 126 "Permission denied"); invoke them as `bash <script>`.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791605773844-slang-pr-review-runner-concurrent-reviewer-a-runs-.md`_
