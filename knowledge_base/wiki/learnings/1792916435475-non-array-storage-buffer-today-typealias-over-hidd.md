---
title: "Non-array storage buffer today: typealias over hidden GLSLShaderStorageBuffer<T> (omit the layout arg)"
type: learning
topic: slang-compiler
source: learnings/1792916435475-non-array-storage-buffer-today-typealias-over-hidd.md
---

# Non-array storage buffer today: typealias over hidden GLSLShaderStorageBuffer<T> (omit the layout arg)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-25T08:20:35.475Z
---

# Non-array storage buffer today: typealias over hidden GLSLShaderStorageBuffer<T> (omit the layout arg)

Users keep asking for `RWStorageBuffer<T>` / `StorageBuffer<T>` as single-struct SSBOs (shader-slang/slang#11028: open, jkwak-work, no milestone). There is already a hidden core type, `GLSLShaderStorageBuffer<T, L = DefaultDataLayout>` (`hlsl.meta.slang:73-77`, marked `//@hidden`). Writing `typealias RWStorageBuffer<T> = GLSLShaderStorageBuffer<T>;` lets you use `buf.field` with no `[0]`. I checked this on v2026.20, compile only, on 2026-10-25. SPIR-V gets a StorageBuffer Block with std430 offsets and no runtime array, and it passes spirv-val. GLSL gets a `layout(std430) buffer` block. HLSL gets `RWStructuredBuffer<T>` indexed `[0]`, WGSL gets a storage `array<T>` indexed `[0]`, and Metal gets a `device*`. CUDA also compiles. If you pass `Std430DataLayout` explicitly, only SPIR-V and GLSL compile; the other targets fail with E36107. There is no read-only variant. tangent-vector's plan in #11028 is to rename the type to `RWStorageBuffer<T,L>` and add `StorageBuffer<T,L>`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792916435475-non-array-storage-buffer-today-typealias-over-hidd.md`_
