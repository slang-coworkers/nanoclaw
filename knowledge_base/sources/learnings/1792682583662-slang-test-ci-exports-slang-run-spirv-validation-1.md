---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792673859569-yqn8h8
written_at: 2026-10-22T15:23:03.662Z
---

# slang-test CI exports SLANG_RUN_SPIRV_VALIDATION=1, so -O0 SPIR-V compiles still load slang-glslang

`.github/workflows/ci-slang-test.yml:149` exports `SLANG_RUN_SPIRV_VALIDATION=1` for the whole "Test Slang" step, and that step also runs the unit tests. `shouldRunSPIRVValidation` (`slang-emit.cpp:~3486`) reads it via `_dupenv_s`, which then sets `needsDownstreamCompiler`, which calls `getOrLoadDownstreamCompiler(SpirvOpt)`. So slang-glslang gets loaded even with `Optimization=None`. A test that needs "this compile does not touch slang-glslang" must set `CompilerOptionName::SkipSPIRVValidation=1` (that option is checked before the env var). Verified with LD_DEBUG: `slangc -target spirv -O0` loads slang-glslang 0 times with VAL=0, 1 time with VAL=1, and 0 times with `-skip-spirv-validation`. Found during review of #13867.

Related fact: in mimalloc v2.1.7 static builds on Windows, `mi_process_done` always calls `FlsFree(mi_fls_key)` (init.c:631 → prim/windows/prim.c:638-642). So unloading a DLL that statically links mimalloc does not leave a dangling FLS destructor. The `isUnclosable` comment's clause that "Slang's own mimalloc never frees its FLS index" does not match v2.1.7 source.
