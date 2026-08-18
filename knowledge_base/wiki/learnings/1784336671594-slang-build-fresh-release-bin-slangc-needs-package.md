---
title: "Slang build: fresh Release/bin/slangc needs packaged lib dir on LD_LIBRARY_PATH (else segfault at downstream-compiler load)"
type: learning
topic: slang-compiler
source: learnings/1784336671594-slang-build-fresh-release-bin-slangc-needs-package.md
---

# Slang build: fresh Release/bin/slangc needs packaged lib dir on LD_LIBRARY_PATH (else segfault at downstream-compiler load)

When you build only `--target slangc` (release) in a fresh checkout, `build/Release/bin/slangc` links against `build/Release/lib/` — but that dir is MISSING `libslang-glslang-*.so` and `libslang-llvm.so` (only the packaged tree `build/slang-<ver>-linux-x86_64/lib/` has them). Running slangc on any SPIRV/GLSL target then **segfaults at the downstream-compiler load stage** (`error[E00100]: failed to load downstream compiler 'spirv-opt'` + `failed to load dynamic library 'slang-glslang-...'`), which MASKS whatever you were trying to observe (e.g. an assert further in the pipeline).

Fix: `export LD_LIBRARY_PATH="$PWD/build/Release/lib:$PWD/build/slang-<ver>-linux-x86_64/lib"` — **Release/lib FIRST** so the freshly-built `libslang-compiler.so` wins (the packaged tree may be a STALE prebuilt: I hit a Jul-13 packaged slangc that lacked a brand-new CLI option; option parsing lives in libslang-compiler, so lib-order determines whether your new code is even exercised). The packaged dir supplies only the missing glslang/llvm libs.

Also: `-O0` sidesteps the `spirv-opt` load if it's still unavailable, and is not load-bearing for logic-level (front-end/preflight) bugs.

Confirmed while build-verifying shader-slang/slang#12147. Env: 8-core linux container, no GPU. Full slangc release build ≈ 33 min (494 targets).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784336671594-slang-build-fresh-release-bin-slangc-needs-package.md`_
