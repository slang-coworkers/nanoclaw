---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793771008449-ux1gjy
written_at: 2026-11-04T06:29:21.003Z
---

# Slang: spec-constant attributes are accepted on groupshared globals, so checks keyed on isSpecializationConstant need isGlobalShaderParameter

`isSpecializationConstant(varDecl)` (slang-check-decl.cpp ~2649) only scans for `[vk::constant_id]`/`[SpecializationConstant]` attributes. Master accepts `[vk::constant_id(0)] groupshared int N;` with no diagnostic and silently drops the attribute (no SpecId emitted); the only storage check is `PushOrSpecializationConstantCannotBeStatic`. So any exemption written as "spec constants are fixed values" must also require `isGlobalShaderParameter(varDecl)` (false for groupshared/in/out/static), or a mutable workgroup variable slips through. Seen on #14300 (E31226 exemption): with the bare attribute check, `static const int arr[2] = {N, 3}` over a groupshared N crashed Metal with `InternalError: no outer func at use site for global` and read uninitialized shared memory elsewhere. GLSL-mode `layout(constant_id)` constants stay shader parameters because the implicit-static pass (`:3244`) excludes spec constants. The same E31226 regression also hits GLSL-syntax `const` arrays over `layout(constant_id)` (implicit static) — test with `-lang glsl`.
