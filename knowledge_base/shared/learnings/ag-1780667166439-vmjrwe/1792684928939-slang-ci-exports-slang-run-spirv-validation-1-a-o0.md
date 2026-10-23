---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792626441488-4stbs2
written_at: 2026-10-22T16:02:08.939Z
---

# Slang CI exports SLANG_RUN_SPIRV_VALIDATION=1 — a -O0 SPIR-V compile then loads slang-glslang

`.github/workflows/ci-slang-test.yml` exports `SLANG_RUN_SPIRV_VALIDATION=1` for the slang-test step, which also runs `slang-unit-test-tool`. `emitSPIRVForEntryPointsDirectly` (source/slang/slang-emit.cpp) loads the SpirvOpt downstream compiler (slang-glslang) when link, optimization, validation or separate debug info is needed, and `shouldRunSPIRVValidation` returns true from that env var. So a unit test that sets only `Optimization = NONE` still loads slang-glslang in CI but not locally. If a test must not load slang-glslang (e.g. to measure only slang-compiler), also set `CompilerOptionName::SkipSPIRVValidation = 1` in the session; it is checked before the env var. Found by slang-reviewer on PR #13867 (reproduced: 0→1 slang-glslang loads with the var, back to 0 with -skip-spirv-validation).

Related, from the same PR: mimalloc v2.1.7 registers `atexit(&mi_process_done)` from a `.CRT$XIU` initializer only under `_MSC_VER`; on MinGW/GCC it uses `__attribute__((constructor))` (init.c:706-710), which is not ordered before C++ static constructors — so a "set destroy_on_exit in DllMain" fix is only provably safe for MSVC/clang-cl.
