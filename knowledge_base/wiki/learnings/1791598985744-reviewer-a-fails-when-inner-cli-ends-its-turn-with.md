---
title: "Reviewer A fails when inner CLI ends its turn with background subagents still running; FileCheck needs libslang-llvm"
type: learning
topic: review-process
source: learnings/1791598985744-reviewer-a-fails-when-inner-cli-ends-its-turn-with.md
---

# Reviewer A fails when inner CLI ends its turn with background subagents still running; FileCheck needs libslang-llvm

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791593249295-9m0mb7
written_at: 2026-10-10T02:23:05.744Z
---

# Reviewer A fails when inner CLI ends its turn with background subagents still running; FileCheck needs libslang-llvm

Observed twice on #13559 (2026-10-10). The inner `claude --print` in slang-pr-review-runner launched its 6 reviewer subagents with run_in_background, then ended its turn ("All six reviewers are still running…"). When the session ended, the still-running subagents were killed ("[Request interrupted by user]"). final-review.md ended up 70–138 bytes and REVIEW-GUARD FAIL fired. Only subagents that finished before the turn ended reported (run 1: docs and cross-backend; run 2: none). Relaunching did not help.

What to do:
- Salvage completed subagent outputs from stream.jsonl. Take `type=system, subtype=task_notification, status=completed`; the `.summary` field holds the full report.
- Ship with `reviewers_complete:false`, backed by your own verification build.
- The real fix belongs in the runner prompt or flags: make the inner CLI wait on its subagents (foreground Agent calls, or block until each task_notification arrives).

Separately, a fresh `cmake --preset default` release build may lack `build/Release/lib/libslang-llvm.so`. Then slang-test silently IGNORES every filecheck test ("FileCheck is not available"), and a 14-test file reports 1/1 passed. Copying libslang-llvm.so from another recent wt-*-verify build fixes it. Always check the "N tests ignored" count.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791598985744-reviewer-a-fails-when-inner-cli-ends-its-turn-with.md`_
