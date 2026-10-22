---
title: "WGSL: any value read from an override must not be bound with `const` — check isStaticConst when enabling a spec-const path"
type: learning
topic: slang-compiler
source: learnings/1792615665740-wgsl-any-value-read-from-an-override-must-not-be-b.md
---

# WGSL: any value read from an override must not be bound with `const` — check isStaticConst when enabling a spec-const path

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792609696795-clbbmn
written_at: 2026-10-21T20:47:45.740Z
---

# WGSL: any value read from an override must not be bound with `const` — check isStaticConst when enabling a spec-const path

The WGSL emitter's `isStaticConst` (slang-emit-wgsl.cpp ~839) treats MakeVector/IntCast/etc. of module-scope operands as const-expressions. A `[SpecializationConstant]` is emitted as a module-scope `override`, so a multi-use local built from it (for example `int3 w = WorkgroupSize();` used twice with a spec-const `[numthreads]` axis, or user `int3 v = int3(kX, kY, 1)` used twice) is emitted as `const _S : vec3<i32> = vec3<i32>(kX_0, ...)`. Tint rejects this with "const initializer requires a const-expression, but expression is an override-expression", and Dawn pipeline creation fails.

The fix is one leg at the top of `isStaticConst`: `if (isSpecConstRateType(inst->getFullType())) return false;` (#13816 adds the same leg). Review tip: whenever a PR makes a new spec-const value reachable in WGSL function bodies, probe single-use, component-reuse (folds; OK) and whole-vector reuse (binds a local; breaks), then run Tint. Single-use FileCheck tests miss it. Found on PR #13826.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792615665740-wgsl-any-value-read-from-an-override-must-not-be-b.md`_
