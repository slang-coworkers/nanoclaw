---
title: "Slang E36107 capability check: entry-point-scoped, not all-declarations; ci-latest-slang log is ground truth"
type: learning
topic: slang-compiler
source: learnings/1785453629709-slang-e36107-capability-check-entry-point-scoped-n.md
---

# Slang E36107 capability check: entry-point-scoped, not all-declarations; ci-latest-slang log is ground truth

Verified while reviewing slangpy PR #1083 (guard `Buffer<uint>` test entry point from CUDA).

**1. E36107 fires on entry-point-reachable typed `Buffer<T>`/`RWBuffer<T>`, NOT on unreferenced globals.** DeepWiki claimed (reading the capabilities *design doc*) that capability checks apply to all declarations including unused globals. The actual slang implementation is narrower: in the ci-latest-slang run built on slang #12289 (slangpy run 30582422093), `test_shader_cursor.slang` — which has a global `Buffer<uint> u_buffer;` at line 114 that is declared but never referenced by its `compute_main` entry point (only use is commented out) — **PASSED 6/6 on CUDA**. Meanwhile `test_buffer.slang`, whose `copy_buffer_uint` entry point takes `Buffer<uint>`/`RWBuffer<uint>` params, failed E36107. Lesson: trust the CI failure log over DeepWiki's design-doc reading for whether a given usage trips a diagnostic. The E36107 message form: "entrypoint '<name>' uses features that are not available in '<stage>' stage for '<target>' compilation target" → points at the `[require]` on `__ShapeBuffer` in core.meta.slang.

**2. Whole-module capability check sinks clean siblings.** Slang capability-checks ALL `[shader]` entry points in a module at module load. So one CUDA-illegal entry point (`copy_buffer_uint`) makes `Module.load`/`load_program` fail for the ENTIRE module — the failing tests were the innocent `byte_address_buffer` + `structured_buffer_uint` siblings (which are CUDA-legal), not `buffer_uint` itself (already pytest.skip-ed). Fix = `#ifndef __TARGET_CUDA__ … #endif` around just the illegal entry point (precedent: src/sgl/device/blit.slang:61-86). Do NOT guard StructuredBuffer/RWStructuredBuffer/ByteAddressBuffer — those lower to real pointers and work on CUDA.

**3. Reviewing a slangpy-vs-slang compatibility fix without a matching local build:** the pinned slang (`external/CMakeLists.txt` `SGL_SLANG_VERSION`) often does NOT contain the new diagnostic, so a local build can't reproduce the failure. Ground truth is the `ci-latest-slang.yml` run for that slang PR (repository_dispatch, `gh run list --workflow=ci-latest-slang.yml`). `gh run view <id> --log-failed | grep` the exact `FAILED …` + `E36107` lines — that log tells you precisely which tests break and confirms completeness (whether other modules are latently affected). Also: the `cpp -P -D__TARGET_CUDA__ file.slang` trick verifies preprocessor-guard stripping content-agnostically, no GPU/build needed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785453629709-slang-e36107-capability-check-entry-point-scoped-n.md`_
