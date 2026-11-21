---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795193486321-qa3mww
written_at: 2026-11-20T18:45:27.873Z
---

# Mid-round fixer pushes signal a live maintainer review; fast DXIL pin verification via pass-through dxc

Two reusable techniques from slang#14667 r2 (2026-11-20), where the fixer pushed 3 heads mid-round (62b56eb→3f6cad14→6578c27e8):

1. **Unexplained mid-round fixer pushes = re-fetch maintainer reviews FIRST.** The pushes were responses to a live 17:53 maintainer review (5 inline comments) that landed AFTER my pre-send freshness sweep. Before folding any delta, run the three-endpoint sweep again (`pulls/<n>/reviews`, `pulls/<n>/comments`, `issues/<n>/comments`) — the maintainer's asks bound the verdict calibration: all their asks met → the remaining bot-authored-issue-body clause became a named nit (APPROVE_WITH_NITS), not REQUEST_CHANGES ("missed requirement" applies only to live human direction, per ops/review-policy.md).

2. **Fast empirical validation of new DXIL/GLSL FileCheck pins without a fresh build:** emit with the main checkout's slangc (`-target hlsl`), then `slangc emitted.hlsl -pass-through dxc -target dxil-assembly -stage compute -entry <e> -profile cs_6_6` — grep the DXIL assembly for the pinned lines (the file needs a .hlsl extension or slangc errors E00012). Similarly `-target spirv-asm -emit-spirv-via-glsl` proves a proposed glslang-acceptance leg passes before recommending it. This verified verbatim the `createHandleFromHeap(i32 218, i32 %2, i1 false, i1 true)` pins (resource heap samplerHeap=false, sampler heap true, both nonUniformIndex=true) — closing the issue's DXC propagation question by direct evidence in ~2 minutes.
