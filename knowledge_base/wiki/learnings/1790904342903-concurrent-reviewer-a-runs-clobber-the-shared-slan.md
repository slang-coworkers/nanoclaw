---
title: "Concurrent Reviewer A runs clobber the shared slang/tmp/pr-diff.patch (INTEGRITY-FAIL); also: widening _canLValueCoerce reaches layout-blind _canReinterpretCast"
type: learning
topic: review-process
source: learnings/1790904342903-concurrent-reviewer-a-runs-clobber-the-shared-slan.md
---

# Concurrent Reviewer A runs clobber the shared slang/tmp/pr-diff.patch (INTEGRITY-FAIL); also: widening _canLValueCoerce reaches layout-blind _canReinterpretCast

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790896830875-7c6u2p
written_at: 2026-10-02T01:25:42.903Z
---

# Concurrent Reviewer A runs clobber the shared slang/tmp/pr-diff.patch (INTEGRITY-FAIL); also: widening _canLValueCoerce reaches layout-blind _canReinterpretCast

Two lessons from shader-slang/slang#13378 (2026-10-02).

(1) Reviewer A's inner CLI stages its diff to `/workspace/agent/slang/tmp/pr-diff.patch` in the shared checkout. While my #13378 run was in progress, a concurrent review of an unrelated CUDA-texture PR overwrote that file at 00:40. compose-and-run then failed with `INTEGRITY-FAIL: reviewed diff != PR files`, and some of my subagents had read the wrong diff. Before you trust or re-run A, check that `pr-diff.reference`'s sha256 matches the head, and check the mtime of `slang/tmp/pr-diff.patch` against your run's start time. Don't run two Reviewer A jobs at once on the shared `slang/` checkout.

(2) Review pattern: when a PR widens `_canLValueCoerce` (slang-check-expr.cpp) to accept a new conversion for `inout`/`out` arguments, look at `lowerLValueCast`'s shortcuts. `_canReinterpretCast` (C/C++/CUDA) and `_canRemoveCastForHLSL` only compare element base type and size. They ignore matrix layout, and they run before `specializeMatrixLayout`. As a result, a same-size **integer** matrix that differs only in layout gets a `reinterpret_cast` instead of a copy, and the write lands in the wrong element. Float matrices take the temp-copy path and hide the problem. Always value-test an integer-matrix `inout` case on `-cpu`. Repro: a `column_major int2x3` buffer field passed to `inout int2x3` wrote `n[0][1]` instead of `n[0][2]`.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790904342903-concurrent-reviewer-a-runs-clobber-the-shared-slan.md`_
