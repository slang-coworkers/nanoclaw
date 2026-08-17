---
title: "-O0 is a faithful 'no spirv-opt' proxy; spirv-opt is size/perf-only, not correctness"
type: learning
topic: slang-compiler
source: learnings/1784653425624-o0-is-a-faithful-no-spirv-opt-proxy-spirv-opt-is-s.md
---

# -O0 is a faithful "no spirv-opt" proxy; spirv-opt is size/perf-only, not correctness

For triaging/investigating anything about Slang's `spirv-opt` benefit (e.g. #9192 "perf delta attributable to spirv-opt"):

**`-O0` runs ZERO spirv-opt passes and is a valid "no spirv-opt" proxy.** Verified at HEAD 6a244fee2:
- Emit-path gate `source/slang/slang-emit.cpp:3326-3403`: `needsOptimization = getOptimizationLevel() != OptimizationLevel::None`. The opt-level switch maps `OptimizationLevel::None` → `DownstreamCompileOptions::OptimizationLevel::None`, which makes `glslang_optimizeSPIRV` (`source/slang-glslang/slang-glslang.cpp:266`) early-return with no passes.
- `spirv-opt` is **size/perf-only, NOT a correctness requirement** — Slang self-legalizes via the always-on IR pass `legalizeIRForSPIRV` (`source/slang/slang-ir-spirv-legalize.cpp:3316`), independent of `-O`. (Matches PR #11797 finding, learning 1782152994624.)

**Methodological caveats for a spirv-opt-benefit study (state these in any verdict):**
1. Binary SIZE ≠ GPU runtime — the driver re-optimizes; a size-only study can mislead a drop/keep decision. Measure GPU runtime before concluding.
2. Corpus must include LARGE real shaders (RTX Remix/Falcor). Smoke data (release slangc 2026.13.1): trivial `simple.slang` 0% delta, `atomics.slang` +10.2%, `buffer-layout.slang` +5.4% at -O0 vs default. The reported 50–70% size win only shows on large shaders; tests/-only corpora undercount it.
3. Slang already tracks the downstream spirv-opt time slice via `addDownstreamCompileTime` (`slang-emit.cpp:3421`) — exposable for compile-time attribution without new instrumentation.
4. No existing SPIR-V size/perf regression harness in tests/ or tools/ — a study needs fresh tooling.
5. spirv-tools is bundled via DXC's SPIRV-Tools (build/_deps/dxc_source-src/external/SPIRV-Tools), not a standalone submodule — that's the "version churn" maintenance cost the issue references.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784653425624-o0-is-a-faithful-no-spirv-opt-proxy-spirv-opt-is-s.md`_
