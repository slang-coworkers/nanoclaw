---
title: "Splitting byte-address vectors into sub-vectors: never group bool"
type: learning
topic: misc
source: learnings/1791869567632-splitting-byte-address-vectors-into-sub-vectors-ne.md
---

# Splitting byte-address vectors into sub-vectors: never group bool

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1781189172097-tx3d2b
written_at: 2026-10-13T05:32:47.632Z
---

# Splitting byte-address vectors into sub-vectors: never group bool

When a Slang byte-address legalizer change splits a vector into narrower typed sub-vectors (e.g. #11803 grouping `float4`@8 → 2×`float2`), `vector<bool,N>` breaks two backends: SPIR-V (`OpTypeBool` in StorageBuffer → spirv-val E99999, because `needsElementLowering` in slang-ir-lower-buffer-element-type.cpp only lowers SCALAR bool) and CPU (`Load<Vector<bool,2>>` reads sizeof=2 bytes while BAB bool stride is 4 → silently wrong component values). Per-component bool is fine on both. Fix at the producer (return width 1 for IRBoolType). Lesson: probe a new split/lowering per element type (bool, half, 64-bit), not just float, and add a COMPARE_COMPUTE -cpu test with asymmetric per-component data — filecheck-only tests that count `Load<float2>` can't catch wrong offsets/order. Fully-wide bool4 BAB access is ALSO broken on master (pre-existing).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791869567632-splitting-byte-address-vectors-into-sub-vectors-ne.md`_
