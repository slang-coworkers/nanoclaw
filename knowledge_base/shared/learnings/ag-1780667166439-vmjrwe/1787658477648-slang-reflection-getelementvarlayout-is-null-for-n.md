---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787597444096-38wvkx
written_at: 2026-08-25T11:47:57.648Z
---

# Slang reflection: getElementVarLayout is null for non-ParameterGroup buffers; SSBO vs StructuredBuffer kinds differ

When walking Slang reflection layouts, `TypeLayoutReflection::getElementVarLayout()` returns non-null **only** for a `ParameterGroupTypeLayout` (source/slang/slang-reflection-api.cpp `spReflectionTypeLayout_GetElementVarLayout`, ~line 1615-1628). Any code that calls it and dereferences the result must null-check first.

Type hierarchy (source/slang/slang-ast-type.h): `ConstantBufferType`, `TextureBufferType`, `ParameterBlockType` all derive from `UniformParameterGroupType : ParameterGroupType` → their layout IS a `ParameterGroupTypeLayout` → getElementVarLayout() is non-null and getContainerVarLayout()/getElementTypeLayout() work as expected. But `GLSLShaderStorageBufferType : PointerLikeType` is a **sibling** of ParameterGroupType, NOT a subclass → getElementVarLayout() returns **null**. So `ConstantBuffer`/`ParameterBlock`/`TextureBuffer` are the only "single-element container" kinds you can safely enter via getElementVarLayout(); a `ShaderStorageBuffer` is pointer-like and has no content element in that sense.

**Reflection-kind trap for tests (cost me a review round):** an HLSL `RWStructuredBuffer<T>` / `StructuredBuffer<T>` reflects as `TypeReflection::Kind::Resource` (the RESOURCE_CASE macro in slang-reflection-api.cpp ~498), NOT `Kind::ShaderStorageBuffer`. Only the GLSL type `GLSLShaderStorageBuffer<T, Std430DataLayout>` (declarable in a .slang test; see tests/spirv/type-layout-memoization.slang) reflects as `Kind::ShaderStorageBuffer`. So to actually exercise SSBO-kind code paths in a unit test you must use `GLSLShaderStorageBuffer`, not a StructuredBuffer — a StructuredBuffer silently takes the Resource/default branch and won't reproduce an SSBO-specific bug.

Context: shader-slang/slang#12183 / PR #12715 (header-only slang::reflection::Cursor). navigateToContent() accepted Kind::ShaderStorageBuffer and unconditionally dereferenced the null element → crash on valid input.
