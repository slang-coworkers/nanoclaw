---
name: project_12185_bindless_texture_nv_desc_handle_nonimage
description: "#12185 spvBindlessTextureNV aborts on non-image/sampler DescriptorHandle — triaged P2, fixer handoff"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f619349-0ea3-4cf3-977d-4a8b6c4b3e69
---

# #12185 — spvBindlessTextureNV InternalError for non-texture/sampler DescriptorHandle

**Repo:** shader-slang/slang · **Author:** pdeayton-nv (MEMBER) · opened 2026-07-22
**Canonical thread:** `gh-issue-shader-slang/slang-12185`

With `-capability spvBindlessTextureNV`, converting `DescriptorHandle<T>` → SPIR-V aborts
(`E99997 InternalError: Unsupported result type for CastDescriptorHandleToResource`, exit 255)
for ConstantBuffer / StructuredBuffer / RWStructuredBuffer / ByteAddressBuffer **and**
RaytracingAccelerationStructure. Image/sampler kinds compile fine. Same cases compile without
the capability.

## Root cause (triager-verified at source @d148787f2)
Producer/consumer breadth mismatch:
- **Producer** `hlsl.meta.slang:27784-27785` — the `case spvBindlessTextureNV:` arm forwards
  *every* descriptor kind through `__castDescriptorHandleToResource<T>` **unconditionally**
  (sibling arms all `switch(T.kind)`).
- **Consumer** `slang-emit-spirv.cpp:5121-5147` — only handles `TextureType`/`SamplerStateType`;
  `default → SLANG_UNEXPECTED` at 5145.
- `SPV_NV_bindless_texture` defines uint→image/sampler only; buffers have no encoding (→ should
  be a graceful diagnostic); AS has `OpConvertUToAccelerationStructureKHR` (already used at
  slang-emit-spirv ~7490-7497 but not wired into this path).

## Correction to reporter analysis
Reporter said AS *should* work; in fact R3/AS **also aborts** currently.

## Recommended fix (triage memo)
**Approach A** — producer-side kind-dispatch in the meta.slang arm — folded with **B**'s
diagnostic hardening (turn the abort into a graceful diagnostic for unsupported kinds).
Open design Q: wire AS to real lowering now vs diagnose-and-defer.

## Chain state (as of 2026-07-22)
- Classified bug / medium / **P2** / SPIR-V emit. Issue Type set `Bug`; `reproduced` applied.
- Verified 5-bullet verdict posted: issue comment 5041198434.
- Triage memo `triage-12185.md` delivered to slang-fixer on canonical thread.
- **slang-triager holds at Step 10** awaiting slang-fixer [Fix Report], then forwards upstream.
- Related (not dup): [[project_12161_nonuniform_descriptorhandle_nonspirv_verify]], #12116, #12051.
