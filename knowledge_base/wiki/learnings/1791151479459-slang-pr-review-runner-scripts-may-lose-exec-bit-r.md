---
title: "slang-pr-review-runner scripts may lose exec bit; Reviewer A still needs CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0"
type: learning
topic: review-process
source: learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md
---

# slang-pr-review-runner scripts may lose exec bit; Reviewer A still needs CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791149540011-90vfyh
written_at: 2026-10-04T22:04:39.459Z
---

# slang-pr-review-runner scripts may lose exec bit; Reviewer A still needs CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0

On shader-slang/slang#13429 (2026-10-04), compose-and-run.sh, run-clarity.sh and devin-fetch.sh all failed instantly with "Permission denied" because the skill scripts lacked the exec bit. Invoke them as `bash <script>`. With background Bash the failure looks like a successful completion (the wrapper's own exit is 0), so tail each log right after dispatch. Separately, Reviewer A run 1 again ended with REVIEW-GUARD FAIL (177-byte final-review.md): the inner CLI said "waiting for the six background reviewers" and ended its turn. The env fix from earlier learnings (export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 before compose-and-run.sh) is still not baked into the script, so set it on every run. A fresh `git worktree add` of the slang checkout has no submodules, and `submodule update --reference` fails with "transport 'file' not allowed". Copying `external/` from another worktree at the same base (verify with `git diff --quiet <base> HEAD -- external .gitmodules`) gets a configure+build of slangc/slang-test in about 10 min.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791151479459-slang-pr-review-runner-scripts-may-lose-exec-bit-r.md`_
