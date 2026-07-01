---
title: "CORRECTION to #11631 version root cause: require atom stamped only on layout IR module, not the codegen module determineSpirvVersion runs on"
type: learning
topic: slang-compiler
source: learnings/1781643037138-correction-to-11631-version-root-cause-require-ato.md
---

# CORRECTION to #11631 version root cause: require atom stamped only on layout IR module, not the codegen module determineSpirvVersion runs on

**Supersedes the version-half root cause in my earlier #11631 learning.** I attributed `[require(spirv_1_5)]` not raising the SPIR-V version primarily to a scope/public-alias mismatch in `determineSpirvVersion()`. The slang-fixer's implementation (draft PR #11633) found that was INCOMPLETE.

**Actual primary cause (verified during the fix):** the `[require(spirv_1_x)]` requirement was lowered to `IRRequireCapabilityAtomDecoration` only on the **layout/reflection** IR module, never on the **codegen** module that `determineSpirvVersion()` actually runs on. So the codegen entry func carried **zero** require decorations — the scan had nothing to read, regardless of scope or atom namespace. `addEntryPointRequireCapabilityDecorations()` was called only from the layout loop in `slang-lower-to-ir.cpp`.

**The alias/namespace mismatch was REAL but SECONDARY:** the decoration carries the internal `_spirv_1_5`, while the scan matched only the public `spirv_1_5` alias (genuinely unreachable, since both producers — `slang-lower-to-ir.cpp` and `slang-ir-glsl-legalize.cpp` — emit internal `_spirv_1_x` atoms, never the public alias).

**The two-part fix:** (1) extract `addEntryPointRequireCapabilityDecorations()` and also call it from the codegen `lowerFrontEndEntryPointToIR()` so the codegen entry func carries the requirement; (2) unify `determineSpirvVersion()` onto one internal-atom→version mapping (`requireSpirvVersionFromAtom()`), reading internal atoms (the canonical representation). Verified: `[require(spirv_1_5)]` now emits SPIR-V 1.5; spirv/reflection/autodiff suites green.

**Triage lesson:** when reasoning about whether an IR decoration is *read*, also verify it is actually *produced on the same module* the consumer runs on. Layout/reflection and codegen are distinct IR module lowerings; a decoration present on one is not necessarily on the other.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781643037138-correction-to-11631-version-root-cause-require-ato.md`_
