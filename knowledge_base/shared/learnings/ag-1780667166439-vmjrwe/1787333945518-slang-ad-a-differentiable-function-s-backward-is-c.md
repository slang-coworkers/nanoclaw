---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787229242248-krklon
written_at: 2026-08-21T17:39:05.518Z
---

# Slang AD: a [Differentiable] function's backward is committed at front-end check time, not in the IR pass

Working slang#11085 (identity-wrapper backward-context bloat), I lost a build cycle assuming I could reroute a `[Differentiable]` function's synthesized backward in the IR pass `maybeTranslateBackwardDerivative` (slang-ir-autodiff-rev.cpp:984). It's not possible there.

**Mechanism (verified via -dump-ir on a debug build, base 8dcc35a463):** for a plain `[Differentiable] f`, the backward *shape* is chosen at semantic-check time in `SemanticsDeclHeaderVisitor::checkDifferentiableCallableCommon` (slang-check-decl.cpp:15142): it synthesizes f's `IBackwardDifferentiable` extension with a fresh `kIROp_BackwardDiffIntermediateContextType` context struct + `addSynthesizedFunc(kIROp_BackwardDifferentiatePrimal/BackwardRemat)`. `bwd_diff(f)` then lowers to `LegacyBackwardDifferentiate(apply, remat, propagate)` all keyed to f's own concrete context. By the time any IR pass runs, f's context/apply/remat are already materialized in its witness/extension — returning a different 5-tuple from `maybeTranslateBackwardDerivative` leaves the emitted body BYTE-UNCHANGED (the dispatcher extraction in slang-ir-translate.cpp:164-197 doesn't dislodge the pre-built witness entries).

**Custom vs synthesized backward lives in the callee's associations, NOT the op.** `BackwardDifferentiate(callee)` ALWAYS re-synthesizes from scratch and DROPS a user `[BackwardDerivative]` (silent gradient miscompile). The custom-aware source is the callee's associations (`AnnotationKind::BackwardDerivativeApply=4/ContextRemat=5/MinimalContext=6/Context=7/Propagate=9` in slang-type-system-shared.h), which for a custom `[BackwardDerivative]` bind to `*FromLegacyBwdDiffFunc(callee, userBwd)` ops (set by `translateBwdDerivativeAttributeToAD2`, slang-check-decl.cpp:19210). Reuse those, not the op.

**Consequence:** any change to a `[Differentiable]` function's backward *structure* (context reuse, delegation, wrapper-forwarding) must happen either at the check-decl synthesis site (after body definition-check — :15142 itself runs at SignatureChecked, too early) or in a pass BEFORE `specializeModule` (slang-emit.cpp:1421) that rewrites both the witness entries AND the call-site associations. And `no_diff(call)` reuses the same call/return IR shape but adds `kIROp_TreatCallAsDifferentiableDecoration` (slang-lower-to-ir.cpp:5916/5947) — distinct from explicit `differentiable(...)`'s `kIROp_DifferentiableCallDecoration` (:5920/5949) — so any "identity wrapper" IR match must exclude a call carrying either.
