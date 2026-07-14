---
title: "Slang C++ target struct layout does not match std140/std430 — pair with -fvk-use-c-layout"
type: learning
topic: slang-compiler
source: learnings/1783986652112-slang-c-target-struct-layout-does-not-match-std140.md
---

# Slang C++ target struct layout does not match std140/std430 — pair with -fvk-use-c-layout

# Sharing a struct between Slang and C++: `-target cpp` alone is NOT a safe match

**Context:** A user asked how to keep a C++ struct's `alignas()`/layout in sync with the same struct used in a Slang GPU buffer. The tempting shortcut — "declare it in Slang, `slangc -target cpp` to emit a matching C++ struct, `#include` it" — is **dangerous/misleading as stated** (flagged by maintainer-expert hasse_official, verified against slang source via DeepWiki).

**Why it's wrong:** The Slang **C++/CPU target emitter uses standard C/C++ data layout** (`CPULayoutRulesImpl` — natural alignment, size rounded up to largest alignment). It **ignores** the GPU buffer layout rules (std140 for `ConstantBuffer`, std430/natural for `StructuredBuffer`, scalar). So a `-target cpp` struct only matches the *shader* side if that side is ALSO laid out with C rules — otherwise the two silently diverge → memory corruption.

**The fixes:**
- To hand-match structs: force the SPIR-V/buffer side to C layout with **`-fvk-use-c-layout`** (uses the same `C` rules as the CPU target → near-perfect match; the one known gap is empty structs = 0 bytes in Slang, 1 in C++). **`-fvk-use-scalar-layout` does NOT match C++ once nested structs are involved** — scalar is a compact layout, not C layout.
- Per-buffer alternative: `StructuredBuffer<T, CDataLayout>` / `ConstantBuffer<T, Std430DataLayout>` generic layout args instead of the global flag.
- **Robust default: the reflection API.** `TypeLayoutReflection::getAlignment()/getSize()/getStride()` + per-field `getOffset()` reads back the *actual* compiled layout for whatever target + rules you chose, so the C++ side can't drift regardless of layout choice. Reflection is compilation-API only (`program->getLayout()`), not the slangc CLI. Common pattern: walk reflection at build time to emit `static_assert(offsetof(...))` guards.

**Rule:** Never present `-target cpp` struct emit as a standalone cross-target match. It is only valid paired with `-fvk-use-c-layout` (not scalar) on the shader side, and only near-perfect. Prefer the reflection API.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783986652112-slang-c-target-struct-layout-does-not-match-std140.md`_
