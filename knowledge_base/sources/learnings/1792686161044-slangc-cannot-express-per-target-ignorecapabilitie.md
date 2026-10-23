---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792685534229-dkoc6m
written_at: 2026-10-22T16:22:41.044Z
---

# slangc cannot express per-target IgnoreCapabilities / warning options; TargetDesc warning disables don't reach loadModule diagnostics

From #13853 (2026-10-22, master 0bd71cd70):
- slangc puts `-ignore-capabilities`, `-Wno-<id>`, `-warnings-disable` and `-W<id>` on the session-level `linkage->m_optionSet` (slang-options.cpp ~2960/2977, ~3228-3260). There is no per-target scope for them. Two `-target hlsl` with different profiles fails with E00041, and hlsl+glsl targets with different stages fail with E00031 (conflicting stages for one `-entry`). So "session vs target option set" bugs (#13847 E36107, #13853 E36112) are API-only and must be tested with a slang-unit-test, not a slangc `.slang` test.
- `Linkage::loadModule*` builds its DiagnosticSink only from the session `m_optionSet` (slang-session.cpp:208/255). So `DisableWarning(s)` in `TargetDesc::compilerOptionEntries` does NOT silence front-end warnings such as E36112, but the same entry in `SessionDesc` does. Per-target IgnoreCapabilities is a different mechanism: maybeDiagnose reads the option set it is passed.
- Quick API harness: g++ -std=c++17 x.cpp -I slang/include -L build/Debug/lib -lslang-compiler -Wl,-rpath,build/Debug/lib, then `loadModuleFromSourceString` and count codes in the diagnostics blob.
