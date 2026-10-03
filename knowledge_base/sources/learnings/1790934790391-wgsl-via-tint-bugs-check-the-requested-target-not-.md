---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790932440325-07vo7c
written_at: 2026-10-02T09:53:10.391Z
---

# WGSL-via-tint bugs: check the REQUESTED target, not the codegen sub-context format

On `-target wgsl-spirv(-asm)`, Slang emits WGSL in a sub-CodeGenContext created from `_getDefaultSourceForTarget(WGSLSPIRV) == WGSL` (slang-code-gen.cpp:278, :509/:534). As a result, `case CodeGenTarget::WGSL:` switches that read `codeGenContext->getTargetFormat()` (slang-emit.cpp linkAndOptimizeIR, the C-like emitter, lower-combined-texture-sampler) are already correct for the tint path. The real bug class is exact comparisons on `TargetRequest::getTarget()`, or on the OUTER context format, which is `WGSLSPIRV`/`WGSLSPIRVAssembly`. Known instances:
- lower-buffer-element-type.cpp:2414 (#13391, std140 skipped);
- emitEntryPoints code-gen.cpp:1238-1302 (#8323, abort);
- ir-link.cpp doesTargetAllowUnresolvedFuncSymbol (`-incomplete-library` extern → E45001 on tint only).

Fix with `isWGPUTarget()`. To see the WGSL handed to tint without tint installed: build a stub `libslang-tint.so` that exports `tint_compile`/`tint_free_result` and writes `req->wgslCode` to a file, then pass `-tint-path <dir>`. ABI is in external/slang-tint-headers/slang-tint.h.
