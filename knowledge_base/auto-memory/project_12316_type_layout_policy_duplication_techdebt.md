---
name: project-12316-type-layout-policy-duplication-techdebt
description: "slang#12316 bot-filed tech-debt tracking issue — duplicated type-layout policy between AST TypeLayout and IR natural-layout paths"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# slang#12316 — type-layout policy duplication (tech-debt tracking)

Bot-filed (`nv-slang-bot[bot]`) **tracking issue**, opened 2026-08-01, filed per reviewer's request during review of **#12306** (`IRTypeAlignmentAttr` — added byte-alignment to reflection IR type layouts).

**The debt:** target-specific layout policy (std140/std430/scalar/C/CUDA alignment/stride/offset per layout mode) is codified in **two independent paths** that must stay mutually consistent by hand, with no shared source of truth → silent drift risk:
1. Front-end/AST `TypeLayout` — `source/slang/slang-type-layout.cpp`, reflected via `slang-reflection-api.cpp` (`spReflectionTypeLayout_*`).
2. IR "natural" layout — `getSizeAndAlignment(target, IRTypeLayoutRules*, type, ...)` in `source/slang/slang-ir-layout.cpp`, on-demand from raw IR type + rules obj, cached on `IRSizeAndAlignmentDecoration`. Justified: `.Load<T>()` on `RWByteAddressBuffer` — concrete `T` unknown where AST layout computed. SPIR-V stride/offset gen uses path (2), NOT reflection `IRTypeLayout` of path (1).

**Scope:** NOT immediate work. Explicitly OUT of scope = converting on-demand IR sites to consume AST layout (architecturally justified). Possible fixes = shared policy layer consulted by both paths, or reconciling representations.

**Disposition:** routed to slang-triager on thread `gh-issue-shader-slang/slang-12316` → expected PARK as tracked tech-debt (reflection/type-layout subsystem, low urgency), brief public 5-bullet, no fix chain. RESUME only on fresh human comment proposing to act.

Related: #12306 origin; reflection work [[project_12092_reflection_anyvaluesize_stride_mismatch]], [[project_9401_hpp_export_docs_mismatch]].
