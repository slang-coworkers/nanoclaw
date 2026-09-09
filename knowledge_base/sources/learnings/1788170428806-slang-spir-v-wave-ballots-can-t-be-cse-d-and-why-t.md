---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788169877029-ardkoz
written_at: 2026-08-31T10:00:28.806Z
---

# Slang SPIR-V wave ballots can't be CSE'd — and why the safe dedup is same-basic-block only

From triaging shader-slang/slang#12847 (duplicate `OpGroupNonUniformBallot` for `WavePrefixCountBits(p)`+`WaveActiveCountBits(p)` on the same predicate).

**Why two identical ballots survive to SPIR-V (all confirmed in code):** Wave intrinsics have no SPIR-V ballot IR opcode — they're `[ForceInline]` stdlib funcs in `source/slang/hlsl.meta.slang` whose SPIR-V case is an inline `spirv_asm` block. `WavePrefixCountBits` (18544) embeds its ballot *inline* inside one self-contained block; `WaveActiveCountBits` (17369) builds it via `WaveActiveBallot` (17346) → `_WaveCountBits` (17766). Different code shapes ⇒ never merge. And even identical shapes wouldn't: `removeRedundancy` (slang-ir-redundancy-removal.cpp:67-101) gates on `isMovableInst` (slang-ir.cpp:10104-10224, opcode allowlist — wave ops + `kIROp_SPIRVAsm` absent → false); `mightHaveSideEffects` (9403-9747) treats them as side-effecting; global value-numbering only touches hoistable insts; and `SPIRVAsmOperandInst` is *deliberately* non-hoistable so passes can rewrite refs per-block. This exclusion is intentional.

**The load-bearing safety constraint for any dedup fix:** an `OpGroupNonUniformBallot` result depends on the *implicit active-lane mask*, which is NOT a function argument. So you must NOT mark the ballot `[__readNone]`/pure/hoistable or add it to the general `isMovableInst` allowlist — that permits illegal hoisting across control-flow edges / out of loops where the active set differs (wrong results, not just perf). A correct CSE must be guarded to the SAME basic block, identical predicate operand, and no intervening active-mask-changing op (no branch/merge — free in-block — and no OpDemote/OpTerminate/barrier between them).

**Also:** reporter's "map to OpGroupNonUniformAdd" is a red herring — there's no such op (`OpGroupNonUniformIAdd` sums per-lane `uint(pred)`, a different formulation); ballot+`OpGroupNonUniformBallotBitCount` is the canonical idiom (exactly what Slang's GLSL path emits). And drivers' SPIR-V→ISA compilers already CSE same-block same-predicate ballots, so runtime impact of the redundancy is small → low priority.
