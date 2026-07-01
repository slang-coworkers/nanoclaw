---
title: "Slang store-family: which surface syntax hits AtomicStore/MatrixSwizzleStore + peephole-vs-checker gate"
type: learning
topic: slang-compiler
source: learnings/1782442658975-slang-store-family-which-surface-syntax-hits-atomi.md
---

# Slang store-family: which surface syntax hits AtomicStore/MatrixSwizzleStore + peephole-vs-checker gate

When writing tests or reasoning about the store family (`kIROp_Store`, `AtomicStore`, `SwizzledStore`, `MatrixSwizzleStore`) — e.g. for the uninitialized-use checker (`getInstructionUsageType` in slang-ir-use-uninitialized-values.cpp), verify the LOWERED op, not the surface syntax:

- **`kIROp_AtomicStore` is reached ONLY by a direct assignment to an `Atomic<T>` lvalue** — e.g. `RWStructuredBuffer<Atomic<uint>> buf; buf[0] = uninit;`. The `assign()` Ptr-store path branches `if (as<IRAtomicType>(tryGetPointedToType(...))) emitAtomicStore(...)` at slang-lower-to-ir.cpp:9992-9997.
- **`InterlockedExchange` does NOT lower to `AtomicStore`** — it lowers to `AtomicExchange` (a distinct op). Using it as an "AtomicStore test" is mislabeled and exercises a different code path. (A passing diagnostic alone won't prove the arm; confirm with `-dump-ir`.)
- **`kIROp_MatrixSwizzleStore`** comes from a matrix swizzle assignment: `m._m00_m11 = uninit;` → `matrixSwizzleStore(%m, %value, idx...)`. Operand 1 is the value/source; the swizzle indices follow.

Store-family operand layout (for read/write role splits): operand 0 = destination (write), operand 1 = value/source (read), for all four ops. They do NOT share a typed value accessor (IRStore/IRAtomicStore have `getVal()`; IRSwizzledStore exposes element accessors; IRMatrixSwizzleStore differs) — so `getOperand(1)` is the correct unifying access when handling them in one switch arm.

Peephole interaction: the store-of-undef peephole (slang-ir-peephole.cpp `kIROp_Store` case) elides ONLY plain `kIROp_Store` of an `IRUndefined` value — it does NOT touch AtomicStore/SwizzledStore/MatrixSwizzleStore. So for those three, no elision happens and the surviving store reaches the late validation checker directly; the classifier arm is the sole gate. Only plain `Store` needed the peephole carve-out (skip elision when the value is exactly `kIROp_LoadFromUninitializedMemory`, keying on that op — NOT the whole IRUndefined family — so plain poison/Undefined stores stay elided).

DIAGNOSTIC_TEST caret gotcha: the warning caret points at the store operator (`=`) for scalar/buffer/param/swizzle/atomic cases, but at the `uninit` token (full-width `^^^^^^` span) for the matrix-swizzle case — match the framework's exhaustive auto-output rather than hand-computing the column.

Context: slang#11763 / PR #11764 (warn on direct copy of uninitialized value).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782442658975-slang-store-family-which-surface-syntax-hits-atomi.md`_
