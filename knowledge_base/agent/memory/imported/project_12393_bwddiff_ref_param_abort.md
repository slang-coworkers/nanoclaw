---
name: project_12393_bwddiff_ref_param_abort
description: "slang #12393 — TERMINAL at triage 2026-08-06, verdict posted (cmt 5207625007): bug/high/P2/front-end, assignee jhelferty-nv (self-assigned). Awaits his 2 judgment calls then a fixer draft PR (prefer diag 38030). ⭐ Verdict REVERSES the body: the ICE needs NO design decision — triager PROVED it by building a patch, 6 controls held. Abort is in interface-conformance witness synthesis. ⛔ Filed groupshared repro does NOT reproduce on master (only __ref)."
metadata: 
  node_type: memory
  type: project
  originSessionId: c0a49331-2e8d-42f9-bc64-ae4bbd658822
---

shader-slang/slang **#12393** — "Backward-diff type builders abort on a `ref` parameter instead of stopping at a diagnostic". Filed 2026-08-06 by `nv-slang-bot[bot]`. **TERMINAL at triage; chain closed on `gh-issue-shader-slang/slang-12393`, awaiting the human assignee.**

## The bug

A `[Differentiable]` function with a `ref` parameter makes both backward-diff *type builders* abort:
- `source/slang/slang-ast-type.cpp:931` — `BwdDiffFuncType::_resolveImplOverride`, `ParamPassingMode::Ref` case
- `source/slang/slang-check-expr.cpp:5772` — `SemanticsVisitor::getBackwardDiffFuncType`, same case

both via `SLANG_UNEXPECTED("ref parameter not allowed in backward diff function")`. **`SLANG_UNEXPECTED` routes through `handleSignal`, not `SLANG_ASSERT`, so it fires in RELEASE too** — the `InternalError` is caught (`slang-end-to-end-request.cpp` ~1941) and surfaces as `E99997`, aborting with "file an issue" and no cause. The adjacent `BorrowIn` case builds a `ConstRefParamType` and continues; only `Ref` aborts. **No `bwd_diff` call is needed** — building the type for the *declaration* is enough.

**Where it aborts (localized with a `__cxa_throw` interposer + `addr2line`):** inside **interface-conformance witness synthesis** at `DeclCheckState::TypesFullyResolved` — `_resolveImplOverride` ← `Val::resolveImpl` ← `getResultType` ← `synthesizeMethodSignatureForRequirementWitness` ← `trySynthesizeMethodRequirementWitness` ← `findWitnessForInterfaceRequirement` ← `checkInterfaceConformance` ← `checkModule`. That is *why* declaring the function suffices — it is not reached via a `bwd_diff` expression.

**Provenance:** introduced by `45ccce9a3` (2026-04-01, #9808, "Refactor auto-diff implementation") — pickaxe + before/after control. Predates #11709 by ~4 months.

## Decoupled from #11709 (proven by execution)

Fully decoupled — reproduces on clean master with `__ref`, no `groupshared`:
```slang
RWStructuredBuffer<float> outputBuffer;
[Differentiable]
float pick(uint tid, __ref float s) { return s; }   // never called
[shader("compute")][numthreads(1,1,1)]
void computeMain(uint tid : SV_DispatchThreadID) { outputBuffer[tid] = 0.0f; }
```
→ `error[E99997]: ... unexpected: ref parameter not allowed in backward diff function`, rc=255. `[Differentiable]` is required (variant without it compiles); target-independent (spirv aborts too).

- ⛔ **The issue's filed repro (bare `groupshared` param) does NOT reproduce on master** — compiles clean. Only `__ref` reaches the `Ref` case on master; #11709 is what makes it reachable from ordinary `groupshared` source *and* adds **E38038**. So E38038 is #11709-only: on master the abort arrives with **no preceding diagnostic** — a bare ICE. #11709 doesn't create the bug; it makes it reachable and at least names the cause first.

## Triage verdict (cmt 5207625007, posted 16:57Z)

bug / high / **P2** / front-end (semantic checking + autodiff type construction). High because it fires in release; P2 because it needs an explicit `__ref` today. Issue: labels `Autodiff`/`bug`/`reproduced` (all applied by a sibling session under our own bot identity — **not a human**, do not route for ownership), Type=Bug, **assignee `jhelferty-nv`** (self-assigned 16:02Z, before commenting).

⭐ **The verdict REVERSES the issue body's "design-gated" framing — and was PROVEN BY BUILDING, not argued.** Removing the ICE does **not** require deciding what a backward-diff signature means for a by-reference parameter. The triager patched both sites to a recovery type + a `RefModifier` diagnostic, built Release, and every previously-aborting cell became a clean diagnostic while **all six controls held** (`__constref` still `E38034`; `out`/`inout`/plain still clean; the body's `groupshared` repro still clean). Patch reverted. What remains — deliberately NOT decided, the assignee's call: (a) **which** recovery representation each of the two (different-kind) sites uses; (b) whether `no_diff __ref` is diagnosed or allowed. **A diagnostic alone is provably insufficient:** `checkModule` has no error-count gate between phases, so `__constref` + `__ref` in one file fires `E38034` at signature phase and the `__ref` one *still* aborts.

**Free diagnostic slots** (re-derived on pristine HEAD as a computed complement, controls held): `{38030, 38038, 38039, 38044, 38049}`. **Prefer 38030** — it heads the differentiation sub-block (`slang-diagnostics.lua` `-- 380xx: differentiation modifiers` marker at :4417), whereas **38038 is the number #11709 already takes**. `tests/diagnostics/const-ref-differentiable-param.slang` exists at HEAD as the test model.

## RESUME trigger

jhelferty-nv answers (a)+(b) or says "make a PR" → release `slang-fixer` for a **draft PR** (`pr: non-breaking`, `Fixes #12393`, `DIAGNOSTIC_TEST:SIMPLE` modelled on `tests/diagnostics/const-ref-differentiable-param.slang`, prefer diagnostic **38030**). **No fixer dispatched — do not dispatch or nudge until the human assignee replies.** Blocker: none.

## Method lessons distilled from this chain (each in its own concept)

The chain produced repeated self-correction; every rule now lives standalone: bounded-grep-cannot-report-a-ceiling ([[feedback_a_bounded_grep_pattern_cannot_report_a_ceiling]]); an enumeration claim needs a computed complement ([[feedback_an_enumeration_claim_needs_a_computed_complement]]); unrecognized file content is not evidence of an editor, and a valid discriminator run on the wrong object manufactures a confident inversion — `findmnt -no SOURCE,TARGET --target .` before contradicting a peer about a file ([[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]]); grep the object that holds the code, not the launcher (`libslang-compiler.so`, not `slangc`) ([[feedback_grep_the_object_that_holds_the_code_not_the_launcher]]); shared clone/build hazards — restore named files from snapshots, never `git checkout -- .`; source facts from `git show HEAD:<path>`; a shared `build/` dir is shared mutable state, so confirm the artifact before trusting a build failure. Related front-end context: [[project_11709_groupshared_byref]] (which adds E38038).
