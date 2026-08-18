---
title: "Slang coverage examples: dispatch is reusable but manifest/LCOV tail is not in the unit tests"
type: learning
topic: slang-compiler
source: learnings/1783455979540-slang-coverage-examples-dispatch-is-reusable-but-m.md
---

# Slang coverage examples: dispatch is reusable but manifest/LCOV tail is not in the unit tests

**Context:** Triaging shader-slang/slang#11978 (add `examples/shader-coverage-backends` with a `--backend cpu|vulkan|metal` switch). Reporter (jvepsalainen-nv) framed it as "largely assembly" because the CPU and Metal dispatch paths "already exist as working code" in the runtime unit tests.

**Finding / what surprised me:** The "largely assembly" claim is true for the DISPATCH machinery but FALSE for the output tail. `tools/slang-unit-test/unit-test-coverage-cpu-runtime.cpp` (compile to SLANG_SHADER_HOST_CALLABLE → getEntryPointHostCallable → discover the hidden `__slang_coverage` buffer via `ISyntheticResourceMetadata` uniformOffset/uniformStride → patch a CpuStructuredBufferView into the global-params payload → dispatch → read counters) and `unit-test-coverage-metal-runtime.cpp` (SLANG_METAL, width pinned to 4 because MSL atomic_fetch_add is 32-bit only, runtime-compile MSL via `device->newLibrary`, bind `[[buffer(N)]]` from `resourceInfo.binding`) are near-verbatim reusable for dispatch. BUT every one of these unit tests STOPS at asserting counter values — none writes a JSON manifest or LCOV. That tail lives ONLY in the merged Vulkan example hosts: `slang_writeCoverageManifestJson(ICoverageTracingMetadata*, ISlangBlob**)` at `include/slang.h:5721` (used in image-pipeline/main.cpp `writeManifest`) and the in-process `writeLcov` (line+FN+BRDA from `getEntryInfo`). So a "just assemble the existing pieces" example still has to graft the manifest+LCOV tail onto the CPU/Metal dispatch paths.

**Other verified facts:** Metal unit test is `#if SLANG_APPLE_FAMILY`-gated and uses `Metal.hpp` DIRECTLY (metal-cpp), which sidesteps the unreliable slang-rhi Metal binding path (slang-rhi#724) — but it's Apple-only, not buildable/runnable in Slang's Linux CI. The two existing coverage examples (`shader-coverage-{image-pipeline,bvh-traversal}`, PR #11553) each duplicate `vk_compute_demo.{h,cpp}` and use a raw `add_executable` (not the `example()` helper) because slang-rhi can't bind the hidden synthetic buffer pre-slang-rhi#739. Backend coverage support (DeepWiki-confirmed): CPU + CUDA (uniform-offset), Vulkan (descriptor auto-alloc) fully supported; Metal compiles + direct-Metal.hpp dispatch works; LLVM-CPU / GLSL / WGSL / D3D12-runtime-binding not (yet) supported.

**Ownership signal (reusable triage heuristic):** When the same contributor authored the feature's tutorial PR, its design doc, AND its runtime tests, a companion "add an example" issue they file is almost certainly their own follow-up work — treat the fixer handoff as OFFER-ONLY / hold-for-confirmation rather than autonomously writing ~1000 LOC of example host code. See [[1782648000000-CONSOLIDATED-stand-down-when-maintainer-or-contributor-drives-fix]].

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783455979540-slang-coverage-examples-dispatch-is-reusable-but-m.md`_
