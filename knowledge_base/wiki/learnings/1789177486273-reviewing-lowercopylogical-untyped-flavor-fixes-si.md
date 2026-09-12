---
title: "Reviewing lowerCopyLogical untyped-flavor fixes: single-element copy only tests the struct-field branch"
type: learning
topic: review-process
source: learnings/1789177486273-reviewing-lowercopylogical-untyped-flavor-fixes-si.md
---

# Reviewing lowerCopyLogical untyped-flavor fixes: single-element copy only tests the struct-field branch

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789175919970-hqx6uc
written_at: 2026-09-12T01:44:46.273Z
---

# Reviewing lowerCopyLogical untyped-flavor fixes: single-element copy only tests the struct-field branch

When reviewing a `lowerCopyLogical` "preserve untyped SPIR-V pointer flavor on derived addresses" fix (e.g. shader-slang/slang#13027 / #13022, descriptor-heap `ConstantBuffer<T>` leaf-field reads emitting invalid `OpAccessChain` on an untyped base), watch the test-coverage shape:

- `SomeStruct s = cb.arr[i];` copies a **single array element** into a local. The `arr[i]` indexing lowers to a separate `getElementPtr` (retyped untyped by the pre-existing worklist pass), and the following `copyLogical` has a **struct** source type. So `lowerCopyLogicalWithDestImpl` only enters the **struct-field** branch (`emitFieldAddressKeepingFlavor`). The **array-element** branch (`emitElementAddressKeepingFlavor`, reached via `else if (auto srcArrayType = as<IRArrayType>(srcValType))`) is **never exercised** — including its ≤16-element unroll sub-path and the >16-element `emitLoopBlocks` sub-path (the latter becomes newly reachable on SPIR-V 1.4+ once the extra `lowerCopyLogical(module, onlyUntypedPtrOperand=true)` call is added).
- To drive the array branch you need a **wholesale array copy** from the descriptor-heap buffer, e.g. `struct WithArray { int vals[20]; }` then `int local[20] = cb.vals;` — and ideally two entries (≤16 elems → unroll path, >16 → loop path).
- Second robustness nit on such tests: a `CHECK-NOT: OpTypePointer Uniform %int` pinned to `%int` passes only because the buffer's leaves are all `int`. A `float`/`uint` leaf or an intermediate `OpTypePointer Uniform %Inner_std140` would slip past. Tighten to `CHECK-NOT: OpTypePointer Uniform` (no type suffix) to match the usual "no typed Uniform pointer anywhere" invariant — descriptor-heap buffers only use `OpTypeUntypedPointerKHR` for Uniform, so it still passes.

Also: the new `*KeepingFlavor` helpers are genuinely necessary (not redundant with `processFieldAddress`/`processGetElementPtrImpl`'s identical untyped-retype rule) *because of ordering* — `lowerCopyLogical` runs after both `processWorkList()` drains in `processModule()`, so the addresses it emits are never revisited by those retype passes. Correctness reviewer verified this; clarity reviewer's complementary ask is to *document* that ordering invariant at the call site (and note the rule now lives in >1 place). Not a contradiction — different bars.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789177486273-reviewing-lowercopylogical-untyped-flavor-fixes-si.md`_
