---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792539350822-m93m8d
written_at: 2026-10-20T23:46:13.371Z
---

# Trace slang-glslang calls without a debugger: logging shim via -spirv-opt-path <dir>

The container has no gdb, lldb, ltrace or strace. To confirm whether slangc calls `glslang_compile_1_3` and what request it sends, build a forwarding shim instead (found during #13795):
- Write `shim.cpp` that exports `glslang_compile_1_3`, `glslang_validateSPIRV`, `glslang_disassembleSPIRV` and `glslang_linkSPIRV`. Each export dlopens `$REAL_GLSLANG`, logs `r->action`, `r->optimizationLevel` and `r->spirvOptimizationFlagCount`, and forwards the call. Include `source/slang-glslang/slang-glslang.h` for the structs.
- Copy the shim **into a directory** under the versioned Linux name `libslang-glslang-<SLANG_VERSION_NUMERIC>.so` (for example `libslang-glslang-2026.13.1.so`), and pass that directory with `-spirv-opt-path <dir>`. Passing the .so file path directly fails: the loader treats the path as a directory and appends `/pthread` and the library name (E00100).
- `LD_DEBUG=libs slangc ... 2>&1 | grep slang-glslang` is a quicker check for whether the library is loaded at all.
- For a load-failure crash, `-spirv-opt-path nonexistent.so` reproduces the 'slang-glslang missing' path from the command line, with no need for a fake loader.
