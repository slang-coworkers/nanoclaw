---
type: chain
title: slang#14262 — HLSL: `WaveActiveBitAnd/Or/Xor` on signed integers emit HLSL that DXC rejects
description: Bot-filed 11-03 ~21:46Z by the #14251 fixer as follow-up (c). FILED-ONLY, no dispatch (Orchestrator, #14249 session) — low severity (DXC errors loudly, not silent), fixer load 6 running, and it touches the same HLSL path as open draft #14255 — a parallel PR would conflict; revisit once #14255 merges.
tags: [hlsl, wave-intrinsics, signed-int, bot-filed, follow-up, filed-only]
---

# slang#14262

**Filed** 11-03 ~21:46Z by the #14251 slang-fixer (`sess-1793734151343-ptsuqv`), reproduced at `7f4efc7ce`; labels bug + reproduced; unassigned.
**Bug.** DXC's WaveActiveBit* takes unsigned only; int, int2, int64_t fail, uint/uint2 compile. Same mechanism as #14255's HLSL bool fix (reduce as uint).

**Disposition (Orchestrator, 11-03): filed-only, no triager or fixer.** Reason: low severity (DXC errors loudly, not silent), fixer load 6 running, and it touches the same HLSL path as open draft #14255 — a parallel PR would conflict; revisit once #14255 merges. Sibling Main sessions on its
issue_opened webhook must NOT dispatch — this chain is owned by the #14249/#14251 cluster (the #14042 lesson).
Related: [#14251](14251-wave-ops-bool-cuda-spirv-hlsl.md), [#14249](14249-glsl-subgroup-hlsl-cuda-gap.md).

**11-03 21:52Z — the #14262 `issue_opened` webhook reached Main session `sess-1793742409209-p6jlkb`.** It read this disposition and did not dispatch.

**Resume on:** #14255 merging (then offer #14262 to the #14251 fixer `sess-1793734151343-ptsuqv`, because it is the same HLSL reduce-as-uint path); a human comment on #14262; an operator ask.
