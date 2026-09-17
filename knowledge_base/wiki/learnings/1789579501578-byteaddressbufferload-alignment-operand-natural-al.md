---
title: "ByteAddressBufferLoad alignment operand: natural-alignment overload is function-local until peephole"
type: learning
topic: misc
source: learnings/1789579501578-byteaddressbufferload-alignment-operand-natural-al.md
---

# ByteAddressBufferLoad alignment operand: natural-alignment overload is function-local until peephole

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789577808585-kxm6iy
written_at: 2026-09-16T17:25:01.578Z
---

# ByteAddressBufferLoad alignment operand: natural-alignment overload is function-local until peephole

When buffer-load-arg specialization (`specializeFuncsForBufferLoadArgs`, `getSpecializedValueForArg`/`getCallInfoForArg` in `slang-ir-specialize-function-call.cpp`) rebuilds a `kIROp_ByteAddressBufferLoad` element-access and preserves its trailing operands `[2, count)`, a `SLANG_RELEASE_ASSERT(!getParentFunc(trailingOperand))` (asserting the alignment operand is module-scope) is **only** safe for plain `Load` (alignment literal 0) and explicit `LoadAligned<T>(loc, N)` (literal N).

It is NOT safe for the single-arg natural-alignment overload `T LoadAligned<T>(uint location)` (`hlsl.meta.slang:490-492`): its alignment lowers to `__naturalAlignmentOf<T>()` → `kIROp_GetNaturalAlignment`, a **function-local, non-hoistable** inst (`slang-ir-insts.lua:1377`) that becomes a module-scope literal only after peephole folds it. Peephole skips it while inside a generic (`slang-ir-peephole.cpp:1841` `if (isInGeneric) break;`), and at `-O0` no `simplifyIR`/peephole runs between generic specialization and this pass (`slang-emit.cpp:2087-2089` runs DCE only; the pass is at :2121). So a generic-wrapped `LoadAligned<S>(loc).get()` can reach the rebuild with a function-local trailing operand and abort a previously-compilable shader.

Reviewer takeaway: any pass that preserves/keys on a BAB-load's alignment operand must handle the non-literal `GetNaturalAlignment` form (hoist/re-materialize or fall back to ordinary arg-passing) rather than assuming a module-scope `IRIntLit`. Related to the prior "alignment ≠ stride; single-arg LoadAligned<T> forwards __naturalStrideOf/__naturalAlignmentOf" learning. Surfaced verifying shader-slang/slang PR #13130 (fix for #13126).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789579501578-byteaddressbufferload-alignment-operand-natural-al.md`_
