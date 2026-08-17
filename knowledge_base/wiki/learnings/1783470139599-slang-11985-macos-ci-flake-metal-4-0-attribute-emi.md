---
title: "slang#11985 macOS CI flake = Metal 4.0 attribute emitted vs sub-4.0 compile target"
type: learning
topic: slang-compiler
source: learnings/1783470139599-slang-11985-macos-ci-flake-metal-4-0-attribute-emi.md
---

# slang#11985 macOS CI flake = Metal 4.0 attribute emitted vs sub-4.0 compile target

**Symptom:** `test-macos-release-clang-aarch64 / test-slang` intermittently red on free `macos-latest` runners. Two faces of ONE cause: (1) `slang-test` `gfx-unit-test-tool/*Metal.internal` tests `failed(pending retry)` with `[Failed]: !SLANG_FAILED(device->createComputePipeline(...))` — the useful error is a few lines above the `[Failed]` line: `metal ...: error: 'required_threads_per_threadgroup' attribute requires Metal language standard metal4.0 or higher`; (2) the JOB-FAILING step is actually the `examples` step, where `gpu-printing` exits **255** silently (its `exampleMain` maps any `SLANG_FAILED` → `return -1`). Don't stop at "createComputePipeline failed" or "gpu-printing exit 255" — grep the log for the masked `metal ...: error:` line.

**Root cause (code-proven @ ToT 33f9ed0ce):** emitter emits the Metal-4.0-only kernel attribute `[[required_threads_per_threadgroup(...)]]` unconditionally for the *default* Metal target — gate is `getTargetCaps().implies(metallib_4_0)` at `slang-emit-metal.cpp:213`, and `alias metallib_latest = metallib_4_0` at `slang-capabilities.capdef:207` (flipped from `3_1` by PR #10592 / 72fdc442c, which also added the attribute). BUT the shader is compiled against sub-4.0: offline metal invoked with `-std=metal3.1` (`slang-gcc-compiler-util.cpp:973`); slang-rhi runtime passes only `Capability::metal` with no 4.0 `MTLLanguageVersion` (`external/slang-rhi/src/metal/metal-device.cpp:252,329`). So emit says 4.0, target says <4.0 → rejected on any runner whose Metal toolchain defaults below 4.0. The intermittency is free-runner Metal-version heterogeneity, NOT randomness.

**Triage lessons:** (a) A "createComputePipeline failed" / exit-255 macOS example failure can be a real emit-vs-target capability bug, not just infra — refutes the "runner-health" framing in #11973 for this signature. (b) `metallib_latest` being hardcoded to the newest version means every default Metal compile emits newest-version features regardless of the actual toolchain — a structural mismatch to watch for on any new gated Metal/SPIR-V feature. (c) Rec fix = gate emit on the EFFECTIVE metal language version, not `metallib_latest`; forcing `-std=metal4.0` at the consumer just breaks genuinely-old toolchains.

**Env note (2026-07-07/08 window):** `gh` briefly returned `app_not_connected` (invalid GH_TOKEN routing placeholder) and Explore/WebFetch subagents 403'd with Haiku "Model access denied — AWS Marketplace subscription still processing". gh recovered on its own within minutes; drive code analysis directly on Opus when recall/WebFetch subagents are down.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783470139599-slang-11985-macos-ci-flake-metal-4-0-attribute-emi.md`_
