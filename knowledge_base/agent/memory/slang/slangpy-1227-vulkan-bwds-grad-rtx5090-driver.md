---
type: chain
title: slangpy#1227 — Vulkan .bwds() puts the whole gradient in grad[0,0] (RTX 5090 driver 617 only)
description: "Bot-filed 10-16 09:54Z by slangpy-fixer on the #1167 Main's round-2 order (PR #1225 xfails the Vulkan params against it). CI GPU = RTX 5090 (bot cmt 6288911625, 10-20). 10-28 jkwak-work self-assigned, added CI label, said driver 617 and 'we will probably need to file a driver bug'. No bot mention → not a summons, no post. Operator offered an optional 'repro' dispatch (dashboard msg 61); default = nothing, no timer."
tags: [slangpy, vulkan, autodiff, driver-bug, ci]
---

# slangpy#1227 — Vulkan `.bwds()` gradient lands in `grad[0,0]`

**Owner chain:** the #1167 chain. slangpy-fixer filed it 10-16 on the #1167 Main's order (`sess-…l3jhpp`, row 161).
PR #1225 (`fix/issue-1167`, draft, head `4e90d26e`) xfails the Vulkan params against it. PR #1225 was **parked
10-28 12:02Z with no timer** after 10 unanswered operator asks: (2) D3D12 E56019 slang issue + xfail, or hold;
(3) draft vs ready.

**Facts (re-verify before reuse):**
- Wrong gradient: NVIDIA GeForce RTX 5090, driver **617** (jkwak-work, via ccummingsNV, cmt 6475360742,
  10-28 17:01Z), with both Slang 2026.19 and 2026.20 (CI run 39394324237 XFAIL 12/12).
- Correct gradient: L40S, driver 595.91.07 (our host), XPASS 3/3 on 2026.20.
- The backward SPIR-V for the runtime-loop shape uses `VariablePointersStorageBuffer` and a Function-scope
  StorageBuffer pointer that is null on the loop-exit path (see the issue body).

**10-28:** jkwak-work self-assigned (from saipraveenb25) and added `CI`. Their comment has no @nv-slang-bot
mention, so it was held (not a summons). I sent a 5-bullet to orchestrator-dashboard (msg 61, thread
`gh-issue-shader-slang/slangpy-1227`). It offers an optional slangpy-fixer **"repro"** dispatch: attach the
`runtime_count`/`fixed_count` backward SPIR-V plus the Python repro for the driver bug. Default is nothing,
so no timer. If the operator says "repro", dispatch to slangpy-fixer on `gh-issue-shader-slang/slangpy-1167`
(fixer session `sess-1787042942592-fhnz2d`) with the maintainer's words quoted verbatim.
