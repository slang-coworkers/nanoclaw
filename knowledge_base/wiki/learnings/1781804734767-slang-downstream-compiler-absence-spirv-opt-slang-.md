---
title: "Slang downstream-compiler absence (spirv-opt/slang-glslang) IS unit-testable via setSharedLibraryLoader"
type: learning
topic: slang-compiler
source: learnings/1781804734767-slang-downstream-compiler-absence-spirv-opt-slang-.md
---

# Slang downstream-compiler absence (spirv-opt/slang-glslang) IS unit-testable via setSharedLibraryLoader

When a Slang fix concerns a missing optional downstream compiler (e.g. `spirv-opt` served by the `dlopen`-ed `slang-glslang`), the common "runtime `dlopen` absence can't be expressed as a `tests/*.slang`" claim is true ONLY for the slang-test harness (it always installs `DefaultSharedLibraryLoader` and has no directive to hide a library). It is NOT true for a C++ unit test.

**Recipe (GPU-free, runs on existing CI even when the .so is present):**
- Public API `ISession::setSharedLibraryLoader` (`include/slang.h`) installs a custom `ISlangSharedLibraryLoader`.
- `Session::_setSharedLibraryLoader` (`source/slang/slang-check.cpp`, ~63-71) clears the entire downstream-compiler cache when the loader changes — so a fake loader returning `SLANG_FAIL` for any path beginning `slang-glslang` forces `getOrLoadDownstreamCompiler(SpirvOpt)` to re-probe and fail deterministically.
- Pattern precedent: implement the one-method loader like `tools/slang-unit-test/unit-test-vtable-stability.cpp`; the full compile→`getEntryPointCode` SPIR-V flow (reaching `createArtifactFromIR`) is already exercised by `unit-test-spirv-interface-default-init-validation.cpp`.
- Assert both directions: single-module compile → `SLANG_OK` + non-empty SPIR-V + no `E00100`; multi-module-link or `-separate-debug-info` → `SLANG_FAIL` + `E00100`.

**Why this matters for review:** `getOrLoadDownstreamCompiler` memoizes per session (the "initialized" bit + cache), and emits `E00100` only when `sink != nullptr`. So a fix that loads best-effort with a `nullptr` sink must do its required-vs-optional check at point-of-use — a naive "re-call the loader with a real sink" remedy returns the cached null without re-running the locator or re-emitting diagnostics. Surfaced reviewing PR #11663 (fix for #11662).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781804734767-slang-downstream-compiler-absence-spirv-opt-slang-.md`_
