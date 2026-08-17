---
title: "WGSL crashes on bool-typed IRIntLit switch case (no BaseType::Bool arm in emitSimpleValueImpl) — legalizeBoolSwitch must run for WGSL too"
type: learning
topic: slang-compiler
source: learnings/1785375838727-wgsl-crashes-on-bool-typed-irintlit-switch-case-no.md
---

# WGSL crashes on bool-typed IRIntLit switch case (no BaseType::Bool arm in emitSimpleValueImpl) — legalizeBoolSwitch must run for WGSL too

**Two linked facts from shader-slang/slang#12260 (enum:bool switch fix, PR #12275).**

**(1) WGSL codegen fact.** After the front-end fold that makes `enum:bool` switch case labels bool-typed `IRIntLit`s, a `switch(enum:bool)` on `-target wgsl` ICEs: `error[E99997]: unexpected: 8 bit integer value emitted` at `WGSLSourceEmitter::emitSimpleValueImpl` (source/slang/slang-emit-wgsl.cpp:1037-1057). Root cause: that function's `kIROp_IntLit` inner `switch(type->getBaseType())` has NO `BaseType::Bool` arm, so a bool-typed IntLit hits `default:` which falls into the `Int8/UInt8` → `SLANG_UNEXPECTED` crash. The real fix is NOT to add a Bool arm to the emitter — it's to legalize the bool switch selector→int BEFORE emit, same as SPIRV/GLSL: `legalizeBoolSwitchForKhronos` (source/slang/slang-ir-glsl-legalize.cpp:5121-5134) is fully target-agnostic but was wired SPIRV-only (slang-emit.cpp:2205-2223); WGSL's emit block (slang-emit.cpp:2256-2262) only ran `legalizeIRForWGSL`. Wire the bool-switch legalize into the WGSL block (+ rename off "Khronos" since WGSL isn't Khronos). Verified pre-fix: plain `switch(bool)` on WGSL already compiles (exit 0) — so this ICE is specific to enum:bool + switch, and is NEWLY EXPOSED by the front-end fold (before it, enum:bool switch died at E39999 in the front-end and never reached WGSL emit).

**(2) METHOD LESSON (the more important one) — verify load-bearing tool/behavior claims by RUNNING the counterfactual, before asserting them to a peer or in a public/upstream message.** In this ONE chain I made the same mistake TWICE:
- Claimed `& 1` truncation was "load-bearing" for a bool-cast fold and a C++ `(bool)` cast "would regress" — WITHOUT running `(bool)2`. Wrong; `!= 0` was correct. (See companion CORRECTION learning.)
- Claimed the WGSL gap was "invalid text, not a crash" and "pre-existing reachability" — from reading ONE emitter function (emitSwitchCaseSelectorsImpl, which only forwards to emitOperand) WITHOUT tracing into emitSimpleValueImpl where the value actually emits, and WITHOUT running `-target wgsl`. Wrong; it's an ICE, and new.
Both times the fixer (who BUILDS) caught it. Pattern: when you're about to write "X is required / Y would regress / Z is pre-existing / this is invalid-text-not-a-crash" — that's a HYPOTHESIS until a compile/run confirms it. The counterfactual (compile the other spelling, run the other target) is cheap; run it first. Reading one function in a call chain is not tracing the path. This is exactly the CLAUDE.local.md "verify-or-hypothesize load-bearing tool claims" directive; treat it as blocking, not aspirational.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785375838727-wgsl-crashes-on-bool-typed-irintlit-switch-case-no.md`_
