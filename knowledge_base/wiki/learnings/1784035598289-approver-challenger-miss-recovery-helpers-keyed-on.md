---
title: "[approver/challenger-miss] Recovery helpers keyed on one SSA consumer shape (branch→phi) need the whole-consumer-set probe"
type: learning
topic: review-approval
source: learnings/1784035598289-approver-challenger-miss-recovery-helpers-keyed-on.md
---

# [approver/challenger-miss] Recovery helpers keyed on one SSA consumer shape (branch→phi) need the whole-consumer-set probe

**Symptom:** PR #11667 (dynamic-dispatch specialization for non-concrete optionals) added `findTargetOptionalType` in `slang-ir-lower-optional-type.cpp`: when a payload-less `OptionalNoneType`-typed `MakeOptionalNone` reaches lowering, it recovers the concrete `Optional<T>` by walking the inst's `IRUnconditionalBranch` users to the matching phi param, then `SLANG_RELEASE_ASSERT(targetOptionalType)`. The test exercises exactly the `as`-cast → makeOptionalValue/makeOptionalNone → phi-of-`Optional<Square>` shape the helper handles.

**Root cause (the class of signal to probe):** A recovery/lookup helper that reconstructs missing type info from **one specific consumer shape** silently assumes that shape is the *only* one. But an IR value produced by an analysis predicate (`analyzeMakeOptionalNone` returns `OptionalNoneType` for ANY `Optional<non-concrete-T>` none, independent of how it's consumed) follows standard SSA semantics — it can be returned directly, passed as a call argument, or stored, not just phi-merged. deepwiki (shader-slang/slang) confirmed the return/call-arg upcast paths handle `none` as a first-class value. When the recovery finds no match, a `SLANG_RELEASE_ASSERT` turns a legal program into a compiler abort.

**How to catch it:** For any change adding a helper that reconstructs type/info by walking `firstUse`/user-of-a-specific-op and then asserting non-null, ask: "what produces this value, and is the walked consumer shape the ONLY shape that producer can feed?" Cross-check the *producer* predicate (does it gate on consumer shape? here it does NOT — only on `Optional<non-concrete-T>`) against the *recovery* predicate (does it cover every consumer the producer allows? here it covers only branch→phi). Mismatch ⇒ plausible abort/miss. Grep the tree for other consumers (`IRReturn`, `IRCall`, `IRStore`) of the same value type. Can't verify read-only ⇒ ABSTAIN, don't round up — especially on the fallback (Devin-only) tier.

**Fix (decision):** ABSTAIN_POLICY / CHALLENGER_CONCERN on #11667. Companion probe: a global-only witness-table filter (`collectExistentialTables` + `isGlobalInst`, typeflow:8239) is the same class — it assumes only autodiff synthesizes block-local tables; if a *primal* conformance can ever be block-local it drops a dispatch target (see also witness-table partial-miss misdispatch learning). Both are "one-shape assumption on a value/table that the rest of the pass treats more generally."

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784035598289-approver-challenger-miss-recovery-helpers-keyed-on.md`_
