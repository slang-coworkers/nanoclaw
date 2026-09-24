---
name: project_12185_bindless_texture_nv_desc_handle_nonimage
description: "#12185 spvBindlessTextureNV aborted converting a non-image/sampler DescriptorHandle to SPIR-V. Shipped fix = pdeayton's ~10-line isInlinableGlobalInst inlining (representation SURVIVAL), not emit-side handling. Kind-gating expressibility stays OPEN."
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f619349-0ea3-4cf3-977d-4a8b6c4b3e69
---

# #12185 — spvBindlessTextureNV InternalError for a non-texture/sampler DescriptorHandle

**Repo:** shader-slang/slang · **Author:** pdeayton-nv (MEMBER), opened 2026-07-22 · **PR #12186**
(`Closes #12185`, branch `fix/issue-12185`, `pr: non-breaking`) · **Canonical thread:**
`gh-issue-shader-slang/slang-12185`. Last recorded state: **APPROVED by pdeayton-nv (review
`4849248355`, binding to head `65338dbef9`), non-draft, held on a maintainer merge** — approval-locked,
so any push/rebase/ready-flip would dismiss it. On merge, **#12192 unparks** and **#12191 is moot**.

## The bug
With `-capability spvBindlessTextureNV`, converting `DescriptorHandle<T>` → SPIR-V aborted
(`E99997 InternalError: Unsupported result type for CastDescriptorHandleToResource`, exit 255) for
ConstantBuffer / StructuredBuffer / RWStructuredBuffer / ByteAddressBuffer **and**
RaytracingAccelerationStructure (the reporter expected AS to work — it also aborted). Image/sampler
kinds compiled fine; the same cases compiled without the capability.

## Root cause (triager-verified @d148787f2)
Producer/consumer breadth mismatch. The producer `hlsl.meta.slang` (`case spvBindlessTextureNV:`)
forwarded **every** descriptor kind through `__castDescriptorHandleToResource<T>`, while the consumer
`slang-emit-spirv.cpp` handled only Texture / SamplerState → `SLANG_UNEXPECTED`. `SPV_NV_bindless_texture`
encodes uint→image/sampler only; buffers have no encoding; AS has `OpConvertUToAccelerationStructureKHR`.

## The fix that shipped — representation SURVIVAL, not emit handling
⭐ **pdeayton's own ~10-line proposal beat all four fixer guard variants AND the producer-side gating the
triager had assessed as the root fix.** The real constraint was that the global initializer chain never
inlined. The shape that shipped is three things, nothing else:
- **kind-dependent handle width** (uint64 for the texture/sampler family, uint2 for buffers + AS);
- the `sizeof`/`alignof` layout-rule fix;
- ~10 lines added to `isInlinableGlobalInst` — five case labels at
  `slang-ir-legalize-global-values.cpp:119-123` (`CastUInt2ToDescriptorHandle`,
  `CastUInt64ToDescriptorHandle`, `CastDescriptorHandleToUInt2`, `CastDescriptorHandleToUInt64`,
  `kIROp_Select`) beside the pre-existing `kIROp_BitCast`.

No diagnostic, no descope, no `.meta.slang` change; ~86 lines of cross-width machinery were deleted
(proven dead, 0/10 reach). Regression test `desc-handle-nv-bindless-global-width.slang`, 17/17
exit-code-clean under spirv-val. ⚠️ The mechanism is **not** "a surviving runtime `OpBitcast`": once the
initializer chain inlines, ordinary constant folding resolves the width outright (`OpConstant %ulong` →
`OpIAdd %ulong`), so **no bitcast is emitted for the constant case** — verifying against a surviving
bitcast would be wrong.

## Two layers — do NOT conflate
- **Representation SURVIVAL** = what shipped (the `isInlinableGlobalInst` additions).
- **EXPRESSIBILITY** = whether a cross-width `DescriptorHandle` round-trip should be legal-and-bitcast or
  type-system-rejected. Width conversions are capability-gated but **NOT kind-gated** in either direction
  (`hlsl.meta.slang:27474-83` write / `:27529-44` read-back, triager-verified at master), so cross-width
  use is expressible and now compiles **silently DEFINED, not diagnosed**. That satisfies #12185's text
  but is **NOT** a type-level guarantee inferable from the closed issue. It stays **OPEN** as a semantic
  call for pdeayton/csyonghe; the fixer stated the distinction rather than claiming the fix settles it,
  and disclosed it in the public verdict.

## Superseded fix shapes → [[project_12185_superseded_fix_shapes_history]]
Six shape changes preceded the shipped fix: an E55215-in-legalization arc (reached APPROVED @`4fbe216b0e`,
then csyonghe re-opened the design ⇒ #12191/#12192 moot), the E39033 arc (four guard variants, all
dropped), option-(a)'s first push (`f4004c3f90`), and pdeayton's two investigation Qs (Q1 → issue #12219;
Q2's first answer was wrong, corrected into a real layout fix `107f158ffe`). Detail lives in the child —
**read it before re-proposing anything in this space.**

## Durable lessons
- **Test adequacy (pdeayton):** a single `-O1` lane is **inert** — at `-O1` both bitcasts have already
  folded, so it verifies the end state and can never show the global initializer was legally sunk.
  Require all three lanes (`-O0` spirv-asm with SSA ids bound · `-O0` binary via `-o` · `-O1` folded
  `OpConstant`), confirm `kIROp_Select` is genuinely exercised, and bound `CHECK-NOT` between positives
  spanning `OpLabel`…`OpFunctionEnd`. ⇒ [[feedback_optimized_lane_can_be_inert_for_the_fix]]
- ⛔ **Retired check: do NOT "verify `gh-9916.slang` unmodified" — it FALSE-ALARMS** (branch-wide it is
  legitimately +5/−1 from the option-a commit).
- Always state which basis a diffstat is on: per-commit vs branch-vs-master differ here.
- Lessons born here: [[feedback_descope_recheck_original_acceptance_bar]] ·
  [[feedback_fix_can_invert_into_overrejection]] · [[feedback_stale_replayed_inbound_can_regress_state]] ·
  [[feedback_published_negative_env_claims_need_rederivation]].

## Spin-offs
**#12219** (SCCP const-fold, separate chain) · **#12191 / #12192** (both moot — about the removed E55215) ·
a heap-path spirv-opt crash (`const_folding_rules.cpp:129`). Related, not dup:
[[project_12161_nonuniform_descriptorhandle_nonspirv_verify]], #12116, #12051.
