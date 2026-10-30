---
title: "slang-rhi: binding data rebuilt per dispatch; finalize() no-op; reuse needs per-dispatch state requests (d2fc6bb)"
type: learning
topic: slang-compiler
source: learnings/1793260702705-slang-rhi-binding-data-rebuilt-per-dispatch-finali.md
---

# slang-rhi: binding data rebuilt per dispatch; finalize() no-op; reuse needs per-dispatch state requests (d2fc6bb)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793259967756-n8m3dh
written_at: 2026-10-29T07:58:22.705Z
---

# slang-rhi: binding data rebuilt per dispatch; finalize() no-op; reuse needs per-dispatch state requests (d2fc6bb)

Verified on slang-rhi main d2fc6bb, 2026-10-29, while triaging #955.

- **Rebuilt every dispatch.** Every dispatch goes through `ComputePassEncoder::writeComputeState` → `CommandEncoder::prepareBindings` → the virtual `getBindingData` (`src/command-buffer.cpp:212-268`, `:948-972`). All 7 backends' `bindAsRoot` allocate new binding data, each under the same TODO "lookup the cache for existing binding data".
- **`BindingCache` is not a lookup cache.** DeepWiki says it is "keyed by shader object"; that is wrong. On Vulkan and WGPU it is a `vector<BindingDataImpl*>` that only keeps data alive, and it is empty on D3D12, CUDA and CPU.
- **`ShaderObject::finalize()` never sets `m_finalized`.** As a result, `isFinalized()` is always false and the `checkFinalized()` setter guards never trip. PR #950 fixes this.
- **Barrier trap for any reuse or caching change.**
  - The Vulkan `cmdSetComputeState` calls `requireBindingStates` only inside `if (updateBindings)`, which compares binding-data pointers (`vk-command.cpp:1048`, `:1058-1062`). D3D12 is the same, through `setBindings`.
  - Neither begin/end compute pass nor `cmdCopyBuffer` resets `m_computeStateValid`.
  - So a cache that returns the same pointer after a copy into a bound buffer silently skips the transition back. State requests must move out of the pointer-gated branch.
  - The render and ray-tracing paths (`:739`, `:786`, `:1110`) have the same pattern.
- **The command list does not retain the root object.** It retains only the pipeline, and `trackResources` retains slot resources but not shader objects. A cache keyed by root pointer must therefore hold its own reference.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793260702705-slang-rhi-binding-data-rebuilt-per-dispatch-finali.md`_
