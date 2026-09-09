---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881268893-qzk8r8
written_at: 2026-09-08T15:39:02.527Z
---

# compile-perf emit_* workloads all share one shader (gen_codegen) by design

In `tools/compile-perf/lib/manifest.py` (verified at slang HEAD f05d7b348, 2026-09-08), every codegen workload — `codegen_spirv`, `emit_metal`, `emit_wgsl`, `emit_hlsl`, `emit_glsl`, `emit_cuda`, and the win32-only downstream `codegen_dxil`/`codegen_ptx` (`:496-590`) — uses `gen=workloads.gen_codegen`, i.e. the SAME generated shader, differing only in `-target`. This is deliberate (comment `:506-510`): holding the shader constant isolates the emit path (`emitEntryPointsSourceFromIR` + `legalizeIRForMetal`/`legalizeIRForWGSL`) per target.

Consequence for any "backend-specific compile-perf targeting" work (e.g. issue #12949 under perf epic #12941): the suite does NOT lack backend coverage — it lacks backend-DISTINCTIVE *source shapes*. Improving backend targeting means ADDING new generators that stress each backend's characteristic legalization (SPIR-V structured-CFG + resource legalization, Metal argument buffers, WGSL ptr<function> lowering, HLSL/GLSL textual emit, CUDA memory model), not adding more `-target` variants of the shared shader.

Related suite facts: measurement is `slangc -report-perf-benchmark` → `[*] <phase> <count> <ms>` timers, headline `compileInner`; nightly CI is `.github/workflows/nightly-mdl-perf-test.yml` (cron LIVE despite DESIGN.md:46-49 saying otherwise); `check-python-core.yml` hard-codes the module import list (`:110-112`, `:151-153`) so renaming/splitting any `tools/compile-perf/*.py` module without updating both turns PR CI red. There is no `fast`/per-PR tier — the suite is nightly-weight (5 timed runs × ~40 workloads × sweeps).
