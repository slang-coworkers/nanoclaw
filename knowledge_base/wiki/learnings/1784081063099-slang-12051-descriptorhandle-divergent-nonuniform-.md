---
title: "slang#12051 DescriptorHandle divergent NonUniform marker stripped before SPIR-V legalize"
type: learning
topic: slang-compiler
source: learnings/1784081063099-slang-12051-descriptorhandle-divergent-nonuniform-.md
---

# slang#12051 DescriptorHandle divergent NonUniform marker stripped before SPIR-V legalize

On the `DescriptorHandle<T>` → `__getDynamicResourceHeap<T>(...)[index]` SPIR-V lowering path (the DEFAULT spirv path, no `spvDescriptorHeapEXT`), the `NonUniformResourceIndex` marker is **completely gone before SPIR-V legalization begins**. Verified at HEAD a8874f6a1e via `slangc -target spirv -dump-ir`: for `Texture2D tex = ResourceDescriptorHeap[NonUniformResourceIndex(tid.x)]` the generic-final dump shows **0 `NonUniformResourceIndex` insts and 0 `SPIRVNonUniformResource` decorations**; the resource-heap `getElement(%__slang_resource_heap, %idx)` index carries no decoration. It is specialized away in `slang-ir-specialize-function-call.cpp` when the handle machinery is inlined/specialized.

Consequences:
- Any guard in `slang-ir-spirv-legalize.cpp` (e.g. `processGlobalParam` / `insertLoadAtLatestLocation`, or the `else if (arrayType)` branch's `isNonUniform` at ~:690) that tries to read `kIROp_NonUniformResourceIndex` or `IRSPIRVNonUniformResourceDecoration` on the heap getElement index **will NOT fire on the DescriptorHandle path** — uniform and divergent produce byte-identical IR at that site.
- The float pass + `propagateNonUniformDecorations` (final step of processModule) can't help either: there's no marker left to propagate.
- This is why `tests/language-feature/descriptor-handle/desc-heap-nonuniform.slang:8-12` documents "a SPIR-V NonUniform decoration on descriptor-heap access is orthogonal... emits no NonUniform decoration either (verified with and without spvDescriptorHeapEXT)". The tree ACCEPTS this; the output is valid SPIR-V (SLANG_RUN_SPIRV_VALIDATION=1 → VAL_EXIT=0).
- The NonUniform decoration DOES survive for a **plain resource array** `Texture2D texArray[16]; texArray[NonUniformResourceIndex(i)]` (18 decorations) — only the DescriptorHandle/heap path loses it. Different codegen (plain array = no `OpLoad %n %n` heap-load pattern).

Practical impact for #12051 (coalesce uniform descriptor loads): a load-coalescing optimization on the heap path cannot distinguish uniform from divergent at legalize time, so it collapses both. This is semantically fine per-lane (single hoisted conversion → one getElement with the per-lane index → one load per lane, reused across uses), and matches the already-shipping EXT path's behavior. The only thing "missing" is the wave-divergence hint decoration, which was already absent. Fixing NonUniform-preservation on the DescriptorHandle path is a SEPARATE, larger change (maintainer-owned handle lowering) — a follow-up, not part of the perf PR.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784081063099-slang-12051-descriptorhandle-divergent-nonuniform-.md`_
