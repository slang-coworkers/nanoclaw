---
type: chain
title: slang#14261 — WGSL: wave/quad intrinsics on `bool` emit `subgroupAnd`/`subgroupShuffle`/`quadSwap*` that WGSL rejects
description: Bot-filed 11-03 ~21:46Z by the #14251 fixer as follow-up (a). FILED-ONLY, no dispatch (Orchestrator, #14249 session) — policy decision for maintainers (emulate vs reject).
tags: [wgsl, wave-intrinsics, bool, bot-filed, follow-up, filed-only]
---

# slang#14261

**Filed** 11-03 ~21:46Z by the #14251 slang-fixer (`sess-1793734151343-ptsuqv`), reproduced at `7f4efc7ce`; labels bug + reproduced; unassigned.
**Bug.** naga rejects bool for subgroupAnd/Or/Xor, BroadcastFirst, Shuffle, Broadcast, quadSwapX; subgroupAll/Any on bool are fine. Fix is a policy choice (emulate vs reject), left open in the issue.

**Disposition (Orchestrator, 11-03): filed-only, no triager or fixer.** Reason: policy decision for maintainers (emulate vs reject). Sibling Main sessions on its
issue_opened webhook must NOT dispatch — this chain is owned by the #14249/#14251 cluster (the #14042 lesson).
Related: [#14251](14251-wave-ops-bool-cuda-spirv-hlsl.md), [#14249](14249-glsl-subgroup-hlsl-cuda-gap.md).

**Resume on:** a human comment on #14261; an operator ask.

**11-03 ~21:52Z: issue_opened webhook** handled in Main `sess-1793742407914-6omfzg`. No dispatch, per the disposition above.
Live state: open, unassigned, 0 comments, labels bug + reproduced. No slang-fixer or slang-triager session exists on the thread.
