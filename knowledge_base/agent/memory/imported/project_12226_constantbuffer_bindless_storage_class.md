---
name: project_12226_constantbuffer_bindless_storage_class
description: "#12226 ConstantBuffer<T> bindless fetched as StorageBuffer not Uniform SPIR-V (P1 regr of #11647) — TERMINAL: MERGED PR #12256 (6dba5d212) 2026-07-29 via new SPIRVUntypedPtr IR flavor; maintainer reversed his own by-design ruling after reporter's glslang rebuttal + our verified untyped-path evidence."
metadata: 
  node_type: memory
  type: project
  originSessionId: 45648c88-d49d-44c6-9068-0765f0598dd7
---

# slang#12226 — bindless `ConstantBuffer<T>` fetched with a StorageBuffer descriptor

## ✅ TERMINAL — MERGED & CLOSED 2026-07-29 02:33Z

PR **#12256** (nv-slang-bot, `Closes #12226`) merged by **jkwak-work** as **`6dba5d212`**; issue
CLOSED/COMPLETED. Triager re-verified at source and re-read the merged diff. 13 files; new test
`descriptor-heap-constant-buffer-descriptor-kind.slang` pins distinct descriptor kinds, plus a
16-bit-capability test and 5 updated `descriptor-heap-constant-buffer*` tests; 549/549 `tests/spirv`
with validation. 4 review rounds, IR-version bumped, approved, CI green.

**Only open item (non-blocking, in the PR body):** GPU runtime readback of #11483's nested-array case
on a real SPV_EXT_descriptor_heap + SPV_KHR_untyped_pointers driver — not closeable compiler-side;
the reporter offered to pull-test. A reporter *"doesn't resolve"* is fresh substantive input ⇒
re-open; otherwise closed.

## The bug

`ConstantBuffer<T>` fetched bindlessly (`ResourceDescriptorHeap[]` / `DescriptorHandle`,
`spvDescriptorHeapEXT`) emitted `OpTypeBufferEXT StorageBuffer` + a StorageBuffer buffer pointer. The
driver read a 16 B storage-buffer descriptor from a heap slot the app filled with an 8 B uniform-buffer
descriptor → garbage (real ABI break). Reporter aechelon-joshuamaros (external), Slang 2026.14.
Element-shape-dependent: scalar/vector/matrix CBs stayed typed-Uniform and validated; struct forms flipped.

**Root cause — conflating descriptor kind (ABI) with pointer addressing class.** PR #11647 added
`processConstantBufferDescriptorHeapLoad` (`slang-ir-spirv-legalize.cpp:1300`) to fix #11483's
nested-array garbage: Slang's buffer-data pointer from `OpBufferPointerEXT` is a **typed** `IRPtrType`,
addressed with typed `OpAccessChain`, which needs a pointer-type `ArrayStride` that only StorageBuffer
carries. The gate (`as<IRStructType>` at :1315) was also over-broad — every struct, even with no array.
glslang instead keeps the data pointer **untyped-Uniform** and addresses fields with
`OpUntypedAccessChainKHR` (stride from type decorations), which spirv-val accepts. Slang's emitter had
only 3 `OpUntypedAccessChainKHR` sites, all heap/texel indexing — that was the architectural gap.

## The merged fix

New IR pointer flavor `SPIRVUntypedPtr` / `SPIRVUntypedPtrType` (under `PtrTypeBase`, same operands as
`PtrType`) that **retains the logical pointee + layout in IR** while emitting an untyped SPIR-V pointer:
heap entry `OpTypeBufferEXT Uniform`, pointer `OpTypeUntypedPointerKHR Uniform`, every field/element
address via `OpUntypedAccessChainKHR` with the logical pointee as Base Type. Created only for heap-load
results (bound CBs stay typed-Uniform) after `wrapRemainingConstantBufferElementTypes()`, giving one
canonical lowering and removing the shape-dependent struct gate; propagated in `processGetElementPtrImpl`
/ `processFieldAddress`; emitted via the existing `ensureUntypedPointerType`. Deliberately **not**
extended to `GetOffsetPtr` (Vulkan storage-class restrictions on ptr-access-chains).

## How the chain moved (the durable process lesson)

1. **07-25 triage** — reproduced, P1, regression of #11647; a naive revert regresses #11483. Spec gate:
   the two SPV_EXT_descriptor_heap storage-class operands are **independent** (no matching VUID) —
   refuted DeepWiki's "must match"; verdict comment `5075822113` PATCHed in place.
2. **07-25 maintainer ruling "intentional"** (`5097327434`): Uniform can't point at an array element;
   workaround `-spirv-unified-descriptor-heap-stride`.
3. **07-27 reporter rebuttal** (`5106816405`) with glslang SPIR-V showing the untyped-Uniform path.
4. **07-28 fixer investigation (no code)** confirmed the mechanism: the constraint holds only for
   Slang's typed path; the flag fixes stride, **not** descriptor kind; the fix is a ~5-8-consumer emitter
   extension. Triager re-verified both load-bearing claims and surfaced options to jkwak + szihs (`5107034100`).
5. **07-28 reversal** — jkwak prototyped the untyped approach, posted a self-contained handoff
   (`5107406259`), then explicitly asked the bot for a PR (`5107785292`, post-authorized). Later:
   *"It turned out that I got it wrong on a previous issue #11483"* (`5110461315`).

⭐ Verified counter-evidence surfaced *back to the ruling maintainer as their call* (not argued, no code
on a contested design) is what reversed a by-design ruling. Guardrails that held: draft-only bot PR,
maintainer owned the merge, no double-dispatch to an already-implementing fixer, and a webhook that
outran the fixer's `[Fix Report]` was relayed without re-dispatch. A draft-PR priority-yield red run is
benign ([[project_bot_pr_priority_yield_red_run]]); relay a maintainer verdict only once it is in hand
([[feedback_never_relay_a_verdict_not_in_hand]]).

Related bindless SPIR-V codegen, distinct symptoms (not dups):
[[project_12185_bindless_texture_nv_desc_handle_nonimage]],
[[project_12161_nonuniform_descriptorhandle_nonspirv_verify]].
