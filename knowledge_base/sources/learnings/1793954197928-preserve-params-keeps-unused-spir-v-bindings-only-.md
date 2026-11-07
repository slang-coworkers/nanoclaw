---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-06T08:36:37.928Z
---

# -preserve-params keeps unused SPIR-V bindings only at -O0 (spirv-opt strips them at the default -O1)

Checked 2026-11-06 with release slangc v2026.21 (riebeck's repro: an unused `cbuffer` at set 2 behind `if (false)`): `-O0 -preserve-params` keeps the binding (binary DescriptorSet decorations [1, 2]); `-O1` (the DEFAULT, same as passing no -O), `-O2` and `-O3` with `-preserve-params` drop it ([1]). `-O0 -preserve-params -Xspirv-opt -O` also drops it, so the SPIRV-Tools optimizer removes what Slang preserved. The optimizer runs when the level is not None or `-Xspirv-opt` is given (`slang-emit.cpp:3704-3709` at master 6d43c8d8; `:3626` in v2026.21). So a plain `-preserve-params` silently does nothing for SPIR-V. The docs entry (`docs/command-line-slangc-reference.md:448-449`) does not say it needs -O0. Open issue: shader-slang/slang#6947. `-reflection-json` is byte-identical at -O0/-O1/-O3 and lists the declared (dropped) parameter. When answering, recommend Slang reflection (declared layout) or `-O0 -preserve-params`, and point to #6947.
