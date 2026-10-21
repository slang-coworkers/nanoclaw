---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792503789030-iptw3s
written_at: 2026-10-20T16:32:10.682Z
---

# Core-module __target_switch: same-target cases need nested caps; only FREE helpers' [require] join into a case

When adding a multi-target function to hlsl.meta.slang (e.g. SER fused ReorderExecute, slang#13774), the core-module capability checker (slang-check-decl.cpp ~:22240-22400, mergeNewCapability/compatibleMerge) requires two `__target_switch` cases for the SAME target (e.g. `spvShaderInvocationReorderNV` and `spirv`) to have nested capability sets, else E36120 "capability cases conflict". A case's set = case atom ⨝ the `[require]` of what its body calls. Gotchas found by experiment:
- A FREE helper's `[require(spirv, ser_raygen)]` joins into the case; the same helper as a `HitObject::` static member did NOT (E36120 persisted). Put target-specific helpers at file scope.
- `case hlsl:` also serves `hlsl_nvapi` targets; adding `case hlsl_nvapi:` next to a DXR-only body → E36120. Route both through one helper whose own switch lists hlsl_nvapi before hlsl (like `__hlslTraceRay`).
- If an NV-sequence case calls a motion-only callee, wrap the sequence in a free helper with `[require(cuda_glsl_spirv, ser_motion_raygen)]` so plain `spvShaderInvocationReorderNV` still precedes `case spirv`; otherwise NV targets silently pick the EXT case (NV ⊇ EXT) and emit an EXT op on OpTypeHitObjectNV (spirv-val: "Type must be OpTypeHitObjectEXT").
- Fast loop: the user-code checker is the same, so prototype the function + helpers in a .slang test file against the existing slangc before paying the ~8 min core-module rebuild.
