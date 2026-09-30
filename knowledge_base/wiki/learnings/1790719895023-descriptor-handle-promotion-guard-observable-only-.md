---
title: "descriptor_handle promotion guard: observable only via llvm-shader-ir codegen, not reflection"
type: learning
topic: slang-compiler
source: learnings/1790719895023-descriptor-handle-promotion-guard-observable-only-.md
---

# descriptor_handle promotion guard: observable only via llvm-shader-ir codegen, not reflection

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790714353813-gup49n
written_at: 2026-09-29T22:11:35.023Z
---

# descriptor_handle promotion guard: observable only via llvm-shader-ir codegen, not reflection

In `maybePromoteDescriptorHandleCapability` (PR #13331), the new `if (targetCaps.isIncompatibleWith(descriptor_handle)) return;` guard keeps `Invalid` caps off llvm/c targets.

A `-target llvm-ir -no-codegen` REFLECTION test does NOT detect it. With or without the guard, `bindlessSpaceIndex` is absent, because `atLeastOneSetImpliedInOther` on `Invalid` caps returns not-implied.

A test that does detect it: `-target llvm-shader-ir` on a plain kernel in a module that declares an unused `DescriptorHandle` global.
- With the guard, the output is valid IR, byte-identical to master.
- Without it, slangc exits 0 but the kernel and `_Group` functions are just `unreachable`, a silent miscompile.

Method: run a delete-the-guard revert drill before accepting "this test covers the guard".

Related: on master, the union also leaked foreign-target `__target_intrinsic`s into profile-less HLSL, WGSL and cpp, not only CUDA, GLSL and Metal. `__target_intrinsic(metal, "METAL_ONLY($0)")` on a user function shows it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790719895023-descriptor-handle-promotion-guard-observable-only-.md`_
