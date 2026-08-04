---
title: "slangpy hlsl_nvapi guard: SGL_HAS_NVAPI ON/OFF is a natural experiment proving both predicate halves"
type: learning
topic: slang-compiler
source: learnings/1785745805020-slangpy-hlsl-nvapi-guard-sgl-has-nvapi-on-off-is-a.md
---

# slangpy hlsl_nvapi guard: SGL_HAS_NVAPI ON/OFF is a natural experiment proving both predicate halves

When triaging slangpy's unconditional `hlsl_nvapi` capability request (`src/sgl/device/shader.cpp:404-408`, surfaced as a hard `error[E36121]` by slang#11225 → slangpy#1087), the two CI platforms fail for **two different reasons**, and grepping the configure log for `SGL_HAS_NVAPI:` is what proves it:

- `linux-gcc`: `-- SGL_HAS_NVAPI: OFF` → the nvapi module is **never created or linked at all** (`external/CMakeLists.txt:251-259` sets it ON only iff the `slang-rhi-nvapi` CMake target exists), yet the capability is still requested → vulkan fails.
- `windows-msvc`: `-- SGL_HAS_NVAPI: ON` → d3d12 subcases **pass** (capability genuinely backed by a linked module), only vulkan fails.

So neither half of `SGL_HAS_NVAPI && type() == DeviceType::d3d12` is sufficient alone: Windows has the flag ON and still breaks on vulkan; Linux lacks the module entirely. Anyone tempted to "simplify" the guard to just the target check, or just the build flag, reintroduces one of the two failure modes. `SGL_HAS_NVAPI` is a **build-time** flag, not a runtime capability probe — easy to misread.

Two other things worth stealing from this triage:

1. **`0 assertions failed` alongside `28 test cases failed` is the signature of a module-load/compile break, not a logic break.** doctest reports the thrown exception as a failed *case* while the assertion counter stays clean (18535/18535 windows, 15593/15593 linux). If you see that shape, stop looking for a behavioural regression and go read the compiler diagnostic.
2. **On Windows, "zero d3d12 failures" is decisive evidence, not absence of evidence** — `tests/sgl/testing.cpp:73` runs `device_types{d3d12, vulkan}`, so the d3d12 subcases *did* execute and passed. Confirm the fixture actually enumerates the target before concluding a target is unaffected; on Linux (vulkan-only) the same observation would prove nothing.

Also re-confirmed the cross-repo prerequisite ordering at HEAD: `ci-latest-slang.yml`'s `build-pr` job runs `actions/checkout@v6` with **no `ref:`**, so slangpy always builds its default branch and `client_payload` controls only the *slang* ref. `SlangPy Tests` on a slang PR therefore cannot go green until the slangpy fix is **merged to main** — a draft PR changes nothing. The guard is independently landable because `external/CMakeLists.txt:85` pins `SGL_SLANG_VERSION "2026.12"` (pre-#11225), making it a green no-op today; keep the `SGL_SLANG_VERSION` bump as a separate later PR since slangpy pulls a release *tarball*, not a SHA.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785745805020-slangpy-hlsl-nvapi-guard-sgl-has-nvapi-on-off-is-a.md`_
