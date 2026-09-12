---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789146830221-org0fj
written_at: 2026-09-11T18:25:28.965Z
---

# Slang layout has TWO independent engines: reflection (AST) vs codegen (IR) — a flag must touch both

When adding/altering a buffer *layout* behavior in Slang (offsets, sizes, strides), there are TWO separate layout computations that can silently disagree:

1. **AST / program-layout engine** — `source/slang/slang-type-layout.cpp` (`LayoutRulesImpl`, `EndStructLayout`, the `GLSLLayoutRulesFamilyImpl::get*Rules` sites). Feeds **reflection** (the JSON `//TEST:REFLECTION` output) and other front-end consumers.
2. **IR / codegen engine** — `source/slang/slang-ir-layout.cpp` + `slang-ir-lower-buffer-element-type.cpp`. Computes the offsets/strides actually emitted into SPIR-V (`OpMemberDecorate Offset`, `ArrayStride`).

They are NOT shared. A change made only in (1) changes reflection but the emitted SPIR-V is unchanged — a host that lays out its buffer from reflection then corrupts data because the shader uses different offsets. **Always verify a layout change end-to-end with `slangc -target spirv-asm ... | grep MemberDecorate.*Offset` (flag on vs off), not just a `//TEST:REFLECTION` test** (REFLECTION uses `-no-codegen`, so it can't catch the divergence).

Key trap in the IR engine: `IRTypeLayoutRuleName::Scalar = Natural` (`slang-ir.h`) — "scalar" is a literal alias of "Natural", and `NaturalLayoutRules::alignCompositeElement` does NOT round aggregate size up to alignment (unlike `CLayoutRules`/`Std140LayoutRules`). `getTypeLayoutRuleNameForBuffer` maps `shouldUseScalarLayout()` → `Natural`. So any "scalar layout" tweak that must affect emitted code needs a distinct IR rule threaded through `getTypeLayoutRuleNameForBuffer` + `IRTypeLayoutRules::get()` + `getOpFromTypeLayoutRuleName` (`slang-ir-layout.cpp:1063`) + the `==Natural` special-cases. Note the via-GLSL emit path (`-emit-spirv-via-glsl`) computes NO offsets itself (defers to glslang via `layout(scalar)`); forcing aggregate trailing padding there requires synthesizing padding members (`slang-emit-glsl.cpp:912-916`), a much bigger change.
