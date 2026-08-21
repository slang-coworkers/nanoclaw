---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787255278674-12ij9d
written_at: 2026-08-20T20:00:41.815Z
---

# Empty copyLogical + void_constant ordering in SPIR-V empty-type legalization (slang#12664/#12665)

**Symptom:** `InternalError ... unexpected: non-simple operand(s)!` when backward-autodiff produces a differential context struct holding a resource + an empty nested struct, compiled to SPIR-V. Repro shape: `Consumer { RWStructuredBuffer<float> gradient; Identity activation; }` where `Identity` is an empty (fieldless) struct; used inside a `bwd_diff` chain requiring `spvCooperativeVectorNV`.

**Chain (verified against IR + local repro/rebuild):**
1. Resource legalization (`slang-legalize-types.cpp` TupleTypeBuilder) hoists the `RWStructuredBuffer` out; `Identity` is empty → the leftover ordinary `Consumer` context becomes an empty struct.
2. SPIR-V buffer-element lowering (`slang-ir-lower-buffer-element-type.cpp:1442`) needs a logical clone distinct from the physical layout type, so it emits `emitCopyLogical` between two pointers to that empty struct — even though it's empty.
3. On SPIR-V **≥1.4**, `lowerCopyLogical` is skipped (`slang-ir-spirv-legalize.cpp:2970`, gated on `!isSpirv14OrLater()`), so the `copyLogical` survives to `legalizeEmptyTypes`.
4. There its pointer operands legalize to `LegalVal::none`, but its result type stays non-`none`, so the `none`-result escape at `slang-ir-legalize-types.cpp:2189` doesn't fire and there's no `case kIROp_CopyLogical` → hits the shared `default:` `SLANG_UNEXPECTED` at :2197.

**Fix (PR #12665, validated as principled):**
- Add `case kIROp_CopyLogical` to the inner `legalizeInst` switch (`slang-ir-legalize-types.cpp` ~:2124): `SLANG_RELEASE_ASSERT` both operands are `LegalVal::Flavor::none`, then `return LegalVal()`. Mirrors the adjacent `StructuredBufferLoad` case (:2182).
- **KEY safety invariant:** the inner switch is only reached when `anyComplex==true` (outer `legalizeInst` at :2472 short-circuits the all-simple case). So a `copyLogical` between NON-empty structs never reaches the new case; the release-assert is safe and fails loudly only on an out-of-contract partially-legalized copy.
- Second cascading bug: the last `cleanUpVoidType` (`slang-emit.cpp:2425`) runs BEFORE the final `legalizeEmptyTypes` (`:2549`, "Required for AD 2.0"); that late pass re-introduces `void`/`void_constant` placeholders into non-optimizable retained structs which then reach emission ("Unhandled global inst ... void_constant"). Fix: add a second `SLANG_PASS(cleanUpVoidType);` right after :2549.

**Verification method that worked without a GPU:** this is a compile-time SPIR-V *emit* crash, so it reproduces on CPU with a prebuilt Debug `slangc`. Confirmed baseline aborts; applied both edits, incremental `--target slangc` rebuild, reran with `SLANG_RUN_SPIRV_VALIDATION=1` → valid `.spv`, only the empty copy removed (legitimate `Model`/`Producer` `OpCopyLogical` remain). Then `git checkout --` to restore the tree (the reporter's PR owns the change).
