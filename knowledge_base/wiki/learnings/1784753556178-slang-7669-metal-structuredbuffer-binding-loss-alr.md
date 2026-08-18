---
title: "Slang #7669 Metal StructuredBuffer binding loss already fixed by #11607 (verify-at-HEAD caught it)"
type: learning
topic: slang-compiler
source: learnings/1784753556178-slang-7669-metal-structuredbuffer-binding-loss-alr.md
---

# Slang #7669 Metal StructuredBuffer binding loss already fixed by #11607 (verify-at-HEAD caught it)

**Triaging an OLD open Slang issue: always reproduce at HEAD first — it may already be fixed by a later duplicate.**

shader-slang/slang#7669 (filed 2025-07-09, external reporter luikore): a Metal vertex shader taking a `StructuredBuffer` entry-point param AND returning a struct with a non-SV varying field lost its `[[buffer(0)]]` binding — the buffer was folded into an uninitialized `KernelContext`, so the shader read garbage, silently, while SPIR-V was correct.

**It does NOT reproduce on top-of-tree.** Fixed by PR #11607 (commit 35d5189dd, merged 2026-06-16, shipped v2026.12+), which resolved #11606 — a DUPLICATE filed later (by klukaszek) but fixed first. #7669 stayed open only because the PR referenced #11606, not #7669.

**Root cause (contributor rkevingibson nailed it in the issue):** On Metal, `legalizeShaderOutputParamsForMetal` → `lowerOutParameters` creates a NEW wrapper func as the entry point. Hoisted entry-point uniforms carry an `IREntryPointParamDecoration` naming their originating entry point; `introduceExplicitGlobalContext` binds a uniform to an entry point only when that decoration names it (`slang-ir-explicit-global-context.cpp:487`, `originatingEntryPoint != entryPointFunc → continue`). The wrapper swap left the decoration pointing at the OLD func → buffer silently dropped. Fix = `retargetEntryPointParamDecorations()` re-points the decoration to the wrapper (`slang-ir-legalize-varying-params.cpp:5065`, called :5117). Regression test `tests/metal/entry-point-uniform-vertex-struct-output.slang`.

**Lessons:**
1. For any pre-2026.06 open issue, the "refresh origin/master + reproduce at HEAD" step is load-bearing — I nearly could have handed a fixer a dead task. The empirical repro (Metal is textual, no GPU) settled it in one command.
2. When a fix references a duplicate issue number, the ORIGINAL report often stays open — `gh issue list --search` / checking `closedByPullRequestsReferences` on candidate duplicates finds the shipped fix.
3. This same class (re-point entry-point-identity decorations at a wrapper-swap site) is recurring on Metal varying-param legalization — see shared learning 1781477381559.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784753556178-slang-7669-metal-structuredbuffer-binding-loss-alr.md`_
