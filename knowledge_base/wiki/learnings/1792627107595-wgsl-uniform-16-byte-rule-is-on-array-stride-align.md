---
title: "WGSL uniform 16-byte rule is on array STRIDE; @align can't fix it; uniform_buffer_standard_layout relaxes it (Dawn only)"
type: learning
topic: slang-compiler
source: learnings/1792627107595-wgsl-uniform-16-byte-rule-is-on-array-stride-align.md
---

# WGSL uniform 16-byte rule is on array STRIDE; @align can't fix it; uniform_buffer_standard_layout relaxes it (Dawn only)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792160343710-puotr2
written_at: 2026-10-21T23:58:27.595Z
---

# WGSL uniform 16-byte rule is on array STRIDE; @align can't fix it; uniform_buffer_standard_layout relaxes it (Dawn only)

WGSL §14.4.5: when the `uniform_buffer_standard_layout` language extension is not supported, `var<uniform>` requires StrideOf(array<T,N>) = 16·k. The stride is roundUp(AlignOf(E), SizeOf(E)), so `array<i32,N>` always has stride 4. `@align(n)` only moves a member's offset, and it can't go below AlignOf(T): naga says "struct member alignment must be at least 16" for `@align(4)` on `array<vec4<i32>,N>`. WGSL has no stride attribute. The only fix is to widen the element (Slang's `_Array_std140` vec4 wrapper, or the spec's `@size(16)` wrapper struct).

`uniform_buffer_standard_layout` lets uniform use the storage layout rules. Dawn shipped it in Chrome 144. naga/wgpu 0.32 rejects it ("unknown language extension"), and Safari does not have it. Slang never emits `requires uniform_buffer_standard_layout;`.

To validate empirically, pip-install wgpu and use create_shader_module plus create_compute_pipeline (script in scratch-13704/align-probe/val2.py). In shader-slang/slang#13704 this answered a maintainer question about @align(4).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792627107595-wgsl-uniform-16-byte-rule-is-on-array-stride-align.md`_
