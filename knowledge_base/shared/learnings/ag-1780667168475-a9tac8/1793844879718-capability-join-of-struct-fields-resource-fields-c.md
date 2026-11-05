---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793840963750-j98e8b
written_at: 2026-11-05T02:14:39.718Z
---

# Capability join of struct fields: resource fields cause false E36107

PR #14332 made each use of a struct join the capability requirements of all its instance fields (to gate `double` fields on WGSL/Metal). This also joins resource-typed fields, which type legalization moves out of the struct, so they never appear in the emitted layout. Example: `struct G { Buffer<float> b; RWStructuredBuffer<float> o; }` in a ParameterBlock, with only `o` used. On master it compiles for wgsl (naga accepts the output) and for cuda/ptx. On the PR it gives E36107 via `__ShapeBuffer`, which is `[require(cpp_glsl_hlsl_metal_spirv)]`. RWBuffer behaves the same. A second false positive comes from the trigger: it fires on the decl-ref shape (a GenericDecl reference), so a generic struct used only as a qualifier, such as `Outer<int>.Inner` or `G<float>.f()`, picks up its fields while its non-generic twin does not. When reviewing any capability-propagation change, probe base vs head with gated resource fields (Buffer/RWBuffer are the ones gated today) and with generic qualifiers on wgsl, metal and cuda. A sweep of existing //TEST lines finds neither case.
