---
title: "slang-autodiff-11356-fix-axis-is-NoDiffThis-not-static-ctor"
type: learning
topic: slang-compiler
source: learnings/1780072266959-slang-autodiff-11356-fix-axis-is-nodiffthis-not-st.md
---

# slang-autodiff-11356-fix-axis-is-NoDiffThis-not-static-ctor

## Context

Follow-up to learning `1780050112745-slang-autodiff-pr-10827-left-bwddifffunctype-remat.md` (the original PR #10827 inconsistency note that called out three candidate fix paths and asked for PR-author input).

A subsequent fix attempt (`__bwd_diff(obj.method)` regression in #11356) took fix path (a) — front-end auto-prepend of receiver in `slang-check-expr.cpp::CheckInvokeExprWithCheckedOperands` — and gated the injection on `!hasModifier<HLSLStaticModifier>() && !as<ConstructorDecl>(callableDecl)`. Reviewer A flagged this gate as **on the wrong axis**.

## The actual gate

The resolved `BwdDiffFuncType` / `FwdDiffFuncType` only includes a separate `this` slot **for `[NoDiffThis]` methods**. For default-differentiable-`this` methods, `getThisTypeForBaseFunc` returns null on a `MemberExpr` and the `this` value flows through the function expression itself — the resolved derivative type does NOT have an extra `this` slot.

So:
- `[NoDiffThis]` member method → resolved type has `this` first → injection is correct.
- Default-differentiable `this` member method → resolved type has NO separate `this` slot → injection re-introduces an arg/param mismatch in the **opposite direction** (one too many), with a type mismatch (`T` vs `inout DifferentialPair<T>`).

The static/constructor gate happens to behave correctly for the `[NoDiffThis]` test cases because both attributes are typically combined with non-static methods; but the gate axis is wrong, so the fix silently mishandles default-differentiable `this`. Both repro tests use `[NoDiffThis]`, so this gap is unobserved by the test suite.

## What to do instead

Two options, both acceptable:

(1) Front-end stays, narrow the gate: `callableDecl->hasModifier<NoDiffThisAttribute>()` (note: the attribute class is `NoDiffThisAttribute`, NOT `NoDiffThisModifier`) — handles only the case where the resolved type actually has the extra `this` slot. Leave default-differentiable-`this` to a follow-up that fixes the call-site there separately. Static methods + constructors cannot have `[NoDiffThis]` so they're excluded automatically; the wider `!HLSLStaticModifier && !ConstructorDecl` also lets through `[Differentiable]` methods that aren't `[NoDiffThis]` and silently mishandles them.

(2) Move to IR-translate time (`slang-lower-to-ir.cpp` around line 4974, where the `argCount == funcType->getParamCount()` assert lives). This is fix path (b) from the prior learning — at IR-translate you have access to the resolved derivative param count and can compare directly to argCount, injecting only when they differ by one. This subsumes the front-end approach uniformly across both `[NoDiffThis]` and default-differentiable cases without an attribute-shape gate.

The prior learning's call for "@saipraveenb25 input" still applies — both options are correct local fixes; choosing between them is a design decision (front-end intelligibility vs IR-layer uniformity).

## Empirical confirmation

A wider-gated v1 patch (static/ctor exclusion) compiled and passed all `[NoDiffThis]` tests because tests only exercised that axis — the bug is unobserved by tests but real. Reviewer A (production claude-pr-review pipeline) caught it (`final-review-11356.md` Gap #5).

## Test gap to close regardless

Both `__bwd_diff` AND `__fwd_diff` regression tests are needed (the patched code path handles both via `ForwardDifferentiateExpr || BackwardDifferentiateExpr`). And tests should include a target that exercises the original SPIR-V/WGSL emit failure mode — `//TEST:SIMPLE(filecheck=CHK): -target spirv-asm -stage compute -entry computeMain` with `// CHK: OpFunction` runs without GPU and pins the path that originally crashed; `-cpu` alone bypasses most of the GPU emit pipeline. `tests/autodiff/no-diff-this.slang:43`'s `__fwd_diff(A.f)` is a static `StaticMemberExpr` and does NOT cover the bound-receiver path.

The disabled diagnostic test `tests/diagnostics/autodiff-non-static-member-diff-operand.slang` reproduces the non-`[NoDiffThis]` `__fwd_diff(obj.method)` crash. After narrowing to `__bwd_diff` + `[NoDiffThis]` only, that pattern still crashes — confirms scope is correctly narrow.

## Cross-reference

- Reviewer A run: `/home/node/.claude/skills/slang-pr-review-runner/transcripts/patch-20260529T161207Z/final-review.md` (7 findings, Gap #5 is the axis issue).
- Stale disabled diagnostic test: `tests/diagnostics/autodiff-non-static-member-diff-operand.slang` documents this same crash; after the fix the construct is legal (not diagnostic 30098), so file premise is now wrong and 30098 is orphaned.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780072266959-slang-autodiff-11356-fix-axis-is-nodiffthis-not-st.md`_
