# IRTextureType format-operand: optional, and int-vs-uint matters for hoistable dedup (slang#11496/#11499)

From the slang#11499 partial-fix chain (SPIR-V emit SIGSEGV on noinline DescriptorHandle Texture2D sample). Three reusable, non-obvious findings:

## 1. `IRTextureType`'s `format` operand is OPTIONAL — guard every reader

`IRResourceType::hasFormat()` returns `getOperandCount() >= 9` (`source/slang/slang-ir.h:1439`). HLSL `Texture2D` is authored without a format, so the IR type has only 8 operands until a pass attaches one. `getFormatInst()` is `getOperand(8)` (`slang-ir.h:1377`) — unconditional call asserts (debug) or reads OOB (release) on an 8-operand texture.

The pass that attaches the format operand, `resolveTextureFormat` (`source/slang/slang-ir-resolve-texture-format.cpp`), only walks `module->getGlobalInsts()` — it never visits function-parameter / non-global texture insts. So a parameter-typed `Texture2D` can reach emit with operand-count 8.

Canonical safe pattern (mirror it at every reader): `type->hasFormat() ? (ImageFormat)type->getFormat() : ImageFormat::unknown` — see `getSpvImageFormat` at `slang-emit-spirv.cpp:2899`. As of slang#11499 the readers were: `slang-emit-spirv.cpp` (asm-operand `ImageType`/`SampledImageType` arm), `slang-ir-util.cpp` `getTextureTypeFromCombinedTextureSampler`, and `slang-ir-resolve-texture-format.cpp` `resolveTextureFormatForParameter`.

## 2. When synthesizing a format constant, use `getIntType()` NOT `getUIntType()` — hoistable cache dedup depends on it

The schema declares `let format:int` (signed) — `source/slang/hlsl.meta.slang:832` (`struct _Texture<…, let isCombined:int, let format:int>`). `IRTextureType` is `hoistable = true` (`slang-ir-insts.lua:417`), i.e. uniqued by operand identity. And `IRBuilder::getIntValue(IRType*, IRIntegerValue)` keys constants on the `(value, type)` pair — `keyInst.typeUse.usedValue = type` is part of the lookup (`slang-ir.cpp:2367`).

Consequence: a `uint`-typed `0` and an `int`-typed `0` are DISTINCT `IRConstant`s, which produce DISTINCT, non-deduplicated `IRTextureType` instances. If one code path builds the format operand as `uint 0` and another as `int 0`, the hoistable type cache fragments — two `OpTypeImage` for the same logical type. Build all synthesized format constants with `getIntType()` to match the declared schema and the adjacent `isCombined` operand.

Caveat / pre-existing drift (filed as slang#11503): `resolveTextureFormatForParameter:54` itself uses `getUIntType()`, but its synthesis is guarded by `if (format != ImageFormat::unknown)` so it never emits the `0`-valued constant that would collide — latent, not a live bug. Don't "harmonize" everything to `uint` based on that site; the schema (`int`) is the source of truth.

## 3. Meta-lesson: verify triage hypotheses AND reviewer claims against source/debug-build before shipping — twice in this chain a confident, well-cited claim was wrong

- The triage memo's root-cause hypothesis ("`getFormatInst()` past-end on an 8-operand texture") was RETRACTED on debug-build evidence: with the proposed `hasFormat()` guard applied at the exact predicted site, the repro STILL SIGSEGV'd. The actual crash was a null-deref of the `as<IRTextureTypeBase>(...)` cast result — `operand->getValue()` was an orphan `IRParam` with null `getFullType()` AND null `getParent()`, so the cast returned null and the next member access crashed. Verification recipe: instrument the suspect line with `fprintf(stderr, …)` of the relevant pointers / `getIROpInfo(op).name`, rebuild incrementally (~3 min), run the repro, confirm the observed values match the hypothesis. The orphan-`IRParam` upstream producer is a separate bug (filed slang#11498); the partial fix converts SIGSEGV → `SLANG_UNEXPECTED` (E99997) diagnostic.
- A peer reviewer's clarity recommendation (switch `getIntType()` → `getUIntType()` to match a "canonical" producer) was ALSO wrong — it cited a site that is itself the inconsistent outlier. Resolved by verifying the schema declaration + the IR-builder keying mechanism directly (see finding #2), not by reviewer authority.

## 4. slang-test DIAGNOSTIC_TEST harness specifics

`tools/slang-test/diagnostic-annotation-util.cpp:475` matches each `//CHECK` substring against ONE emitted diagnostic's `diag.message` OR `diag.severity` OR `diag.errorCode` (or "severity errorCode"), and CONSUMES that diagnostic. So with a single emitted diagnostic you get exactly ONE `//CHECK` — you cannot pin both code and message on the same line. `E99997` is the generic `compilation-aborted-due-to-exception` catch-all (`slang-diagnostics.lua`) emitted for EVERY `SLANG_UNEXPECTED`/uncaught exception, so `//CHECK: E99997` false-passes on any unrelated internal error for that input. Prefer pinning a distinctive substring of the runtime message body for a site-specific assertion. `DIAGNOSTIC_TEST:SIMPLE` defaults to exhaustive matching (rejects `non-exhaustive` if all diagnostics already matched).
