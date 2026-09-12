---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789156835225-lla64t
written_at: 2026-09-11T20:11:44.641Z
---

# SPIR-V direct-emit path is unprofiled — fix is the symmetric SLANG_PROFILE mirror of the text path (issue #13016)

Extends the prior finding (learning 1785954775731) that `-emit-spirv-directly` has an empty emission timer. Filed + triaged as shader-slang/slang#13016 (reporter jvepsalainen-nv, perf initiative #12941). Verified @ HEAD 69fcc643b + empirically reproduced GPU-free (compile-time only) with `-report-detailed-perf-benchmark`.

**Structural gap (current line refs):** `CodeGenContext::_emitEntryPoints` (slang-code-gen.cpp:1169-1175) routes SPIRV+shouldEmitSPIRVDirectly() to `emitSPIRVForEntryPointsDirectly` (DEFINITION slang-emit.cpp:3670 — slang-code-gen.cpp:1054 is only a fwd-decl) → `createArtifactFromIR` → `emitSPIRVFromIR` (DEFINITION slang-emit-spirv.cpp:12161 — slang-emit.cpp:3136 is fwd-decl) → `legalizeIRForSPIRV`. NONE carry SLANG_PROFILE; `grep -rl SLANG_PROFILE source/slang/*spirv*` = 0. The text path IS covered by `emitEntryPointsSourceFromIR` (slang-emit.cpp:2891), which the SPIRV case bypasses. Watch the fwd-decl-vs-definition trap: the issue's own line numbers point at fwd-decls.

**Clean empirical demonstration (do this to prove the gap, not just grep):** compile any shader with `-report-detailed-perf-benchmark`. spirv-direct: `generateOutput` 30.5ms, only profiled child `linkAndOptimizeIR` 24.1ms → ~6.4ms unattributed with NO emit leaf. HLSL/text CONTROL (needs `-entry main`): `generateOutput` 23.95ms == `emitEntryPointsSourceFromIR` 23.93ms (fully attributed). The spirv-direct run's own populated `linkAndOptimizeIR`/`generateOutput` buckets are the non-zero control that rules out a false zero. Note text targets need `-entry` for `-o file.ext`; SPIR-V (single container) does not.

**Recommended fix = Approach A, symmetric:** add SLANG_PROFILE to `emitSPIRVForEntryPointsDirectly`. It internally calls the already-profiled `linkAndOptimizeIR` then the emit step — EXACTLY like the text path's `emitEntryPointsSourceFromIR` wraps linkAndOptimizeIR + text emit — so `tools/compile-perf/breakdown.py`'s (flat-profiler) tree reconstruction already knows the nesting (add the new name to its map if absent). Fast-follow B: SLANG_PROFILE_SECTION inside emitSPIRVFromIR/legalizeIRForSPIRV for intra-emission localization. Caveat: spirv-opt/validation (slang-glslang-compiler.cpp) is separately untimed, so a residual may persist after A.

**Framing precision (don't over-claim):** the emission cost is UNATTRIBUTED (lands in the `generateOutput (self)` residual), NOT literally invisible — the total still counts it. The reporter's deeper "super-linear emission" claim is an OPEN hypothesis that instrumentation would let you test; don't assert it without the workload.

**Routing:** classified enhancement/low/P3. Reporter self-assigned + perf-initiative owner + fix rides their in-flight branch ⇒ parent's call was NO bot PR, defer to assignee, keep briefing warm (same posture as #13010). Pattern: for jvepsalainen-nv's self-assigned perf issues, triage+confirm+recommend, but hold the fixer and let the reporter fold it in.
