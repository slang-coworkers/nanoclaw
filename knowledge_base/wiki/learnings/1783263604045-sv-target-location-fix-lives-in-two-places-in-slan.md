---
title: "SV_Target location fix lives in TWO places in slang-parameter-binding.cpp"
type: learning
topic: slang-compiler
source: learnings/1783263604045-sv-target-location-fix-lives-in-two-places-in-slan.md
---

# SV_Target location fix lives in TWO places in slang-parameter-binding.cpp

When making a fragment `SV_Target<N>` output derive its GLSL/SPIR-V `layout(location=N)` from the render-target index (slang#11944), the VarLayout resource `index` is the single source of truth GLSL emit + direct-SPIR-V emit read (NOT systemValueSemanticIndex). Preset it in `processEntryPointVaryingParameterDecl` for Khronos fragment SV_Target outputs.

BUT that alone only fixes the STRUCT case. For a DIRECT (non-struct) return `float4 pmain() : SV_Target1`, `collectEntryPointParameters`' result-layout base-rebasing loop (`resultLayout->findOrAddResourceInfo(kind)->index = entryPointRes->count`) CLOBBERS the preset with the running count (0). Struct FIELDS survive because their preset index is treated as an OFFSET under the struct container's base (=0 for a fragment result), and the container itself has no systemValueSemantic; a direct return's result IS the leaf, so it gets rebased. Fix both sites, gated identically.

Gate on `isKhronosTarget` (= exactly {GLSL, SPIRV, SPIRVAssembly}, slang-type-layout.cpp): WGSL/Metal derive SV_TARGET<N>→LOCATION_<N> in the IR-legalize pass `fixFieldSemanticsOfFlatStruct`, so a param-binding preset for them is a 2nd source of truth. `systemValueSemantic` keeps the user's original casing → compare case-insensitively. `[[vk::location]]` on a function return is rejected (E31002), so only SV_Target can place a VaryingOutput index on a fragment return.

**Why:** slang#11944 — out-of-order SV_Targets got locations by declaration order; codex CODE_REVIEW caught that a struct-only fix leaves the direct-return case wrong.
**How to apply:** for any "SV semantic → varying location/binding" fix in parameter-binding, check BOTH the leaf preset AND the entry-point result/param aggregation loops that rebase resource indices — a preset can be silently clobbered downstream. Also: don't trust a triage memo's adjacent-target claim (it said WGSL emits a collision here; WGSL actually emits the struct case correctly) — re-verify with the actual slangc binary before writing it into a PR body.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783263604045-sv-target-location-fix-lives-in-two-places-in-slan.md`_
