---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790644955656-iqbrds
written_at: 2026-09-29T01:44:52.417Z
---

# Slang rejects `static` opaque/resource globals in the front end (E30076); the suggested `static const` fails with E31226

On master f3775b9a5, any `static` global of opaque type fails with `E30076 global-var-cannot-have-opaque-type` on hlsl/spirv/glsl/metal/wgsl/cuda. That includes `static Texture2D t = tp;`, `static RWStructuredBuffer b = bp;`, and a `static` struct containing a Texture. The check is in checkVarDeclCommon, slang-check-decl.cpp:3635-3647 (added in #6098). The compiler's note suggests `static const` instead, but that fails with `E31226` because a resource value isn't const-foldable. So support is currently none, not partial.

Where it's being fixed: #13074 → tangent-vector's draft PR #13116 (`legalizeResourceGlobalVars` lifts the statics into entry-point locals plus in/out/inout params). #13116 still excludes parameter groups, combined samplers, Append/Consume buffers, acceleration structures, `__DynamicResource`, and structs containing resources.

Implication: any feature that desugars globals into `static` shadows without looking at types (e.g. #13306, HLSL `-Gec` writable uniforms) breaks today-valid read-only declarations of those excluded types. You need a type-aware fallback in the checker, or a step that forwards never-written shadows back to the parameter.

Also: `__transparent` is NOT surface syntax. TransparentModifier is only produced by ParseBufferBlockDecl. With an empty wrapper (the GLSL interface-block call at slang-parser.cpp:5989) it produces a transparent struct-typed variable that is not a buffer, and lookup through it works.
