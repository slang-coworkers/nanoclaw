---
type: project
name: project_13442_coherent_ops_without_vk_mem_model_ice
description: "slang#13442 (bot-filed 10-05 16:49Z, side bug from #13440): loadCoherent/storeCoherent for SPIR-V without -capability vk_mem_model → E99997 assert at slang-emit-spirv.cpp:8962 instead of a diagnostic. Filed by slang-triager on the #13440 Main's order; NO fixer; fix direction (diagnose vs implicit Vulkan memory model) left to maintainers. Maintainer-owned since 10-05 (jhelferty-nv + jkwak-work, Q4 2026 milestone). Still reproduces 10-29 at 01dcd3568. Re-chase rechase-13440-coherent-59c7 (11-02)."
metadata:
  node_type: memory
  type: project
---

# slang#13442 — coherent load/store without vk_mem_model hits an internal assert

**Origin.** Side bug from the #13440 chain (OppositeNor's `globallycoherent` on descriptor-heap resources feature
request). slang-triager found it while confirming the `loadCoherent`/`storeCoherent` workaround; the #13440 Main
session (`sess-1791216318453-n05kul`) cleared the filing at 16:44Z after checking the assert site at HEAD e6be8dcdd.

**Filed 16:49Z by nv-slang-bot** via slang-triager: Type=Bug, labels `reproduced` + `SPIR-V`, no priority. Body cites
`getMemoryAccessOperandsOfLoadStore` (slang-emit-spirv.cpp:8938, assert :8962-8965) and the memory-model pick in
slang-ir-spirv-legalize.cpp:2604-2607; the "front-end E41012 capability upgrade never reaches the legalize check"
explanation is an **untraced hypothesis**. Two candidate fixes offered, choice left to maintainers.

**Disposition: owned, nothing to dispatch.** The `issue_opened` webhook (16:49Z) was the filing's self-echo; the
owner-lookup ladder hit on rung 1 (#13440 sessions) and rung 4 (the re-chase task). The #13440 Main reported it to
the operator at 16:52Z and asked whether to route a fixer now; **that operator decision is open**.

**Resume path.** `rechase-13440-coherent-h-6abd` (once, 2026-10-12 16:30Z) checks #13442 for human comments since
16:50Z and relays a maintainer direction to slang-triager on `gh-issue-shader-slang/slang-13442`. Resume early on a
non-bot comment or an operator "work it now".

**10-05 18:06Z, maintainer pickup:** jhelferty-nv assigned jhelferty-nv + jkwak-work and set milestone Q4 2026 (Fall).
There are no comments and no PR yet. The re-chase has rolled over to `rechase-13440-coherent-59c7` (due 2026-11-02).

**10-29, operator asked for triage (dashboard msg 50).** Answered directly with no triager dispatch, because the
filing already is the public triage. Reran the repro on the reviewer's current-master build
(`slang-reviewer/runs/base-01dcd3568`). Without the capability: rc 255, E99997 at slang-emit-spirv.cpp(9020).
With `-capability vk_mem_model`: rc 0. With `-profile spirv_1_3`: E41012 warning, then the same E99997. Verdict
given: SPIR-V backend memory-model selection, P3, maintainer-owned. A bot fixer stays off unless the operator or
assignees ask for one, because it would step on assigned maintainers.
