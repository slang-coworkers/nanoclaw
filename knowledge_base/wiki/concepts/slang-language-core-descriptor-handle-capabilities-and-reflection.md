---
title: "Slang descriptor-handle capability promotion and reflection-visible changes (bindlessSpaceIndex, CUDA binding categories)"
type: concept
group: slang-language-core
tags: [slang, descriptor-handle, capabilities, reflection, bindless, llvm, cuda, slang-rhi, breaking-change, revert-drill, global-params]
source_count: 3
---

# Slang descriptor-handle capability promotion and reflection-visible changes

Some compiler changes are visible mainly through reflection or through a host runtime that consumes reflection, rather than through emitted shader code. This page collects two such cases: the `descriptor_handle` capability promotion that drives reflected `bindlessSpaceIndex` (PR #13331), and CUDA reflection categories that slang-rhi's host-side binder trusts without checking (PR #12646). Descriptor and layout lowering in general is on [[wiki/concepts/slang-compiler-descriptor-and-layout-lowering.md]].

## TL;DR

- **PR #13331 changes `maybePromoteDescriptorHandleCapability` from a union to a guarded join.** On cuda, glsl, spirv, metal, wgsl and cpp the join leaves caps unchanged. On profile-less `-target llvm-ir` the reflected `bindlessSpaceIndex` goes from 1 to absent, and empty-caps targets that fall to `getTargetCaps()`'s `default:` case (`cuobj`, `host-cpp`, `HostVM`) still receive the whole alias.
- **The promotion's only remaining effect has no test.** A no-op revert passes all 837 descriptor-handle/capability/reflection tests, because every HLSL DescriptorHandle test passes an explicit profile, so `_sm_6_6` on profile-less HLSL → `bindlessSpaceIndex` is unexercised.
- **The incompatible-target guard is invisible to reflection and observable only through `-target llvm-shader-ir` codegen.** Without it, slangc exits 0 but emits `unreachable` kernel bodies: a silent miscompile.
- **Run a delete-the-guard revert drill before accepting "this test covers the guard."**
- **The old union also leaked foreign-target `__target_intrinsic`s** into profile-less HLSL, WGSL and cpp, not only CUDA, GLSL and Metal.
- **slang-rhi's CUDA binder treats every binding range's `IndexOffset` as a uniform byte offset without checking its category.** A Slang change that moves a CUDA global out of `Uniform` (e.g. to `ShaderRecord`) makes slang-rhi write sub-object pointers at that *index* into GlobalParams, with no error. When a Slang PR changes CUDA reflection categories, grep slang-rhi `src/cuda/` for `IndexOffset`/`uniformOffset`, flag the host impact, and label `pr: breaking change`.
- **IR passes that rewrite global-param uses must key on `IRGlobalValueWithCode`, not `IRFunc`/`getParentFunc`**, because a `static` global initialized from a global param puts the use in an `IRGlobalVar` initializer block. Use `buildEntryPointReferenceGraph` for entry-point reachability through helpers and static initializers.

## PR #13331: union → guarded join in `maybePromoteDescriptorHandleCapability`

PR #13331 changes `maybePromoteDescriptorHandleCapability` from a union (`addUnexpandedCapabilites`) to `if (!isIncompatibleWith) join`. A local A/B of master against the PR found the join leaves the caps unchanged on cuda, glsl, spirv, metal, wgsl and cpp; simple DescriptorHandle output is byte-identical to master on 11 targets, and profile-less HLSL output is byte-identical across 9 stages. On profile-less `-target llvm-ir`, the reflected `bindlessSpaceIndex` goes from 1 on master to absent; the new guard skips llvm/c, which matches an explicit `-capability descriptor_handle` (also absent on master). Empty-caps targets that fall to `getTargetCaps()`'s `default:` case (`cuobj`, `host-cpp`, `HostVM`) still receive the whole alias, because a join on an empty set assigns the alias. The revert drill is the striking result: with the promotion made an unconditional no-op, all 837 tests in the descriptor-handle, capability, dynamic-dispatch, reflection, descriptor-heap and `bindlessSpace*` subset still pass. The function's only remaining effect, `_sm_6_6` on profile-less HLSL → `bindlessSpaceIndex`, is therefore untested, because every HLSL DescriptorHandle test passes an explicit profile [DescriptorHandle promotion join (PR #13331): llvm reflection change and zero HLSL coverage](../learnings/1790716424597-descriptorhandle-promotion-join-pr-13331-llvm-refl.md).

## The incompatible-target guard: invisible to reflection, visible in llvm-shader-ir codegen

The new `if (targetCaps.isIncompatibleWith(descriptor_handle)) return;` guard keeps `Invalid` caps off llvm/c targets. A `-target llvm-ir -no-codegen` REFLECTION test does NOT detect it: with or without the guard `bindlessSpaceIndex` is absent, because `atLeastOneSetImpliedInOther` on `Invalid` caps returns not-implied (the 1 → absent change above comes from the join itself, not the guard). A test that does detect it is `-target llvm-shader-ir` on a plain kernel in a module that declares an unused `DescriptorHandle` global. With the guard the output is valid IR, byte-identical to master; without it slangc exits 0 but the kernel and `_Group` functions are just `unreachable`, a silent miscompile. The method is a delete-the-guard revert drill before accepting "this test covers the guard". Related: on master the union also leaked foreign-target `__target_intrinsic`s into profile-less HLSL, WGSL and cpp, not only CUDA, GLSL and Metal; `__target_intrinsic(metal, "METAL_ONLY($0)")` on a user function shows it [descriptor_handle promotion guard: observable only via llvm-shader-ir codegen, not reflection](../learnings/1790719895023-descriptor-handle-promotion-guard-observable-only-.md).

## CUDA reflection categories are a host-side contract with slang-rhi (#12628 / PR #12646)

slang-rhi's CUDA shader-object layout (`src/cuda/cuda-shader-object-layout.cpp`, ~line 38) takes `getDescriptorSetDescriptorRangeIndexOffset(set, firstRange)` of every binding range as a **uniform byte offset**, and `cuda-shader-object.cpp` memcpy's `ConstantBuffer`/`ParameterBlock` sub-object pointers there. It never checks the descriptor range's category. So if a Slang compiler change moves a CUDA global from `Uniform` to another category (e.g. `ShaderRecord`, index 0), slang-rhi writes 8 bytes at that *index* into GlobalParams, clobbering the first global or overflowing a small struct, with no error. This was found on shader-slang/slang#12628 / PR #12646 (CUDA shader-record globals). When a Slang PR changes CUDA reflection categories, grep slang-rhi `src/cuda/` for `IndexOffset` / `uniformOffset`, flag the host-side impact, and label the PR `pr: breaking change` [changing a Slang reflection category can break slang-rhi's CUDA binder silently](../learnings/1790825172462-changing-a-slang-reflection-category-can-break-sla.md).

Two IR-pass lessons came from the same PR. A `static` global initialized from a global param puts the use in an `IRGlobalVar` initializer block, so an IR pass that rewrites global-param uses per function must key on `IRGlobalValueWithCode`, not `IRFunc`/`getParentFunc`, or it hits null. And `buildEntryPointReferenceGraph` (slang-ir-call-graph.h) already gives entry-point reachability for a global param through helpers and static initializers, so stage-validity diagnostics in IR passes should use it [same](../learnings/1790825172462-changing-a-slang-reflection-category-can-break-sla.md).

**Source learnings (3):**
- [DescriptorHandle promotion union→join (PR #13331): caps unchanged on 6 targets, llvm reflection bindlessSpaceIndex 1→absent, no-op revert passes 837 tests (HLSL effect untested)](../learnings/1790716424597-descriptorhandle-promotion-join-pr-13331-llvm-refl.md)
- [descriptor_handle incompatible-target guard: invisible to llvm-ir reflection, caught only by llvm-shader-ir codegen (silent `unreachable` miscompile); union leaked foreign __target_intrinsics](../learnings/1790719895023-descriptor-handle-promotion-guard-observable-only-.md)
- [changing a CUDA reflection category silently breaks slang-rhi's CUDA binder (IndexOffset used as uniform byte offset); IRGlobalValueWithCode keying; buildEntryPointReferenceGraph](../learnings/1790825172462-changing-a-slang-reflection-category-can-break-sla.md)

_Catalog: [[wiki/index.md]]_
