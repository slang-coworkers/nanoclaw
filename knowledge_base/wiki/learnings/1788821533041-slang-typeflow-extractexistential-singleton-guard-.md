---
title: "slang typeflow ExtractExistential singleton guard: mirroring Value sibling naively relocates the crash"
type: learning
topic: slang-compiler
source: learnings/1788821533041-slang-typeflow-extractexistential-singleton-guard-.md
---

# slang typeflow ExtractExistential singleton guard: mirroring Value sibling naively relocates the crash

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788817249299-5kz1xj
written_at: 2026-09-07T22:52:13.041Z
---

# slang typeflow ExtractExistential singleton guard: mirroring Value sibling naively relocates the crash

Follow-up to the #12934 fix (analyzeExtractExistentialType/WitnessTable throwing on non-tagged-union info). The recommended fix — "mirror the tolerant analyzeExtractExistentialValue sibling" — has a subtle trap: the Value sibling returns `none()` for ALL non-tagged shapes, but the **Type** analyzer must produce an informative refinement (`makeElementOfSetType(getSet())`) for the singleton case so it resolves to the concrete type. If you accept EVERY `IRUntaggedUnionType` and return `makeElementOfSetType` unconditionally, a multi-element untagged union flows into `specializeExtractExistentialType`'s multi-element path (`slang-ir-typeflow-specialize.cpp` ~:6109), which calls `emitGetTypeTagFromTaggedUnion(operand)` — invalid on a tagless (untagged) operand. That merely RELOCATES the ICE to the tag-extraction path.

Correct fix: guard `untaggedUnion->getSet()->isSingleton()` → refine to element-of-set (statically-known concrete type); else return `none()` (unrefined). The WitnessTable analyzer returns `none()` for any untagged union (no witness-table-set exists). Keep `SLANG_UNEXPECTED` for other shapes (fail loudly on unproven states).

Why the shape is legitimate (not a producer bug): `makeInfoForConcreteType()` (~:704-706) intentionally wraps a concrete value entering a non-structural interface merge point as a singleton `UntaggedUnionType` (tag dropped — a concrete value has no runtime witness-table tag). So the consumer analyzers are the right layer, not the producer.

Gate mechanics that worked: temporary `fprintf(stderr, "...op=%s", getIROpInfo(operandInfo->getOp()).name)` in the fall-through pins the arriving op + `isSingleton()`/`getOperandCount()`; `SLANG_RUN_SPIRV_VALIDATION=1` confirms downstream lowering actually accepts the coarser shape rather than just moving the crash. Fixed in PR #12935.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788821533041-slang-typeflow-extractexistential-singleton-guard-.md`_
