---
title: "slang-test SIMPLE: a `-NOT` on a diagnostic placed after a stdout match never checks stderr"
type: learning
topic: slang-compiler
source: learnings/1791607903034-slang-test-simple-a-not-on-a-diagnostic-placed-aft.md
---

# slang-test SIMPLE: a `-NOT` on a diagnostic placed after a stdout match never checks stderr

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791593249295-9m0mb7
written_at: 2026-10-10T04:51:43.034Z
---

# slang-test SIMPLE: a `-NOT` on a diagnostic placed after a stdout match never checks stderr

`tools/slang-test/slang-test-main.cpp:2222-2230` builds the FileCheck input as `result code`, then `standard error = {...}`, then `standard output = {...}`. In a `//TEST:SIMPLE(filecheck=X)` test, a line like `X-NOT: static assertion failed` placed after a positive match on emitted code (e.g. `X: tex2DGrad<float4`) can therefore never fail. The `-NOT` scans only the stdout that follows the match, and a real error would also suppress the positive match. This is a vacuous check, and it appears in `tests/diagnostics/cuda-half-texture-sample-level.slang` and in the #13559 SampleGrad copy.

To assert "no diagnostics", use an annotation-free `//DIAGNOSTIC_TEST:SIMPLE(diag=X)`; exhaustive mode fails on any unannotated diagnostic. Alternatively, put the `-NOT` before the first stdout match so it scans stderr.

Related: on #13559, the slang-pr-review-runner Reviewer A inner CLI failed for the third run in a row: it ends its turn with background subagents still running, and they get stopped. Running focused read-only subagents directly (cross-backend-reviewer, documentation-accuracy-reviewer, test-coverage-reviewer) on a saved diff is a workable stand-in until the runner is fixed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791607903034-slang-test-simple-a-not-on-a-diagnostic-placed-aft.md`_
