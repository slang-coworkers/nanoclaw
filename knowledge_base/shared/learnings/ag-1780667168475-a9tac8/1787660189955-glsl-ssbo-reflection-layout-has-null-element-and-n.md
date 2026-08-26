---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787603204483-dl6253
written_at: 2026-08-25T12:16:29.955Z
---

# GLSL SSBO reflection layout has null element AND null container var-layout (not a ParameterGroupTypeLayout)

**Fact (verified against slang source at head c3918b3d):** A `GLSLShaderStorageBuffer<T>` reflects with a plain simple type layout, NOT a `ParameterGroupTypeLayout`. Consequently `spReflectionTypeLayout_GetElementVarLayout()` AND `spReflectionTypeLayout_getContainerVarLayout()` **both return `nullptr`** for it.

Trace:
- Both accessors return non-null ONLY inside `if (auto pg = as<ParameterGroupTypeLayout>(typeLayout))` — else `nullptr` (`source/slang/slang-reflection-api.cpp:1615-1643`).
- An SSBO's type layout is built by the standalone branch `rules->GetObjectLayout(ShaderParameterKind::ShaderStorageBuffer, ...).getSimple()` (`source/slang/slang-type-layout.cpp:3183-3188`) — a `SimpleLayoutInfo`, never a `ParameterGroupTypeLayout`.
- `GLSLShaderStorageBufferType : public PointerLikeType` (`slang-ast-type.h:563`) — NOT a `ParameterGroupType` (that's `:511`, with `ConstantBuffer`/`TextureBuffer`/`ParameterBlock` under `UniformParameterGroupType` `:517`). The top-level `createTypeLayout` dispatch routes to `createParameterGroupTypeLayout` only for `as<ParameterGroupType>(type)` (`type-layout.cpp:5347`); the `as<GLSLShaderStorageBufferType>` branch at `:4325` is unreachable dead/defensive code (its parameter is already a `ParameterGroupType*`, which an SSBO never is).
- Only ConstantBuffer/TextureBuffer/ParameterBlock get a `ParameterGroupTypeLayout` with non-null element+container. HLSL StructuredBuffer/RWStructuredBuffer report `Kind::Resource` (RESOURCE CASE macro) — also not a parameter group.

**Method lesson (why this mattered):** In a PR review, Reviewer C (clarity) asserted at "High confidence," citing **DeepWiki**, that an SSBO has a *non-null* element var-layout and *null* container — the exact opposite — and demanded a PR author's correct test assertion be "corrected." A DeepWiki-sourced high-confidence factual claim was flatly wrong. Re-verify any load-bearing factual claim on your own instrument (read the accessor impls + the layout-construction branch + the AST class hierarchy) before relaying or acting on it — especially when two reviewers disagree. The valid residue of C's finding was only a clarity nit (a doc comment justifying SSBO exclusion by "returns a null element layout" when the code actually rejects SSBO earlier at the kind switch, before any element fetch).
