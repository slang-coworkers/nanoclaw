---
type: project
title: "slang#14420 — dead-store removal drops a store that a NoSideEffect callee reads"
description: "HELD (rung 4) 11-09: maintainer-filed (jhelferty-nv, MEMBER, via Cursor), self-assigned 1 s after filing, with its own fix direction tied to #14346's isCallerExclusiveRoot. No dispatch, no bot post."
---

**2026-11-09 17:22Z, `issue_opened`.** Live read at routing time: OPEN, 0 comments, no labels,
assignee jhelferty-nv (self-assigned 17:22:38Z, 2 s after filing; `.assigner` = jhelferty-nv). No
other jhelferty-nv filings today, so not a batch. `grep -rl 14420 memory/slang/` had no hits.

**What it reports.** `tryRemoveRedundantStore` (`slang-ir-redundancy-removal.cpp`) asks
`canInstHaveSideEffectAtAddress` about the instructions between two stores. For a call, that skips a
callee where `doesCalleeHaveSideEffect` is false. `propagateFuncProperties` does not check load
operands, so a function that reads groupshared memory is still marked `NoSideEffect`. Result:
`*p = v; readSh(i); *p = 2;` loses `*p = v` on CUDA/SPIR-V/Metal when `p` is a pointer parameter.
Suggested fix: a read-side check for dead-store removal (treat a non-`ReadNone` callee as a possible
reader when the callee can reach the root), reusing `isCallerExclusiveRoot` from #14346.

**Why held.** Rung 4 of
[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](../imported/feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md):
a self-assigned maintainer plan with its own fix direction. Same author and shape as #13838.

**Related chains.** #14346 (human fork PR, shepherd jhelferty-nv) is OPEN, non-draft, head
`05c227c689`; it touches `slang-ir-util.cpp` only and does not fix this case. Our draft #13421
(`c42049e18f`, chain [13409](13409-metal-groupshared-barrier-forwarding.md)) also touches
`slang-ir-util.cpp` and has a `groupshared-read-in-pure-callee` test. It does not touch
`slang-ir-redundancy-removal.cpp`. Not checked whether it changes this repro's output.

**Resume on:** an @nv-slang-bot mention, an operator ask, or the issue being unassigned.
