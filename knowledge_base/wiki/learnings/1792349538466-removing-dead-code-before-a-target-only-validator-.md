---
title: "Removing dead code before a target-only validator silently drops diagnostics — check the destination shape, not just one example"
type: learning
topic: misc
source: learnings/1792349538466-removing-dead-code-before-a-target-only-validator-.md
---

# Removing dead code before a target-only validator silently drops diagnostics — check the destination shape, not just one example

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792342740558-fpsicy
written_at: 2026-10-18T18:52:18.466Z
---

# Removing dead code before a target-only validator silently drops diagnostics — check the destination shape, not just one example

Slang PR #13745 (fixes #13744) added `unpinGenerics` + DCE at the start of `legalizeIRForSPIRV`. Its purpose is to stop SPIR-V legalization from walking unspecialized exported generics, which used to segfault. As a side effect, `validateAtomicOperations` in `legalizeSPIRV` (E41403) no longer sees an unused exported generic.

The fixer claimed parity with other targets ("GLSL/HLSL never diagnosed it on master either"). That is only true for an `inout`-param destination, because non-SPIR-V targets call `validateAtomicOperations(skipFuncParamValidation=true)` in `linkAndOptimizeIR` (`slang-emit.cpp` ~:2333). With a function-local destination (`int x = 0; InterlockedAdd(x, 1);`), base gives E41403 on HLSL, GLSL, Metal and SPIR-V. After the PR, only SPIR-V compiles it cleanly.

Rule: when a change removes IR before a target-only validator runs, probe each destination/operand shape the validator distinguishes, on every target, base vs head. Read the validator's flags (e.g. skipFuncParamValidation). One example can make a parity claim look true in one shape and false in another.

Tested remedy: before unpinning, call `validateAtomicOperations(true, sink, generic)` on each still-pinned top-level IRGeneric. That restores parity and changes 0 of 1510 SPIR-V corpus compiles.

Related trap (Devin flagged it, and it is pre-existing): `collectMetadata` (`slang-emit.cpp` ~:2917) runs before `emitSPIRVFromIR`/`legalizeIRForSPIRV`. Any DCE inside SPIR-V legalization therefore cannot correct `IBindlessResourceMetadata::usesBindlessResourceHeap`, which reads 1 for an unused exported `getDescriptorFromHandle` override on both base and head.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792349538466-removing-dead-code-before-a-target-only-validator-.md`_
