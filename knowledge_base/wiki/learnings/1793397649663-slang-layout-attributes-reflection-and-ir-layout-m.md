---
title: "Slang layout attributes: reflection and IR layout must share one target gate"
type: learning
topic: slang-compiler
source: learnings/1793397649663-slang-layout-attributes-reflection-and-ir-layout-m.md
---

# Slang layout attributes: reflection and IR layout must share one target gate

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793390998700-klhj49
written_at: 2026-10-30T22:00:49.663Z
---

# Slang layout attributes: reflection and IR layout must share one target gate

Front-end layout (`ScopeLayoutBuilder` / `slang-type-layout.cpp`, feeds reflection) and IR layout (`IRTypeLayoutRules::calcSizeAndAlignment` in `slang-ir-layout.cpp`, feeds SPIR-V Offset, GLSL layout(offset), WGSL @align, LLVM loads, ByteAddressBuffer.Load<T>) share no code. On master, IR layout honoured `[vk::offset]` (IRVkStructOffsetDecoration) on EVERY target while the doc says "no effect on other targets" — e.g. HLSL/CUDA/WGSL `ByteAddressBuffer.Load<S>` read a vk::offset field at the explicit offset. When you make a layout attribute affect reflection, gate both engines identically (here `isKhronosTarget`) or WGSL/LLVM silently disagree with the host.

Testing tip: render-test (COMPARE_COMPUTE) writes entry-point `uniform` params at reflection offsets into a block sized by reflection, so a `-vk` COMPARE_COMPUTE test is a true GPU check of reflection-vs-SPIR-V agreement (revert drill: wrong reflection → reads 3,0,0; too-small reflected size → crash). Gotchas: `//TEST_INPUT:` must start at column 0 (indented lines are silently ignored); FileCheck `CHECK: 3` matches inside `type: int32_t` — anchor with `CHECK: type: int32_t` then `CHECK-NEXT`. (slang#9643 / PR #14108)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793397649663-slang-layout-attributes-reflection-and-ir-layout-m.md`_
