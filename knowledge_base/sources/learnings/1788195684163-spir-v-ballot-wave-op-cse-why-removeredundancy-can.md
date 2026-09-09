---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788170353236-yikxzf
written_at: 2026-08-31T17:01:24.163Z
---

# SPIR-V ballot/wave-op CSE: why removeRedundancy can't do it, and the fences a hand-rolled pass needs

Context: slang#12847 — two `OpGroupNonUniformBallot` on the same predicate in one basic block weren't
being deduplicated. Deduping them safely turned out to hinge on several non-obvious facts.

1. **Wave/subgroup intrinsics have NO dedicated IR opcode.** They are stdlib functions in
   `hlsl.meta.slang` whose SPIR-V arm expands to inline `spirv_asm { OpGroupNonUniform... }`. After
   inlining they are opaque `IRSPIRVAsm` (kIROp_SPIRVAsm) parents with `IRSPIRVAsmInst` children.

2. **`IRSPIRVAsm` has ZERO operands** — its content lives in child insts. So `IRInstKey` /
   `DeduplicateContext` (which hash/compare op+type+operands) can't tell two ballot blocks apart, and
   `removeRedundancy` deliberately EXCLUDES spirv_asm/wave ops via `isMovableInst`. Don't try to add
   them to that path: `isMovableInst` ALSO drives loop-invariant hoisting
   (`tryHoistInstToOuterMostLoop`) — marking a ballot movable would let it hoist across control flow
   where the active-lane set differs. That's a correctness bug, not just a perf one. A same-block
   hand-rolled CSE is the right layer.

3. **`getOpcodeOperandWord()` / `IRIntLit::getValue()` ASSERT on non-IntLit operands.** SPIR-V
   pseudo-ops like `__truncate` (kind SPIRVAsmOperandTruncate) have no int value; reading their opcode
   word crashes. Repro: `tests/language-feature/spirv-asm/truncate.slang`. Always check the operand
   KIND (`kIROp_SPIRVAsmOperandEnum`/`Literal`) BEFORE calling getValue().

4. **`mightHaveSideEffects()` returns FALSE for `[__readNone]` and `IRIgnoreSideEffectsDecoration`
   calls.** A subgroup CSE that fences only on `mightHaveSideEffects()` would happily merge across
   such a call — but a side-effect-free callee can still demote/terminate a lane and change subgroup
   participation. Fence `kIROp_Call` UNCONDITIONALLY; use `mightHaveSideEffects()` for the rest
   (discard/terminate, barriers, atomics, opaque spirv_asm), and whitelist only the read-only mask
   consumer (`OpGroupNonUniformBallotBitCount`) that legitimately sits between the two ballots.

5. **Ballot inner-inst operand shape** (via `getSPIRVOperands()`, everything after operand0=opcode):
   `[result-type, result, Subgroup-scope, predicate]` — 4 operands, kinds
   [SPIRVAsmOperandInst, SPIRVAsmOperandResult, SPIRVAsmOperandEnum, SPIRVAsmOperandInst]. Validate
   the full canonical shape before merging so you never delete an unrelated observable op; compare
   operands by pointer identity (fail-closed: merge only genuinely-identical ballots).
