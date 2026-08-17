---
title: "Reflection cumulative-offset is a path property, not a node property (issue #12183)"
type: learning
topic: slang-compiler
source: learnings/1784676089970-reflection-cumulative-offset-is-a-path-property-no.md
---

# Reflection cumulative-offset is a path property, not a node property (issue #12183)

**Context:** Triaging shader-slang/slang#12183 — external user asked to promote the reflection-api *example's* cumulative-offset helpers (`calculateCumulativeOffset`, `AccessPath`/`AccessPathNode`/`CumulativeOffset`, `examples/reflection-api/main.cpp:808-939`) into the public Reflection API so apps stop copy-pasting them and stop having to track future `ParameterCategory` enum additions.

**Verified facts (@HEAD 958620c16):**
- The cumulative-offset logic exists ONLY in the example — `grep` for `calculateCumulativeOffset` / `deepestParameterBlock` / `deepestConstantBuffer` / `AccessPath` returns ZERO hits in `source/` and `include/`. So the "it's not in the library" premise is true, not assumed.
- The Slang reflection API returns *relative* offsets BY DESIGN: `VariableLayoutReflection::getOffset(category)` / `getBindingSpace(category)` (include/slang.h ~3274-3333) are relative to the immediate parent scope. Container types (ConstantBuffer, ParameterBlock) hide/transform layout units, so there is no single universally-meaningful "absolute" offset — DeepWiki confirms this is intentional.
- Reflection wrapper classes (`VariableLayoutReflection`, `TypeLayoutReflection`, …) are thin opaque-handle structs over `VarLayout*`/`TypeLayout*`, **NOT COM vtables** — so new methods/free functions are ABI-safe to *append* (no vtable-order constraint). Internal accumulators `_calcIndexOffset`/`_calcSpaceOffset`/`BindingRangePathLink` already walk VarLayout paths.

**The load-bearing design insight (why this can't be a trivial add):** cumulative offset is a property of an **access path**, not of a single reflection node. The *same* `VariableLayoutReflection` (e.g. a struct type reused in two places) appears in multiple contexts with different cumulative offsets. That is exactly why the example threads an explicit `AccessPath` with `deepestConstantBuffer`/`deepestParameterBlock` markers. So a naive `varLayout->getCumulativeOffset(category)` cannot work — the leaf doesn't know how it was reached. The real maintainer decision is *how the caller supplies the path* (auto-walking cursor with new reflection state vs. app-supplied explicit path). The category rules that must move into the library: Uniform (bytes) accumulate only to the deepest ConstantBuffer; resource/space categories accumulate offset+space to the deepest ParameterBlock, then add each outer block's `SubElementRegisterSpace`.

**Takeaway for triage:** For "add helper X from the example to the API" requests, (1) verify the gap by grepping source/include (don't assume), and (2) check whether X depends on *context the reflection node doesn't carry* — if it needs an access path / parent chain, the API shape is a genuine public-ABI design call for maintainers, not a mechanical promotion. PARK for maintainer direction; don't guess the shape by opening a PR.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784676089970-reflection-cumulative-offset-is-a-path-property-no.md`_
