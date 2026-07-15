---
name: project_12092_reflection_anyvaluesize_stride_mismatch
description: "slang#12092 reflection under-reports inferred [anyValueSize] existential element size vs emitted ArrayStride — REPRODUCED, DESIGN-GATED, routed to fixer"
metadata: 
  node_type: memory
  type: project
  originSessionId: faae76f1-8301-4688-ba0e-cb3702536349
---

**shader-slang/slang#12092** (RefuX, non-bot contributor) — reflection reports the fixed default existential element size (16 payload + 16 RTTI/witness = **32**) for an interface with an *inferred* `[anyValueSize]`, disagreeing with the emitted `StructuredBuffer<Interface>` element `ArrayStride` (**80** in repro: 16 + float4x4=64). A tool sizing CPU-side buffer packing from reflection packs at the wrong stride, corrupting every element past the first.

**Status (2026-07-14):** REPRODUCED on ToT `65a98e333` (code-proven + reporter-measured). Triager posted verdict to GitHub (issue comment 4967702700), applied `reproduced` label, set Type=Bug. Forwarded to **slang-triager → slang-fixer** over triager's peer wire (I did NOT double-dispatch). Classification: bug / medium / reflection-layout (existential types) / P2.

**Root cause (verified — phase-ordering split):** Reflection layout (front-end `_createTypeLayout`, slang-type-layout.cpp:5982) reads ONLY the AST `[anyValueSize]` attr → default 32. Emit stride comes from a LATER IR pass `inferAnyValueSizeWhereNecessary` (slang-ir-any-value-inference.cpp:419-511 @ slang-emit.cpp:1500) that grows the payload to the largest conformer and writes `IRAnyValueSizeDecoration`; reflection never consults that IR decoration. (DeepWiki claimed it IS propagated — WRONG; source + observed bug refute it.)

**DESIGN-GATED (ABI):** code comment slang-type-layout.cpp:5978-5980 calls the fixed default an ABI contract. Open question a MAINTAINER must decide before approach: is reflected existential size meant to track the *inferred* size, or is the fixed default a deliberate ABI value? Approaches — A (root fix: reflection reports inferred size; crosses front-end↔IR boundary, ABI-sensitive), B (document non-authoritative + explicit `[anyValueSize]` escape hatch), C (warn). Fixer should draft-and-hold pending the ABI decision; do not ship a real fix without it. Reporter workaround noted publicly: explicit `[anyValueSize(64)]` makes both sides agree.

Related: [[feedback_dont_close_open_proposals]], [[feedback_no_double_dispatch_peer_wired]], [[feedback_triage_github_posting]].
