---
title: "Cross-module autodiff annotations dropped at IR link (selected [export] lacks them)"
type: learning
topic: slang-compiler
source: learnings/1790156612022-cross-module-autodiff-annotations-dropped-at-ir-li.md
---

# Cross-module autodiff annotations dropped at IR link (selected [export] lacks them)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790149422604-3rto94
written_at: 2026-09-23T09:43:32.022Z
---

# Cross-module autodiff annotations dropped at IR link (selected [export] lacks them)

# Cross-module autodiff annotations dropped at IR link

**Context:** shader-slang/slang#13233 / PR #13236. `fwd_diff` over an imported `IDifferentiable`
struct produced a primal-typed parameter + zero tangent when the struct had BOTH an explicit
`__init()` AND a `no_diff` field.

**Root cause (non-obvious):** Forward-diff gates each parameter on a `DifferentialPairType`
*annotation* (a module-scope `IRAnnotation`, a use of the type inst) — `translateFuncParam`,
slang-ir-autodiff-fwd.cpp. That annotation is recorded by whichever module *differentiates* the
symbol. For an imported type/function, that is the IMPORTING module, which records it on its own
`[import]` declaration. The DEFINING module's `[export]` may lack it entirely (e.g. an explicit
`__init()` suppresses the synthesized differentiable member-wise ctor, so the defining module never
differentiates the type). At link, `cloneGlobalValueWithLinkage` selects the `[export]`
(definition > declaration) as canonical, and `cloneGlobalValueImpl` cloned annotations from ONLY
that selected inst (`cloneAnnotations` reads `originalInst->getModule()`'s linking info) — so the
importing declaration's annotation is orphaned. Fix: recover annotations from EVERY same-mangled-name
declaration (`originalValues.sym` chain) onto the canonical clone, selected-first + per-(target,kind)
dedup.

**Two traps that cost real cycles:**
1. **Recover the FULL annotation set, not a subset by kind.** Narrowing recovery to type kinds
   (`AnnotationKind >= DifferentialPairType`) on the theory that callable/derivative kinds
   (`ForwardDerivative` etc.) are target-specific REGRESSED `tests/autodiff/cross-module-differentiable.slang`
   — an imported `[Differentiable]` *function*'s callable associations are orphaned the same way and
   yield a zero derivative if dropped. Selected-definition-first + dedup already makes the
   target-appropriate definition win; siblings only fill genuinely-absent kinds.
2. **The bug is compilation-path-sensitive.** It reproduces via `slangi` (INTERPRET) and `slangc`
   CLI codegen (`-target cuda/hlsl` emits the primal param), but NOT via slang-test
   `COMPARE_COMPUTE_EX -cpu -shaderobj` (the component/shaderobj link path preserves the annotation).
   A `COMPARE_COMPUTE` regression test would silently PASS on the buggy compiler. Use `//TEST:INTERPRET`
   (value) + `//TEST:SIMPLE -target cuda/hlsl` (FileCheck the emitted derivative takes `DiffPair_<T>`,
   not the primal `<T>`) — verify the test FAILS on master before trusting it.

**Files:** source/slang/slang-ir-link.cpp (`cloneGlobalValueImpl`, `cloneAnnotations`,
`hasAnnotationOfKind`); annotation kinds in slang-type-system-shared.h (`AnnotationKind`: 1–9 callable,
≥10 type). AnnotationKind is exclusively autodiff-related; `cloneAnnotations` early-returns for
non-autodiff programs via `canPruneAutodiffLinkArtifacts`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790156612022-cross-module-autodiff-annotations-dropped-at-ir-li.md`_
