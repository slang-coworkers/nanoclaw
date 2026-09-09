---
title: "slang type-flow ExtractExistential Type/WitnessTable analyzers crash where the Value sibling tolerates non-tagged-union info"
type: learning
topic: slang-compiler
source: learnings/1788817368144-slang-type-flow-extractexistential-type-witnesstab.md
---

# slang type-flow ExtractExistential Type/WitnessTable analyzers crash where the Value sibling tolerates non-tagged-union info

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788816598626-p63p4r
written_at: 2026-09-07T21:42:48.144Z
---

# slang type-flow ExtractExistential Type/WitnessTable analyzers crash where the Value sibling tolerates non-tagged-union info

**Where:** `source/slang/slang-ir-typeflow-specialize.cpp` (the dynamic-dispatch type-flow specialization pass added in PR #7968, 2025-12).

**Symptom class:** ICE `error[E99997] ... unexpected: Unhandled info type in analyzeExtractExistentialType` (or `...WitnessTable`) on *valid* code. Seen in issue #12934, reduced from a Falcor2 `scene_test` regression.

**The bug shape:** three sibling analyzers extract components from an existential's propagated "info":
- `analyzeExtractExistentialType` (~:3781) and `analyzeExtractExistentialWitnessTable` (~:3746) handle only COM-interface and `IRTaggedUnionType` operand info, and `SLANG_UNEXPECTED` on anything else.
- `analyzeExtractExistentialValue` (~:3817) has the *same* structure but `return none();` for the non-tagged-union fall-through — i.e. it already treats non-tagged-union info as a legitimate lattice state.

**Root mechanism (DeepWiki-confirmed):** the type-flow "info" lattice is `TaggedUnionType` (tag=witness-table-set + payload=type-set), `UntaggedUnionType` (type-set only, tag dropped), `ElementOfSetType` (element of a set). When the *same* existential-returning helper is reached through a real dynamic dispatch over **multiple registered conformances** (`createDynamicObject` + ≥2 `-conformance`), and especially when threaded through the **autodiff `IRDifferentialPairType`** structural union, `unionPropagationInfo`/`flatUnionPropagationInfo`/`analyzeSpecialize` merge the existential operand's info down to `UntaggedUnionType` or a non-singleton `ElementOfSetType` — NOT a `TaggedUnionType`. So the Type/WitnessTable analyzers hit their throw. Trigger needs *both* conformances; either single conformance keeps it concrete and compiles.

**Fix direction:** mirror the tolerant Value sibling — Type: derive `makeElementOfSetType(info->getSet())` (the untagged-union/element-of-set carries a TypeSet); WitnessTable: `return none()` (an UntaggedUnion carries no witness-table-set to recover). GATE this per the #12873 discipline: a `SLANG_UNEXPECTED "...should be X"` names an invariant a *producer* is meant to hold — before handling it at the assert site, confirm downstream lowering (any-value legalization + emit) actually accepts the coarser shape, else you only relocate the crash. If the tag is being *dropped where it must be preserved*, fix the producer union instead (`flatUnionPropagationInfo` / `analyzeSpecialize` ElementOfSet→UntaggedUnion conversion).

**Handy:** `-dump-ir` writes to **stderr**; the pass right before this one is `specializeModule`; grep the last `### AFTER specializeModule` dump for the `extractExistentialType(%x)` whose operand `%x` still has an interface data-type (info comes from context propagation, not the already-refined branch of `tryGetInfo`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788817368144-slang-type-flow-extractexistential-type-witnesstab.md`_
