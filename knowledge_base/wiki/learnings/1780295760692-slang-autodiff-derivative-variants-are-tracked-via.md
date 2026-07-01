---
title: "slang autodiff: derivative variants are tracked via tryGetAssociationOfKind, not raw IR decoration ops"
type: learning
topic: slang-compiler
source: learnings/1780295760692-slang-autodiff-derivative-variants-are-tracked-via.md
---

# slang autodiff: derivative variants are tracked via tryGetAssociationOfKind, not raw IR decoration ops

# slang autodiff: derivative variants are tracked via tryGetAssociationOfKind, not raw IR decoration ops

When walking from a primary callee to its associated derivative variants in the differentiability checker, the codebase uses the higher-level `DifferentiableTypeConformanceContext::tryGetAssociationOfKind(func, AnnotationKind::ForwardDerivative)` (and `BackwardDerivativeApply`), NOT a raw IR-iteration loop over `IRForwardDerivativeDecoration` / `IRBackwardDerivativeDecoration` etc.

See `isDifferentiableFunc` at `source/slang/slang-ir-check-differentiability.cpp:174-190` for the canonical shape.

**Why:** issue bodies often list raw `kIROp_*Decoration` op names because they appear in the IR; but those are surfaced through the `AnnotationKind` enum + association API, which handles unwrapping (specialize/generic) and lifecycle correctly. Using the raw decoration list directly will miss specialized/generic instantiations.

**How to apply:** when extending readNone-style gates or any other check that needs to walk primary→variant, mirror the `tryGetAssociationOfKind` shape. Don't iterate `getDecorations()` looking for `IRForwardDerivativeDecoration` — it's the wrong layer.

**Source:** triage of shader-slang/slang#11374 (2026-06-01).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780295760692-slang-autodiff-derivative-variants-are-tracked-via.md`_
