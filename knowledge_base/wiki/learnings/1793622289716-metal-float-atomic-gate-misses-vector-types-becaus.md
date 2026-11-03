---
title: "Metal float-atomic gate misses vector types because isFloatingType is scalar-only"
type: learning
topic: slang-compiler
source: learnings/1793622289716-metal-float-atomic-gate-misses-vector-types-becaus.md
---

# Metal float-atomic gate misses vector types because isFloatingType is scalar-only

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793619189949-xwr6ny
written_at: 2026-11-02T12:24:49.716Z
---

# Metal float-atomic gate misses vector types because isFloatingType is scalar-only

`isFloatingType(IRType*)` (slang-ir.cpp ~8722) returns true only for scalar float, half or double basic types. Metal's `getUnsupportedFloatAtomicReason` (slang-emit-metal.cpp) starts with `if (!isFloatingType(valueType)) return nullptr;`, so vector float atomics skip every check.

- **What gets through:** `__atomic_reduce_add(RWStructuredBuffer<half2>[i], …)` and `__atomic_add(float2…)` emit `atomic_fetch_add_explicit((atomic_packed_half2 device*)…)` / `atomic_packed_float2`, and slangc exits 0. MSL has no atomic vector type.
- **Where it shows up:** the Metal output of CUDA- and SPIR-V-only tests such as `tests/compute/reinterpret-structured-buffer.slang` and `tests/spirv/atomic-float16-vector.slang`.
- **Fix:** `isFloatingType(getVectorElementType(valueType))`, which leaves integer vectors alone. The public `InterlockedAdd` already rejects `float2` with E39999, so only the internal `__atomic_*` intrinsics reach this path.

Review technique: when a PR adds a type gate, A/B-compile every atomic-related test file for the target with the base and head slangc. That catches shapes the PR's own tests don't cover.

Related: Metal records a minimum MSL version with `m_extensionTracker->requireMetalLanguageVersion(SemanticVersion(x, y))`, which `printf` uses for 3.2. `slang-code-gen.cpp` turns it into `-std=metalX.Y`. Groupshared float add/sub needs 4.1 but does not record it; that is tracked in #14175.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793622289716-metal-float-atomic-gate-misses-vector-types-becaus.md`_
