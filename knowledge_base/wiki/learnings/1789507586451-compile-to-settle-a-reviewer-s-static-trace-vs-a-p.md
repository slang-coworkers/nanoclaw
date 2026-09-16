---
title: "Compile to settle a reviewer's static-trace vs a prior-learning assumption"
type: learning
topic: review-process
source: learnings/1789507586451-compile-to-settle-a-reviewer-s-static-trace-vs-a-p.md
---

# Compile to settle a reviewer's static-trace vs a prior-learning assumption

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787621317652-tzei1r
written_at: 2026-09-15T21:26:26.451Z
---

# Compile to settle a reviewer's static-trace vs a prior-learning assumption

When adjudicating a PR review, if a reviewer's static code-trace contradicts a prior learning or your own recall-based assumption, and a built `slangc` is available, **compile the repro** — it settles the dispute in one command. Don't relay either side's prose as the verdict.

Concrete case (PR #12723 R3, folding #12731): prior learning 1787658226580 said an empty-payload `CallShader` crashes *only* on SPIR-V because `case glsl:` routes through a location integer (`__callablePayloadLocation(p)`) while `case spirv:` passes `&p` directly to `OpExecuteCallableKHR`. Reviewer A disputed this, tracing that GLSL's erased `p` still feeds `__callablePayloadLocation(p)` → `kIROp_GetVulkanRayTracingPayloadLocation` (no case in `legalizeInst`) → the *same* `non-simple operand(s)!` abort. I compiled `struct EmptyData{}; [shader("raygeneration")] void rgen(){ EmptyData d; CallShader(0,d); }` with a baseline `slangc`:
- `-target glsl`  → exit 255 `non-simple operand(s)!`  ← A right, prior learning WRONG
- `-target cuda`  → exit 255 `assert failure: slang-intrinsic-expand.cpp(376): (0<=argIndex)&&(argIndex<m_argCount)` (optixDirectCall is fixed-arity; the dropped empty arg trips it)
- `-target spirv` → exit 255 (baseline = the #12731 repro)
- `-target hlsl`  → exit 0 (source-emit succeeds; the dropped-arg bug shows only at `-target dxil`/DXC)

So empty-`CallShader`-payload is a **cross-target** `none`-legalization family bug that hard-ICEs on GLSL, CUDA, and SPIR-V — the fix (`padEmptyStructWithDummyField`) is target-agnostic, so gating it per-target (`isSPIRV`/`isD3DTarget`) leaves the sibling targets broken. A per-target-gated fix for a target-agnostic transform is a coverage smell worth flagging.

Bonus trick: a baseline build (one that lacks the PR fix) is fine for confirming a gap the PR *doesn't* address, because the relevant passes are target-gated and don't run for the uncovered targets — so the result is PR-independent. You don't need a PR-head build to prove "target X is still broken."

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789507586451-compile-to-settle-a-reviewer-s-static-trace-vs-a-p.md`_
