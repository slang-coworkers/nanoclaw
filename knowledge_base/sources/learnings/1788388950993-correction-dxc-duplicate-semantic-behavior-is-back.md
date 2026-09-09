---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788387468706-vzyn09
written_at: 2026-09-02T22:42:30.993Z
---

# CORRECTION: DXC duplicate-semantic behavior is backend-split (DXIL errors, SPIR-V has an index-0 gap)

Corrects the earlier learning "DXC errors on duplicate semantics; Slang silently re-indexes them", which overstated DXC as erroring "on both paths." Verified against the DXC sources vendored in the Slang build (`build/_deps/dxc_source-src/`):

**DXC is inconsistent on the *mixed* spelling `TEXCOORD` + `TEXCOORD0`** (both index 0):
- **DXIL/native (D3D): errors.** Signature lowering normalizes via `Semantic::DecomposeNameAndIndex`, so both become `(TEXCOORD,0)` and collide. SROA-parameter pass comment (`lib/Transforms/Scalar/ScalarReplAggregatesHLSL.cpp:4589-4597`): duplicate → "will later on fail validation due to duplicate semantics."
- **DXC SPIR-V (Vulkan): does NOT catch the mixed spelling.** `StageVar::getSemanticStr()` (`tools/clang/lib/SPIRV/DeclResultIdMapper.cpp:718-729`) returns the *raw source string* when `index==0` (with an explicit `// TODO: this looks like a hack` comment). `checkSemanticDuplication` (`:2138-2177`) keys a `StringSet` on that, so `"TEXCOORD"` ≠ `"TEXCOORD0"` and they slip through. It only flags identically-spelled index-0 dups (`ABC`+`ABC`, `TEXCOORD0`+`TEXCOORD0`); test `tools/clang/test/CodeGenSPIRV/semantic.duplication.hlsl` only covers identical spellings. (Nonzero indices ARE reconstructed as name+index, so e.g. `TEXCOORD01`/`TEXCOORD1` would share a key — edge case.)

**Slang scoping fix:** the silent re-index (`fixFieldSemanticsOfFlatStruct`, `source/slang/slang-ir-legalize-varying-params.cpp:3800` → `_returnNonOverlappingAttributeIndex` `:3707`) runs ONLY inside `LegalizeMetalEntryPointContext`/`LegalizeWGSLEntryPointContext` (`legalizeEntryPointVaryingParamsForMetal`/`ForWGSL`, `:5185`/`:5214`) — i.e. **Metal/WGSL only**, not universal. HLSL/D3D output passes semantics through to DXC (which then errors). Front-end has no generic duplicate-user-semantic diagnostic (only SV-specific like `MultipleDepthOutputSemantics`, `slang-check-shader.cpp:2072`).

**Process lesson:** don't state DXC behavior from DeepWiki inference alone — DXC source is vendored locally under `build/_deps/dxc_source-src/`; read it. A codex OUTPUT_REVIEW caught the overstatement before it stood.
