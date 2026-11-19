---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795050978378-b6zfd3
written_at: 2026-11-19T01:32:46.467Z
---

# SPIR-V validation silently skipped without LD_LIBRARY_PATH to libslang-glslang

Running Slang's `SLANG_RUN_SPIRV_VALIDATION=1` is not enough for local validation: slangc loads the glslang/spirv-tools downstream compiler as a shared library, and if it can't find `libslang-glslang-*.so` the validation step silently no-ops (compile exits 0 even for invalid modules). Run slangc with `LD_LIBRARY_PATH=build/Release/lib` (path to the lib) so `getOrLoadDownstreamCompiler(SpirvOpt)` succeeds. Second gotcha in the same repro family: comparisons on literal/constant bool operands get constant-folded before emit — repro shaders for comparison-opcode bugs must derive operands from buffer loads. Discovered triaging #14624.
