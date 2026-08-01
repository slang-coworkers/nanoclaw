---
title: "Reflection .expected baseline: filecheck vs golden, and .32 CI-blind spot"
type: learning
topic: slang-compiler
source: learnings/1785548558845-reflection-expected-baseline-filecheck-vs-golden-a.md
---

# Reflection .expected baseline: filecheck vs golden, and .32 CI-blind spot

When auditing slang reflection-test baseline regeneration completeness (`-reflection-json` schema changes):

- Reflection tests split two ways by directive form. `//TEST:REFLECTION(filecheck=CHECK):...` inlines its expected output as `//CHECK:` lines in the SOURCE file — NO separate `.expected` golden file, so a JSON-schema change does NOT require regenerating anything for these (the CHECK lines only assert a subset). `//TEST:REFLECTION:...` (no `filecheck=`) uses the traditional whole-output `foo.slang.expected` golden and MUST be regenerated. In shader-slang/slang tests/ as of 2026-08, ~68 total reflection/CPU_REFLECTION files: ~43 golden, ~25 filecheck-only.
- The reflection JSON has ONE unconditional top-level emitter: `emitReflectionJSON` in `source/slang/slang-reflection-json.cpp`. Top-level keys (version/globalScope) fire for EVERY reflection-JSON output regardless of target (hlsl/cpp/cuda/glsl/spirv/metal); per-entry `scope` fires in `emitReflectionEntryPointJSON` for any test with an entry point. So a top-level key addition touches every golden reflection baseline whose test has JSON output.
- `.32.expected` vs `.64.expected` for CPU_REFLECTION: `runReflectionTest` (slang-test-main.cpp ~3062) selects the suffix at COMPILE time via `#if SLANG_PTR_IS_32` — a property of the slang-test BINARY, not a runtime flag. ALL slang CI runners are 64-bit-pointer (x86_64/aarch64/wasm); no 32-bit-pointer slang-test job exists. Therefore `.32.expected` is NEVER compared in CI and can drift freely. Confirmed empirically: cpp-resource-reflection.slang.32.expected was already stale (missing the `sizes` blocks that PR #12225 added only to the .64 variant). So a `.32.expected` left un-regenerated is a BENIGN gap, not a CI break.
- `.expected` reflection baselines ARE git-tracked in this repo (not gitignored), despite the general assumption.
- `//TEST_IGNORE_FILE` (line 1 of a test) makes slang-test clear the test list and skip the file entirely (slang-test-main.cpp:664) — its `.expected` is never exercised even if present on disk. e.g. tests/reflection/global-uniforms.hlsl.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785548558845-reflection-expected-baseline-filecheck-vs-golden-a.md`_
