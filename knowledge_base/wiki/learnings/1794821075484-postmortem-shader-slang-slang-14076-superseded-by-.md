---
title: "postmortem: shader-slang/slang#14076 superseded by PR #14342"
type: learning
topic: slang-compiler
source: learnings/1794821075484-postmortem-shader-slang-slang-14076-superseded-by-.md
---

# postmortem: shader-slang/slang#14076 superseded by PR #14342

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-11-16T09:24:35.484Z
---

# postmortem: shader-slang/slang#14076 superseded by PR #14342

# postmortem: shader-slang/slang#14076 superseded by PR #14342

**Issue:** [shader-slang/slang#14076](https://github.com/shader-slang/slang/issues/14076) — "SPIR-V: a never-written resource lowers to `OpUndef %image`, which spirv-val now rejects". Triaged bug, our chain opened draft PR [#14081](https://github.com/shader-slang/slang/pull/14081) ("SPIR-V: remove uses of undefined opaque handles instead of emitting OpUndef of an image", +618/−14, new `slang-ir-undefined-opaque-handle` pass + 2 tests).

**What happened:** R1 review landed, then R2 REQUEST_CHANGES (our reviewer) + CHANGES_REQUESTED (tangent-vector). The fixer session hit its Tier-2 cost ceiling ($301.34) on 10-30 and froze — no model request after 10-30 04:00Z; the operator never resolved the escalation. On 11-13 NV member pdeayton-nv merged [#14342](https://github.com/shader-slang/slang/pull/14342) ("Add eliminateUndefinedOpaqueHandles pass for SPIR-V", +2,500/−182), which auto-closed the issue.

**Why theirs won (not a smaller patch — a superset design):**
- #14342 introduces an explicit opt-in qualifier `[__assumeValidResourceOperands]` (AST/expr/parser/printer support in `slang-ast-expr.h`, `slang-parser.cpp`, `slang-ast-print.cpp`) threaded through `hlsl.meta.slang` texture intrinsics, PLUS a `slang-ir-eliminate-undefined-opaque-handles` pass, PLUS peephole/`specialize-resource-selection`/`specialize-function-call` integration, PLUS a ~25-test matrix (extraction, call-depth, ray-access, arrays, resource-selection, combined samplers).
- Our #14081 pass removed undefined-handle uses at legalization only, with 2 tests, no opt-in semantics — narrower contract, less spec-defining.
- A maintainer shipping the systematic version while our draft sat frozen means review attention moved to the comprehensive design.

**Transferable rules:**
1. For any future undefined/never-written-opaque-handle work, build on the merged `slang-ir-eliminate-undefined-opaque-handles` pass + `[__assumeValidResourceOperands]` qualifier (#14342); the #14081 approach is dead.
2. A cost-stopped fixer chain with open human review comments is a supersession risk that grows every day it sits: chains #14076-style (P2, maintainer-visible, reviewer REQUEST_CHANGES pending) should be escalated to the operator for Continue/Stop within ~48 h of the cost stop, not parked indefinitely. This one sat 10-30 → 11-13 and was overtaken.
3. When our draft PR remains OPEN after its issue auto-closes via another PR, close the draft with a superseded pointer the same tick it's detected (this learning).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794821075484-postmortem-shader-slang-slang-14076-superseded-by-.md`_
