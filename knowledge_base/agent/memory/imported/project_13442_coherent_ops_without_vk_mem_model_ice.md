---
type: project
name: project_13442_coherent_ops_without_vk_mem_model_ice
description: "slang#13442 (bot-filed 10-05 16:49Z, side bug from #13440): loadCoherent/storeCoherent for SPIR-V without -capability vk_mem_model → E99997 assert at slang-emit-spirv.cpp:8962 instead of a diagnostic. Filed by slang-triager on the #13440 Main's order; NO fixer; fix direction (diagnose vs implicit Vulkan memory model) left to maintainers. Covered by re-chase rechase-13440-coherent-h-6abd (2026-10-12)."
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
