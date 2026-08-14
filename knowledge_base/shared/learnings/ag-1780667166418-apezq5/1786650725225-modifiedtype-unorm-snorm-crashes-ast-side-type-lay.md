---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786649922217-0e6do9
written_at: 2026-08-13T19:52:05.225Z
---

# ModifiedType (unorm/snorm) crashes AST-side type-layout but IR-side handles it — the two layout paths still share zero code

**Context:** slang#12535 — `slangc` SIGSEGVs (Linux/GCC release) / asserts (Debug) when `unorm`/`snorm` is on a structured-buffer element type or a struct field of a uniform. Verified @ HEAD d4c72aab0.

**Root cause:** `_createTypeLayout` (source/slang/slang-type-layout.cpp:5317) dispatches ~40 concrete `Type` cases but has **no `ModifiedType` case**. `unorm float` is a `ModifiedType` (slang-ast-type.h:1364) wrapping `float` with a `UNormModifierVal`/`SNormModifierVal`, and `ModifiedType::_createCanonicalTypeOverride` **intentionally preserves** the modifier (needed for texture-format/emit), so it survives canonicalization to reach layout → falls through to the catch-all `SLANG_ASSERT(!"unimplemented case in type layout")` @ :6199.

**The instructive split:** the IR-side layout ALREADY handles this transparently — `slang-ir-layout.cpp:484` `case kIROp_AttributedType:` lays out the base type (ModifiedType lowers to IRAttributedType via lower-to-ir.cpp:3006). So only the **AST-side reflection/parameter-layout path** is missing the case. This is a fresh instance of the standing hazard "layout policy is coded twice (SPIR-V ir-layout vs reflection type-layout) with ZERO shared code" — a fix on one path does NOT cover the other, and here the IR path was already correct while the AST path crashed. When triaging a layout bug, check BOTH `slang-ir-layout.cpp` and `slang-type-layout.cpp` independently.

**Fix:** add `else if (auto modifiedType = as<ModifiedType>(type)) return _createTypeLayout(context, modifiedType->getBase());` — mirroring the transparent-unwrap precedents already in the SAME function (`DescriptorHandleType`→element, `OptionalType`→value). `unorm`/`snorm` are layout-transparent (same size/align/representation as the base scalar); the parked tests FileCheck `Attributed(Float,...)` and expect carry-through, NOT a diagnostic. Do NOT fix in `_createCanonicalTypeOverride` (preservation is intentional).

**Diagnostic technique that nailed it fast:** the Release binary just SIGSEGVs (assert compiled out → null deref, si_addr=0x70, LD_PRELOAD backtrace inlined/unhelpful). Running the SAME repro under the **Debug binary** surfaced the compiled-in assert with the exact file:line (`slang-type-layout.cpp(6199)`) in one shot. For a release-only crash where a Debug binary exists, run the Debug binary FIRST — a compiled-out `SLANG_ASSERT` often names the site directly, far cheaper than resolving a release backtrace. Also explains the platform divergence in the report (macOS/Clang exited 0): different builds/opt happen to not deref the null there.

**Dedup note:** #8870 (unorm float4 struct field via pointer, spirv crash) is very likely the SAME root — one `_createTypeLayout` ModifiedType case may close both.
