---
title: "[approver/challenger] ConstOffset-safety hinges on constant-MakeVector hoisting (maybeHoistConstructInstToGlobalScope), verify it — slang#12133"
type: learning
topic: review-approval
source: learnings/1784334175709-approver-challenger-constoffset-safety-hinges-on-c.md
---

# [approver/challenger] ConstOffset-safety hinges on constant-MakeVector hoisting (maybeHoistConstructInstToGlobalScope), verify it — slang#12133

**Context:** slang PR #12133 (fixes #9382) — the maintainer-mandated fix for the Gather const-offset over-declaration: new backend IR op `kIROp_ImageGatherOffset`, emit-time constness split (`isConstantGatherOffset`), const → `ConstOffset` (no cap), runtime → `Offset` + `requireSPIRVCapability(ImageGatherExtended)`. Decided WOULD_APPROVE (CLEAN), Devin-only tier.

**Symptom / trap:** The whole fix's SPIR-V *validity* rests on one property Devin flagged only as "informational": `ConstOffset` is legal SPIR-V **only if the offset operand emits as `OpConstant`/`OpConstantComposite`** (a constant), NOT a runtime `OpCompositeConstruct`. A reviewer who stops at "the helper detects constants" hasn't proven the emitted operand is actually a *constant composite*. The maintainer explicitly named the validation gate: a `-target spirv SLANG_RUN_SPIRV_VALIDATION=1 -O0` test — which this PR's test (spirv-asm-only) does NOT exercise. So the safety must be established by code inspection, not by the test.

**Root cause it's actually safe:** `emitCompositeConstruct` (slang-emit-spirv.cpp) emits `OpConstantComposite` **only when the inst's parent section is `ConstantsAndTypes`** — i.e. only if the `MakeVector` was hoisted to global scope. The hoist is done by `maybeHoistConstructInstToGlobalScope` (source/slang/slang-ir-spirv-legalize.cpp:1722, called from `processConstructor`): it moves a constructor to the module inst **iff every operand's parent is the module inst and none is an IRGlobalParam**. Its own comment: *"vectors made of constant components end up being emitted as constant vectors (using OpConstantComposite)."* `IRConstant`s are global by construction (`isGlobalValueInst` returns true for `as<IRConstant>`). Since `isConstantGatherOffset` narrows to exactly {`IRConstant` leaf, or `MakeVector`/`MakeVectorFromScalar` whose *every* operand is an `IRConstant`}, the hoist condition is satisfied for precisely the accepted shapes → valid `OpConstantComposite` → valid `ConstOffset`.

**How to catch it (transferable):** For any emit-time change that selects a SPIR-V image-operand / capability by operand *constness*, don't accept "the helper detects constants" at face value. Trace the operand's *emitted form*: (a) find where the composite is materialized (`emitCompositeConstruct` — section-dependent: `ConstantsAndTypes`→`OpConstantComposite`, function block→`OpCompositeConstruct`); (b) confirm the constant-hoisting pass (`maybeHoistConstructInstToGlobalScope`) actually moves the accepted shapes to global scope; (c) confirm the classifier's accepted set ⊆ the hoister's hoistable set. If the PR's test is spirv-asm-only (no real spirv-val), this inspection IS the validation gate — the maintainer's named `-target spirv -O0` test being absent is an advisory test-strength nit, not a blocker, once the by-construction argument holds.

**Fix / verdict:** Safety chain verified in-tree + via deepwiki; misclassification is one-directional-safe (unproven-constant → `Offset`+cap = valid, never `ConstOffset`-on-runtime). Gaps (spirv-asm-only test; negated-constant unhandled→conservative over-declaration; `__texture_gatherCmp_offset` runtime mirror-bug out-of-scope) all clear conservative-lean. See [[conditional-spir-v-capability-by-operand-constness]] (maintainer fix shape) and [[slang-9382-negated-constant-gather-offset]].

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784334175709-approver-challenger-constoffset-safety-hinges-on-c.md`_
