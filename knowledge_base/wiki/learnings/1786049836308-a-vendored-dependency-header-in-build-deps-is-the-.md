---
title: "A vendored dependency header in build/_deps is the authoritative spelling source — and it may disagree with the spec proposal"
type: learning
topic: ci-tooling
source: learnings/1786049836308-a-vendored-dependency-header-in-build-deps-is-the-.md
---

# A vendored dependency header in build/_deps is the authoritative spelling source — and it may disagree with the spec proposal

Triaging shader-slang/slang#12411 asked: what is the exact DXC spelling for a new `dx::linalg::ComponentType` enumerator, and is it SM 6.10-only? Slang's CLAUDE.md forbids emitting HLSL named constants as integers, so the spelling must be byte-exact.

**Two sources exist and they disagree. Check both.**

1. **The spec proposal** (hlsl-specs 0035, fetched raw): spells `BFloat16 = 23`. Verified from raw bytes with a *census* rather than a single grep — 7× `BFloat16`, 1× `Bfloat16`, 0× `BF16`. ⚠ A `WebFetch` summary of the same page invented "value 23" as if inline in the enum; the real source uses a `__COMPONENT_TYPE(x)` macro expanding to `x = (uint)dxil::ComponentType::x`, with the values in a *different* enum earlier in the file. **Fetch raw and grep it yourself when the spelling is the deliverable.**

2. **The pinned dependency source, which is what actually compiles.** Slang pins DXC `v1.9.2602` (`cmake/FetchDXC.cmake:49`) and CMake leaves the full source at `build/_deps/dxc_source-src/`. That tree gave three facts no code reading would:
   - `include/dxc/DXIL/DxilConstants.h` `enum class ComponentType` **ends at `F8_E5M2 = 22`** — `grep -c BFloat16` = 0 (non-zero control `F8_E5M2` = 1). The enumerator does not exist in the pinned version.
   - the vendored `tools/clang/lib/Headers/hlsl/dx/linalg.h` has **no `ComponentType` enum at all** — only the older `enum DataType { DATA_TYPE_* }`, with `ComponentType::X` appearing solely in *trailing comments*. Grepping for `ComponentType` there returns hits that are pure comment text.
   - ⭐ **precedent that the two sources diverge:** the proposal spells `F8_E4M3FN` (17×, never bare), shipped DXC spells `F8_E4M3` (0× `FN`), and Slang emits `F8_E4M3` — i.e. Slang already follows shipped DXC over the proposal.

Reusable rules:
- Before answering "what does the downstream compiler call this?", look for the dependency's real source under `build/_deps/` — it is often fully present and beats both memory and the spec.
- A grep hit in a header may be a **comment**; print the surrounding lines before concluding the symbol is declared there.
- When proposal and shipped dependency disagree, the emitted string must follow **the version actually pinned**, and the answer needs a timestamp/version, not just a name.
- If the enumerator is absent from the pinned version, that is itself the finding: the feature cannot be emitted byte-exactly yet, and the older path may genuinely be unable to express it (here the SM 6.9 `DATA_TYPE_*` enum has no bfloat member, confirming a "keep diagnosing at the older profile" design).

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786049836308-a-vendored-dependency-header-in-build-deps-is-the-.md`_
