---
type: chain
title: "slang#14304 — SPIR-V matrix `[i][j]` / `._mij` reportedly reads row 0 (not reproduced on L40S)"
description: Human bug (JackOfBlades232) 11-04 09:45Z, dispatched to slang-triager. The triager found codegen correct and no runtime difference on L40S Vulkan. TERMINAL 11-04: the reporter withdrew it (likely a RenderDoc debugger replay bug) and closed it themselves at 11:15Z. Not a Slang bug. Re-check cancelled.
tags: [spirv, matrix, access-chain, cbuffer, driver]
resource: raw/slang-14304-triage-memo.md
---

# slang#14304 — matrix indexing reads row 0

**Report (11-04 09:45Z, human, no labels):** the reporter says `viewParams.mProj[0][0]` / `[1][1]`
(`float4x4` member of `ConstantBuffer<ViewParams>`, row-major, `-target spirv -O0`, two entry points)
always reads row 0. The `[0].x` / `[1].y` workaround fixes it. The reporter could not reduce the
large shader, and did not name a GPU or driver (Vulkan SDK 1.4.357.0, Win 11).

**Dispatch:** slang-triager, thread `gh-issue-shader-slang/slang-14304` (11-04 09:46Z). I found no
duplicate. Nearest related issues: #4360, #5822 (layout).

**Triager findings (as reported; not re-verified by me):**
- Minimal repro: SPIR-V indices are correct and spirv-val passes. `[i][j]`/`._mij` emit a chained
  OpAccessChain (matrix → column ptr → scalar), while `.x` emits a column load + extract.
- The reporter's full two-entry `-O0` SPIR-V gives a bit-identical result to the workaround on L40S
  Vulkan (0 of 4096 pixels differ) under both `-matrix-layout-row-major` and `-column-major`. A
  simulated misread changes all 4096 pixels, so the harness does detect the bug.
- Before the post, I asked the triager to request the reporter's GPU, model and driver, and a run of
  the minimal repro on their machine (11-04 09:55Z).

**Triage report (11-04 10:06Z):** bug (unconfirmed, possibly driver) / medium / SPIR-V emit / P2.
Also clean on 2026.13.1 (the version in the reporter's SDK). Hypothesis: the driver drops MatrixStride on
the second OpAccessChain (it reads 4i+4j instead of 4i+16j, which always falls in row 0).
Options: (A) fold nested chains in `slang-emit-spirv.cpp:8888/8803`; (B) the same fold, only through a column
of a layout-decorated matrix; (C) spirv-opt CombineAccessChains, rejected because it does nothing at -O0;
(D) no Slang change, report to the vendor. Recommended: confirm first, then a maintainer picks B or D.
No labels. Not handed to fixer. Repro kit: `/workspace/agent/scratch-14304/` (the triager's container).

**Issue post (verified 11-04, nv-slang-bot):** https://github.com/shader-slang/slang/issues/14304#issuecomment-6628034589
— asks the reporter for GPU/driver, a two-line probe, and `-O2` / `-O0 -emit-spirv-via-glsl` recompiles.

**Follow-up checks (11-04 ~11:20Z):** lavapipe (Mesa 22.3.6) and SPIRV-Cross 57e4efc both read the chained form
correctly. The lavapipe full-shader run at -O1 is bit-identical to the workaround.

**Terminal (verified by me 11-04):** the reporter commented "not able to reproduce anymore… may have been a renderdoc
debugger replay bug" (cmt 6629340666) and closed the issue at 11:15:31Z (actor JackOfBlades232). The bot's
closing comment is 6629377193. The triager cancelled t-2ca6af. No fixer chain.

**Open optional item (operator):** from a source read only (not run), the triager found that RenderDoc's SPIR-V debugger
appears to drop the column selector on a chained OpAccessChain into a matrix
(`spirv_debug_setup.cpp` `MakeCompositePointer`, :3360, :3570-3613 @282b28b). The upstream RenderDoc filing
needs the operator's decision. I sent it to the dashboard as an FYI with the default "not filed". A Slang-side
combined-chain emit (`slang-emit-spirv.cpp:8888/8803`) happens only if a maintainer reopens the issue.
