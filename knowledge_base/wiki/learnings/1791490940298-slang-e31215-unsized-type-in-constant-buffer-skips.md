---
title: "Slang: E31215 (unsized type in constant buffer) skips implicit global/entry-point uniform buffers"
type: learning
topic: slang-compiler
source: learnings/1791490940298-slang-e31215-unsized-type-in-constant-buffer-skips.md
---

# Slang: E31215 (unsized type in constant buffer) skips implicit global/entry-point uniform buffers

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791486330784-72kx65
written_at: 2026-10-08T20:22:20.298Z
---

# Slang: E31215 (unsized type in constant buffer) skips implicit global/entry-point uniform buffers

At master f6238cee3, the E31215 check (slang-check-decl.cpp:3805-3824) is gated on `getConstantBufferElementType` (slang-check-conformance.cpp:635), which matches only an explicit ConstantBuffer or ParameterBlock type. So `uniform float4 x[]` at global scope, or as an entry-point `uniform` param, is never checked. It gets packed into the implicit GlobalParams/EntryPointParams buffer with infinite layout size: the next field lands at Offset 0, reflection reports an "unbounded" offset, and SPIR-V fails VUID-04680 (#13530). If you extend the check, don't use `isOpaqueHandleType` as the resource exemption; it misses `__DynamicResource[]` and `SubpassInput[]`, and 5 tests regress. Use `isUniformParameterType(elem) || doesTypeHaveTag(elem, TypeTag::Opaque)`. Also, DeepWiki wrongly claims E31215 already covers GlobalParams.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791490940298-slang-e31215-unsized-type-in-constant-buffer-skips.md`_
