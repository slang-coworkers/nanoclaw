---
title: "Kind-dependent SPIR-V representation change: audit ALL width consumers + the constant-emit path (slang DescriptorHandle option-a)"
type: learning
topic: slang-compiler
source: learnings/1784859574140-kind-dependent-spir-v-representation-change-audit-.md
---

# Kind-dependent SPIR-V representation change: audit ALL width consumers + the constant-emit path (slang DescriptorHandle option-a)

## Context
slang#12186 (fix #12185): maintainer (csyonghe/pdeayton) asked to change `DescriptorHandle<T>`'s SPIR-V representation under `spvBindlessTextureNV` from **capability-wide uint64** to **kind-dependent** (uint64 only for texture/sampler-family kinds; uint2 for buffers/AS). This turned a small emit-guard fix into a representation-wide change. Lessons that generalize to ANY "make a type's backend representation depend on a new discriminator" task:

## 1. A capability-wide width decision is duplicated across MANY consumers — find them all before coding.
For DescriptorHandle it was **8 sites**: type emit (slang-emit-spirv.cpp kIROp_DescriptorHandleType), default-construct legalization (slang-ir-spirv-legalize processDefaultConstruct), byte-address storage type + BOTH cast-op selectors (slang-ir-byte-address-legalize — 3 fns, thread the type into all at load+store), IR layout (slang-ir-layout), sizeof/alignof constant-fold (slang-ir-peephole — easy to miss), AST layout + reflection (slang-type-layout, 2 sites). Grep `implies(CapabilityAtom::X)` + `getUInt64Type`/`uint2` for the type. A PLAN_REVIEW pass specifically hunting "did I miss a width site?" caught peephole + the 3-not-1 byte-address fns.

## 2. IR vs AST split: you cannot route every site through one function. IR sites use `IRDescriptorHandleType::getResourceType()`; AST layout uses `Type*`/`getElementType()`. Make the *classification* the single source of truth (one IR predicate + a mirrored AST predicate), not one function.

## 3. The conversion/reinterpret ops between the two representations are the highest-risk piece.
If `uint2`↔`uint64` casts were emitted as **identity aliases** (valid only while width was uniform), a kind-dependent width breaks them. Runtime: emit a real `OpBitcast` (in a function block; `OpBitcast` v2uint↔ulong matches the `(hi<<32)|lo` = `__asuint64` packing — precedent `emitMakeUInt64`). **Module/global scope: a constant `OpBitcast` is INVALID SPIR-V** ("Bitcast must appear in a block"; spirv-opt rejects "opcode 124 outside function definition"). At global scope you must **materialize a correctly-typed constant** by reading the operand's constant bits (walk IntLit/MakeVector/MakeVectorFromScalar/IntCast/Select-with-const-cond/cast-chain). Neither forwarding (wrong-typed SSA: `%v2uint` fed where `%ulong` needed) nor bitcast works.

## 4. `-target spirv-asm` does NOT run spirv-val by default. A wrong-typed constant compiled "clean" (exit 0) but was invalid. ALWAYS set `SLANG_RUN_SPIRV_VALIDATION=1` when verifying emit correctness — but note spirv-OPT (which runs on -O1+) independently rejected the global OpBitcast even without the val env.

## 5. Comparison/ordering ops must compare in the NATIVE representation. `equals` is representation-independent (bit equality), but `lessThan` on uint2 (lexicographic lo-major) ≠ packed-uint64 order. Branch ordering ops on the kind too, or a handle orders differently with/without the extension.

## 6. Scope discipline: distinguish "my change exposed this" from "my change caused this." The Select/scalar-splat module-scope aborts turned out to be a PRE-EXISTING general emitGlobalInst gap (plain `static const uint2 = cond?a:b`, zero handles, aborts identically on master). Don't expand the PR to fix the general gap — cover the shapes reaching YOUR new path and fail loud (SLANG_RELEASE_ASSERT) beyond that. codex agreed on scope once shown the master repro.

## 7. FileCheck-absent local env: SIMPLE filecheck tests show "0/0 ignored" not pass — verify by compiling with slangc + grepping the spirv-asm yourself.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784859574140-kind-dependent-spir-v-representation-change-audit-.md`_
