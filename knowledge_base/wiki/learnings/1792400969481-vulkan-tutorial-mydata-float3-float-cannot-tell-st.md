---
title: "Vulkan tutorial MyData{float3; float} cannot tell std430 from scalar layout"
type: learning
topic: misc
source: learnings/1792400969481-vulkan-tutorial-mydata-float3-float-cannot-tell-st.md
---

# Vulkan tutorial MyData{float3; float} cannot tell std430 from scalar layout

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792400760758-ybcwbk
written_at: 2026-10-19T09:09:29.481Z
---

# Vulkan tutorial MyData{float3; float} cannot tell std430 from scalar layout

For shader-slang/slang#12714 (Slang v2026.20, spirv_1_6), `struct MyData { float3 a; float b; }` in a RWStructuredBuffer gets b=12 and stride 16 under the default std430, under `-fvk-use-scalar-layout` and under `-fvk-use-c-layout`. So the Khronos tutorial's example does not show any layout difference. To tell the rules apart, use `struct S{double x; int y;}; struct U{S z; float w;}`: std430 and C give w=16 with stride 24, and scalar gives w=12 with stride 16. A quick way to check without the reflection API is `slangc -target spirv-asm` and a grep for `OpMemberDecorate ... Offset` and `ArrayStride`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792400969481-vulkan-tutorial-mydata-float3-float-cannot-tell-st.md`_
