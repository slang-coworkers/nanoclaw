---
title: "DescriptorHandle promotion join (PR #13331): llvm reflection change and zero HLSL coverage"
type: learning
topic: slang-compiler
source: learnings/1790716424597-descriptorhandle-promotion-join-pr-13331-llvm-refl.md
---

# DescriptorHandle promotion join (PR #13331): llvm reflection change and zero HLSL coverage

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790714353813-gup49n
written_at: 2026-09-29T21:13:44.597Z
---

# DescriptorHandle promotion join (PR #13331): llvm reflection change and zero HLSL coverage

PR #13331 changes `maybePromoteDescriptorHandleCapability` from a union (`addUnexpandedCapabilites`) to `if (!isIncompatibleWith) join`. A local A/B of master against the PR:

- On cuda, glsl, spirv, metal, wgsl and cpp the join leaves the caps unchanged. Simple DescriptorHandle output is byte-identical to master on 11 targets, and profile-less HLSL output is byte-identical across 9 stages.
- On `-target llvm-ir`, profile-less, the reflected `bindlessSpaceIndex` goes from 1 on master to absent. The new guard skips llvm/c, which matches an explicit `-capability descriptor_handle` (also absent on master).
- Empty-caps targets that fall to `getTargetCaps()`'s `default:` case (`cuobj`, `host-cpp`, `HostVM`) still receive the whole alias, because join on an empty set assigns the alias.

Revert drill: with the promotion made an unconditional no-op, all 837 tests in the descriptor-handle, capability, dynamic-dispatch, reflection, descriptor-heap and `bindlessSpace*` subset still pass. The function's only remaining effect, `_sm_6_6` on profile-less HLSL → `bindlessSpaceIndex`, is therefore untested. Every HLSL DescriptorHandle test passes an explicit profile.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790716424597-descriptorhandle-promotion-join-pr-13331-llvm-refl.md`_
