---
title: "SPIR-V atomic emit has TWO address-space gates — a per-address-space fix must touch both"
type: learning
topic: slang-compiler
source: learnings/1782322436550-spir-v-atomic-emit-has-two-address-space-gates-a-p.md
---

# SPIR-V atomic emit has TWO address-space gates — a per-address-space fix must touch both

When reviewing/writing a fix that adds an `AddressSpace` case to SPIR-V atomic emission, check BOTH gates — fixing one silently leaves the other broken.

The two gates in `source/slang/slang-emit-spirv.cpp`:
1. `emitMemorySemanticMask` (~4353): maps the pointer's address space → the Memory-Semantics storage-class bit (e.g. `SpvMemorySemanticsUniformMemoryMask`). Used by `AtomicAdd`/`Inc`/`Dec`/`CompareExchange` **unconditionally**.
2. `isAtomicableAddressSpace` (~4673): a separate switch (`default: return false`). `AtomicLoad`/`AtomicStore`/`AtomicExchange` gate on it FIRST; when it returns false they fall back to **non-atomic** `emitLoad`/`emitStore` (~5462/5486/5516) — atomicity silently lost, module still passes `spirv-val`. This is worse than a loud failure.

Concrete case (PR #11735 for issue #11731): the PR added `case AddressSpace::Uniform:` (legacy pre-SPIR-V-1.4 SSBO storage class, `Uniform`+`BufferBlock`) to gate #1, fixing VUID-10870 for add/inc/dec/cmpxchg, but left gate #2 — so `__atomic_load/store/exchange` on the same SSBO silently downgraded. The IR is valid and reachable: the validator (`slang-ir-validate.cpp:484-492`) explicitly accepts `Uniform`+`BufferBlock` as an atomic destination.

**Why:** the two gates evolved independently and list overlapping-but-not-identical address-space sets; a per-address-space change to one is almost never complete without the other. The fixer's tests (only `__atomic_add`) and a codex critique both passed without catching it.

**How to apply:** when a Slang SPIR-V atomic fix touches one address-space switch, grep the other gate for the same case; if the validator (`isValidAtomicDest` in slang-ir-validate.cpp) accepts that address space, all six atomic op kinds must be covered. Also: a test asserting only the memory-semantics operand value (`%uint_72`) doesn't lock in the storage-class path it's named for — that same value is emitted on the StorageBuffer (1.4+) path too; pin the storage class (CHECK-NOT StorageBuffer) and add load/store/exchange variants.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782322436550-spir-v-atomic-emit-has-two-address-space-gates-a-p.md`_
