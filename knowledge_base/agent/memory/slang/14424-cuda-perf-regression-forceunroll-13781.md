---
type: chain
title: "slang#14424 — CUDA runtime regression after #13781 ([ForceUnroll(4)] on VECTOR_MAP/MATRIX_MAP)"
description: "Maintainer-filed (jkwak-work) 2026-11-09 18:27:58Z; jhelferty-nv assigned it to the author 12 s later. Own plan: a temporary PR drops [ForceUnroll(4)] from the six macros, then watch the nightly perf. HELD under rung 4: no dispatch, no bot post. #13781 is the reporter PR from our #13765 chain."
tags: [slang, cuda, performance, regression, hlsl-meta, forceunroll, jkwak-work, maintainer-owned, held]
---

# slang#14424 — CUDA runtime regression after #13781

**Ask.** The nightly perf run shows a CUDA runtime regression after PR #13781 (merge `7036ae6df`). The only part of
#13781 that reaches CUDA is `[ForceUnroll(4)]` on `VECTOR_MAP_{UNARY,BINARY,TRINARY}` and
`MATRIX_MAP_{UNARY,BINARY,TRINARY}` in `hlsl.meta.slang` (the fallback of about 150 overloads). The cause is not found yet. Their synthetic
probe (nvcc -O3, sm_86) shows 23→0 loops, SASS 1656→1672, registers 39→36, no local memory. They did not run a timing test. Plan: (1) a temporary PR
removes the unroll and disables `generic-minmax-vector-codegen-11075.slang` and the `NOLOOP` check of `tests/wgsl/vector-math-no-loop.slang`, with TODOs;
(2) watch the nightly; (3) if the perf recovers, make the fix WGSL-only (`case wgsl:`) and enable the tests again; (4) otherwise revert and bisect.

**2026-11-09 18:3xZ live read.** OPEN, 0 comments, no labels, assignee jkwak-work (the `assigned` event has actor jkwak-work and assigner jhelferty-nv).
No PR references 14424 yet. The only session on `gh-issue-shader-slang/slang-14424` is this Main webhook session `sess-1794248880980-kd1mx2`.

**Why held.** Rung 4 of [feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](../imported/feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md):
the maintainer wrote the plan and owns it (assigned to the author by a peer maintainer, with their own fix direction and their own temp PR).

**Link to our work.** #13781 was the reporter's (albertrodriguezclo) fix for [#13765](13765-wgsl-vector-map-unary-loops.md). Our triager
verified it after the merge on 10-23 and reported "no regression". That check was correctness only: slang-test cpu/cuda/vk/llvm 7453/7453, codegen diffs,
and the E38206→E40020 change for matrices with more than 4 rows. **It did not measure runtime.** Lesson: a correctness sweep does not prove a perf claim, so state
that a check was correctness-only when you report "no regression" on a change that alters codegen on all targets.

**Resume on:** an @nv-slang-bot mention, an operator ask, or the issue being unassigned. The temp PR opened by jkwak-work routes through its own
webhooks; it needs no bot review unless someone asks.
