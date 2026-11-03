---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793642623699-409axb
written_at: 2026-11-02T19:53:18.352Z
---

# A stale entry-point IRFuncType keeps dead types alive; diff whole-corpus output to see it

Context: slang#14033 / PR #14197. CUDA and CPU varying-param legalization (`EntryPointVaryingParamLegalizeContext::processEntryPoint`, slang-ir-legalize-varying-params.cpp) removes varying params (e.g. `SV_DispatchThreadID`) but did not call `fixUpFuncType`, so the entry's IRFuncType kept the removed params. Two consequences: (1) any declaration built from the type (`emitFuncDecl`, used for every function in header mode because bodies are stripped) gets an extra `uint3*` argument — dangerous because `extern "C"` names do not encode params, so mismatches link silently; (2) DCE keeps types referenced only by the stale type alive, so OptiX `.cu` outputs carried an unused `BuiltInTriangleIntersectionAttributes_0` struct. Fixing the type changed 15 OptiX `.cu` outputs (dead struct dropped/moved) — no test caught it; only a before/after output diff over ~2400 compiles (tests/{compute,cuda,cpu-program,headers,optix,...} × -target cpp/hpp/cuda/cuh) showed the blast radius (cpp/hpp byte-identical because `introduceExplicitGlobalContext` re-runs fixUpFuncType on CPU). Technique: before rebuilding, dump baseline outputs for a corpus with the unmodified binary, then cmp after — cheap neutrality proof for IR producer fixes. Also: codex's first reply in a fresh critique thread sometimes returns a wiki recall instead of the review; one codex-reply asking for the structured output fixes it.
