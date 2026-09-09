---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786526532573-utvvl3
written_at: 2026-08-13T05:02:16.651Z
---

# -target spirv-asm SKIPS the SPIR-V validator; a "valid SPIR-V" claim must use -target spirv + SLANG_RUN_SPIRV_VALIDATION=1 (slang#12498)

**Context:** shader-slang/slang#12498 (Optional<T*> SPIR-V hang). During triage I built a one-line fix for the non-termination, ran it with `slangc -target spirv-asm`, saw `rc=0` + `OpEntryPoint`/`OpConvertPtrToU` in the output, and published "compiles all three hanging shapes to **valid SPIR-V**." The fixer then falsified it: the same fix produces **validator-rejected** SPIR-V (`rc=255`) under CI conditions. I re-verified on my edge and the fixer was right.

**THE TRAP: `-target spirv-asm` (and `-target spirv` by default in a local dev build) does NOT run the SPIR-V validator.** `rc=0` from spirv-asm means "emitted assembly", NOT "valid SPIR-V". CI sets `SLANG_RUN_SPIRV_VALIDATION=1` (ci-slang-test.yml + container/coverage/sanitizer/nightly). My own CLAUDE.md says it plainly — *"Set `SLANG_RUN_SPIRV_VALIDATION=1` when using `slangc -target spirv`"* — and I skipped it. The correct check:
```
SLANG_RUN_SPIRV_VALIDATION=1 slangc f.slang -target spirv -entry main -stage compute -o /tmp/f.spv
```
`rc=255` with `error: line N: OpFunctionCall Result Type … does not match … return type` is a validation failure the naked `-asm` path hides. `inline` (no call boundary) validated clean either way, which is exactly the kind of partial pass that makes an unvalidated claim *feel* checked.

**WHY IT SLIPPED THROUGH: `rc=0` + presence of the right opcodes is NOT validity.** "compiles to SPIR-V" and "emits SPIR-V that the validator accepts" are two different claims; I measured the first and published the second. Same family as the emitCastPtrToBool "found-inst vs where-it-loops" distinction on the same issue — I keep conflating a weaker measurement with the stronger claim it superficially supports.

**THE ACTUAL BUG (for the record):** the one-liner fixes termination of the address-space fixpoint but the pass then leaves TWO mismatches — (1) call-result address space stays `PhysicalStorageBuffer` while the specialized callee returns `Function`/`Workgroup` (cached from `getFuncResultAddrSpace` at :279 BEFORE the callee's return type is specialized, then frozen by the sticky `mapInstToAddrSpace` `continue` at :147), and (2) an Optional-only `_ptr_..._natural` pointee-layout mismatch. Termination fix is necessary-but-not-sufficient.

**RULES:**
1. Any claim that a SPIR-V-target fix "works"/"produces valid SPIR-V" MUST be measured with `-target spirv` + `SLANG_RUN_SPIRV_VALIDATION=1`. `-target spirv-asm` alone is insufficient and is a trap because it returns 0 on invalid modules.
2. A regression test for a SPIR-V fix must run under `-target spirv` (validation on), not `-target spirv-asm`, or it certifies nothing.
3. When a fix only STOPS a hang, ask what the pass now PRODUCES — a terminated-but-wrong result is a different, still-open bug. "Doesn't hang" ≠ "correct output".
