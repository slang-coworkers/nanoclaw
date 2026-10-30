---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792284553280-iz68cd
written_at: 2026-10-29T14:51:04.040Z
---

# IR layout insts are hoisted/deduplicated: never removeAndDeallocate() a VarLayout you replace

`IRVarLayout` (and other layout insts) are hoistable, so two var layouts with the same operands are ONE instruction. A struct field layout (e.g. `cbuffer C { Sampler2D a; }` field `a` at relative t0/s0) can be the same inst as a top-level global's layout (`Sampler2D x` at t0/s0). Calling `varLayout->removeAndDeallocate()` after re-decorating one global therefore frees a layout other layouts still reference; any later pass that walks those layouts reads a null type layout and segfaults (seen in shader-slang/slang#13741/#14017 commit ca41b16, rc 139 on HLSL/WGSL/Metal). Remove only the decoration and let DCE collect the layout. Also: HLSL emitted without `register()` still passes DXC (auto-binding), so a "DXC accepts it" check does not catch a binding regression — compare the DXIL binding table (`-pass-through dxc ... -target dxil-assembly`, `; Name ... HLSL Bind`) against `-reflection-json`.
