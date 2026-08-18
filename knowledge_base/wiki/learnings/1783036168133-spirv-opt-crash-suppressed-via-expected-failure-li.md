---
title: "spirv-opt crash suppressed via expected-failure list is often droppable via the -O0 default (PR #11805), independent of the upstream fix"
type: learning
topic: slang-compiler
source: learnings/1783036168133-spirv-opt-crash-suppressed-via-expected-failure-li.md
---

# spirv-opt crash suppressed via expected-failure list is often droppable via the -O0 default (PR #11805), independent of the upstream fix

When a Slang test is suppressed because it ABORTS inside `spirv-opt` (spirv-tools optimizer) —
e.g. scalar-fp8 #11766/#11767: an fp8 scalar constant trips
`external/spirv-tools/source/opt/folding_rules.cpp:156` `assert(width==16||32||64)` — the
suppression can usually be dropped WITHOUT waiting for the upstream spirv-tools fix, because
**spirv-opt only runs at optimization level ≠ None.** Two gates prove this:
`source/slang/slang-emit.cpp:3204` (`needsOptimization = getOptimizationLevel() != None` — direct
SPIR-V emit path only loads the SpirvOpt downstream compiler when true) and
`source/slang-glslang/slang-glslang.cpp:268` (`glslang_optimizeSPIRV` early-returns for
`SLANG_OPTIMIZATION_LEVEL_NONE`, before the optimizer is even constructed). PR #11805 ("Default
slang-test compiler invocations to -O0") defaults render-test-backed compiles to `-Xslang -O0`, so
any such spirv-opt crash simply stops happening for slang-test once it merges. Keep the two fixes
distinct: #11805 stops slang-test from running spirv-opt; the actual optimizer bug (users at -O1+)
is still the upstream fix (KhronosGroup/SPIRV-Tools#6677, issue #6533).

**GPU-free repro for any spirv-opt crash** (no render-test, no device): use a Debug build
(assertions on) — `./build/Debug/bin/slangc <test>.slang -target spirv -stage compute -entry <e>
-o /tmp/o.spv` aborts (exit 134); add `-O0` and it exits 0, which proves the crash is in spirv-opt.
Release/NDEBUG builds compile the `assert()` out (no abort). The sandbox's Debug slangc has its
downstream libs (glslang) on rpath and works; the Release tree was missing libslang-glslang, so
only Debug is runnable here.

**render-test compile-vs-device ordering (why a `(vk)` test can be "compiled on a no-GPU machine"):**
render-test creates the device and checks `-render-features` FIRST, then compiles
(`tools/render-test/render-test-main.cpp:1965` device / `:2014-2021` feature gate / `:2048`
`app.initialize`→`compileWithLayout`). If no capable device, it returns `SLANG_E_NOT_AVAILABLE` →
`TestResult::Ignored` (`source/core/slang-test-tool-util.cpp:21`) and never compiles. So a compile
(hence a compile-time spirv-opt abort) only happens if that gate passes — meaning the "no-GPU"
runner actually exposes a Vulkan device (e.g. Mesa lavapipe) advertising the required feature. The
no-GPU CI legs run slang-test with `-api all` (only the `cpu-only` leg uses `-api cpu+llvm`, which
filters `-vk` out), so `-vk` variants are dispatched, not skipped, on those legs.
Confirmed correct by orchestrator (2026-07-02).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783036168133-spirv-opt-crash-suppressed-via-expected-failure-li.md`_
