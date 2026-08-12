# Slang: gate IR passes on target family, not CapabilitySet.implies(compound-alias); late-synthesize stdlib intrinsics via KnownBuiltin

Two reusable findings from slang#11509 (wave-aggregate coverage counters, PR #11511), both verified empirically + in code.

## 1. `CapabilitySet::implies(compound capability alias)` is the WRONG test for "can this target lower feature X" — especially in early IR passes

`targetRequest->getTargetCaps().implies(CapabilitySet(CapabilityName::subgroup_basic_ballot))` returned **false for default `-target spirv`, `-target cuda`, AND `-target metal`** — i.e. it never fired on the targets that DO support wave ops. Two compounding reasons:

- **`implies` semantics on a multi-target compound alias** (`slang-capability.cpp` `_implies`, ~:546-587): "x implies (c | d) only if (x implies c) AND (x implies d)". A compound alias like `subgroup_basic_ballot` (capdef) expands to one target-set per family (glsl, spirv, hlsl, cuda, wgsl, metal). `implies` iterates the OTHER set's target families and returns NotImplied for any the target lacks — so a single-family target cap set (metal-only, spirv-only…) can NEVER imply a multi-family alias. Structural, not target-specific.
- **Target cap sets are minimal at early stages.** `getTargetCaps()` for a bare `-target spirv/cuda/metal` is single-family (`{spirv_1_5}`, `{cuda}`, `{metal}`); subgroup/extension atoms (GroupNonUniformBallot etc.) are added ON DEMAND at emit, so they're absent at an early post-link IR pass regardless.

**Fix:** gate on target-family helpers (the idiomatic slang-emit.cpp approach) — `isCUDATarget`/`isMetalTarget`/`isSPIRV(targetRequest->getTarget())`/`isD3DTarget(...)` (all in slang-target.h) + `targetRequest->getOptionSet().getProfileVersion() >= ProfileVersion::DX_6_0` for the HLSL shader-model boundary. (DeepWiki's idealized claim that `implies` "should be true" was wrong — trust the empirical probe.)

## 2. Late-synthesizing calls to stdlib `[ForceInline]`/intrinsic funcs from an early post-link IR pass

Use case: an IR pass wants to emit `IRCall`s to stdlib funcs (e.g. `WaveActiveCountBits`, `WaveIsFirstLane`) and let the normal pipeline lower them.

- **They're dropped at link if unreferenced.** `slang-ir-link.cpp` `shouldCopy` keeps only `_isHLSLExported`, preserved global params, and a tiny `KnownBuiltin` allowlist. A shader that doesn't use the func → it's absent post-link.
- **Wire-up (no string-map needed):** add an enumerator to `KnownBuiltinDeclName` (slang-ast-support-types.h, internal enum — append before COUNT, implicit value, matches existing style); annotate the stdlib def with the NUMERIC form `[KnownBuiltin($((int)KnownBuiltinDeclName::Name))]` (lower-to-ir.cpp ~:1461 maps it straight to `addKnownBuiltinDecoration(enum)`, bypassing `getKnownBuiltinDeclNameFromString`); add a force-keep case in `shouldCopy`; retrieve in the pass by scanning `module->getGlobalInsts()` for `findDecoration<IRKnownBuiltinDecoration>()` (slang-ir-autodiff.cpp ~:230 idiom). Synthesized calls then resolve through inline + target-switch (+ synthesize-active-mask on CUDA).
- **Make the force-keep CONDITIONAL.** Unconditional keep leaks dead funcs into EVERY compile (KeepAliveDecoration blocks DCE), and on a target that can't lower the func (e.g. WGSL) a kept-but-unused func breaks codegen. Gate it (coverage flags etc. ARE on `linkage->m_optionSet`, same as PreserveParameters) AND on the same target-capability predicate the pass uses — expose that predicate via a header so pass + linker share one source of truth.

## 3. Mid-block CFG split idiom
`emitBlock()` = `createBlock()` + `insertBlock()` → `f->addBlock()` — a FUNCTION-LEVEL sibling block (appended at the end; block order doesn't affect CFG topology), not nested. The `setInsertBefore(inst) → emitBlock() → move inst+following into it` split pattern is in-tree at `slang-ir-lower-copy-logical.cpp:54`. spirv-val validates the resulting CFG (use `SLANG_RUN_SPIRV_VALIDATION=1`).
