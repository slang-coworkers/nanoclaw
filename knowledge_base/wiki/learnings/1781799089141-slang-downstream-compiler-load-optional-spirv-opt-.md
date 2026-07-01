---
title: "slang downstream-compiler load: optional spirv-opt is fatal via real sink + half-wired GLSLANG gate"
type: learning
topic: slang-compiler
source: learnings/1781799089141-slang-downstream-compiler-load-optional-spirv-opt-.md
---

# slang downstream-compiler load: optional spirv-opt is fatal via real sink + half-wired GLSLANG gate

From triage of shader-slang/slang#11662 (static build, `SLANG_ENABLE_SLANG_GLSLANG=OFF`, fatal `E00100: failed to load downstream compiler 'spirv-opt'` despite valid SPIR-V). Code-traced at HEAD a84f48e62. Several non-obvious facts about how Slang loads glslang-served downstream compilers:

1. **One shared lib serves four pass-throughs.** GLSLANG, SPIRV_OPT, SPIRV_DIS, SPIRV_LINK all funnel into `locateGlslangSpirvDownstreamCompiler` (`source/compiler-core/slang-glslang-compiler.cpp:464-516`) and load the single `slang-glslang.so` (`slang-glslang-<SLANG_VERSION_NUMERIC>.so` on Mac/Linux, bare `slang-glslang` on Windows). It also dlopens `pthread` first on unix — that's the stray `note: failed to load 'pthread'`.

2. **Null locator pointer SILENTLY skips; NOT_AVAILABLE does NOT.** In `Session::getOrLoadDownstreamCompiler` (`source/slang/slang-check.cpp:117-160`): `if (locator)` — a **null** func pointer skips the whole block (no load, no diagnostic). Otherwise `if (SLANG_FAILED(locator(...)))` AND `sink != nullptr` => emits `Diagnostics::FailedToLoadDownstreamCompiler` (E00100, **error** severity, `slang-diagnostics.lua:389`). So a locator that RUNS and returns `SLANG_E_NOT_AVAILABLE` still trips the error. To suppress E00100 you must either null the pointer or pass `nullptr` for the sink — completing a stub that returns NOT_AVAILABLE is NOT enough.

3. **Optional spirv-opt is loaded with a REAL sink before it's needed.** `createArtifactFromIR` (`source/slang/slang-emit.cpp:3117`) unconditionally calls `getOrLoadDownstreamCompiler(SpirvOpt, getSink())`. Base SPIR-V is already emitted (`:3094`); spirv-opt is only for OPTIONAL link (`:3169`, spirvFiles>1) / validate (`:3188`, SLANG_RUN_SPIRV_VALIDATION) / optimize (`:3224`), and the use is guarded by `if (compiler)` (`:3120`). So output tolerates a null compiler — but the sink is already poisoned with E00100, failing the compile. The deliberately-optional callers pass `nullptr` instead: SpirvDis at `slang-ir.cpp:7981`, version probes at `slang-global-session.cpp:1037/1062/1256`. This makes a missing slang-glslang.so fatal on ANY build (not just static) — explains closed #3469/#9497 too.

4. **`SLANG_ENABLE_SLANG_GLSLANG` is NOT plumbed to C++.** The CMake option (`CMakeLists.txt:162-166`) only gates BUILDING the slang-glslang MODULE target; it never becomes a compile def. A guard macro `SLANG_ENABLE_GLSLANG_SUPPORT` already exists (`slang-glslang-compiler.cpp:21-23`) but is hardcoded to 1 and unwired. The canonical wiring pattern is `cmake/CompilerFlags.cmake:227`: `SLANG_ENABLE_DXIL_SUPPORT=$<BOOL:${SLANG_ENABLE_DXIL}>` (inside `set_default_compile_options`, applied to every `slang_add_target`); source reads via `#ifndef…#define…1` then `#if` (`slang-dxc-compiler.cpp:21-25`). GOTCHA: the existing `#else` stub (`slang-glslang-compiler.cpp:550-562`) stubs ONLY `GlslangDownstreamCompilerUtil::locateCompilers` — SpirvOpt/SpirvDis/SpirvLink util `locateCompilers` are unstubbed, so flipping the macro to 0 needs the `#else` completed (or the references nulled in `setDefaultLocators`) to avoid link errors.

Triage verdict: two separable root causes — emit-layer graceful-degradation (smaller, general) + build-config gate (what the reporter asked). A reporter's "just null the locator pointers" diff is directionally right but must be #ifdef-gated, else it regresses normal builds that ship slang-glslang.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781799089141-slang-downstream-compiler-load-optional-spirv-opt-.md`_
