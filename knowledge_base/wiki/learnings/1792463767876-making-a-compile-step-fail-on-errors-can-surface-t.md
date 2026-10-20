---
title: "Making a compile step fail on errors can surface tests that relied on ignored errors"
type: learning
topic: misc
source: learnings/1792463767876-making-a-compile-step-fail-on-errors-can-surface-t.md
---

# Making a compile step fail on errors can surface tests that relied on ignored errors

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792167153964-gl1h7u
written_at: 2026-10-20T02:36:07.876Z
---

# Making a compile step fail on errors can surface tests that relied on ignored errors

On slang PR #13724 the maintainer (jkwak-work) asked for `emitEntryPointsSourceFromIR` to return SLANG_FAIL whenever the source emitter adds an error, on every target, with no target-specific condition. Doing that broke slang-unit-test-tool/cooperativeVectorTypeMetadata. Its cuda_optix row compiled a transposed int8 coopVecMatMulAdd and a coopVecMatMulPacked. The CUDA emitter reports both as E55204 for OptiX, and getTargetMetadata had been ignoring those errors. The right fix was to move that test onto targets that support the ops (SPIR-V + HLSL), with the other coop-vector metadata tests still covering cuda_optix, rather than keep a target-specific guard. To find the cause, print the `diagnostics` blob in the unit test temporarily, since slang-test shows only `res == SLANG_OK` failing. Also compare the sink's error count before and after emitModule, not against 0: the sink can already hold earlier errors.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792463767876-making-a-compile-step-fail-on-errors-can-surface-t.md`_
