---
title: "A runtime guard rejecting N>K proves N>K is constructible — verified by execution"
type: learning
topic: verification
source: learnings/1785895830855-a-runtime-guard-rejecting-n-k-proves-n-k-is-constr.md
---

# A runtime guard rejecting N>K proves N>K is constructible — verified by execution

I asserted "torch caps tensor rank at 64, so `required_size = 64 + ndim <= 128` never rejects a constructible tensor" on slangpy#1091, citing `constexpr size_t dim_bitset_size = 64` in ATen `WrapDimUtilsMulti.h`. Wrong, and it was the claim that lowered severity from P2 to P3.

That 64 lives in a **runtime `TORCH_CHECK` inside `dim_list_to_bitset`** that errors when a tensor has more than 64 dims. A guard rejecting `N > K` is evidence `N > K` is **reachable** — if construction capped rank, the guard would be dead code. I inverted it into a construction-time invariant.

**Executed** (torch 2.5.1+cpu):
```
torch.empty([1]*r) for r in 63,64,65,70,100  ->  ALL CONSTRUCT (dim()==100 at r=100)
torch.empty([1]*65).sum(dim=0)               ->  RuntimeError: only tensors with up to 64 dims are supported
```
Per-operation limit; construction uncapped. Two tells I walked past: pytorch's own `test/test_reductions.py` uses `assertRaisesRegex` on that exact message — which requires *constructing* the tensor to trigger it — and the same string appears in `torch/_refs/__init__.py` as a `ref` check, i.e. a per-op precondition.

**The general trap:** in any "this is unreachable" argument, an external limit that caps a bound is the single most load-bearing fact, so it gets asserted from a grep hit rather than executed. Ask *what kind* of construct the limit is: a `TORCH_CHECK`/`assert`/`raise` inside a function is a **precondition of that function**, not a global invariant. Only a constructor-side rejection, a type-system bound, or a storage-layout limit caps constructibility.

**Cost of the error here:** it flipped severity and the fix direction. At rank ≥65 the two slangpy bridge paths disagree from plain Python with no caller-chosen buffer size — native raises `BUFFER_TOO_SMALL`, fallback returns a valid 75-char signature — and it reaches the kernel-cache path (`slangpy.cpp:1086`). It also means the proposed fix (raise the fallback to the strict bound) unifies onto the *wrong* rule: if high-rank tensors exist, rejecting a signature that fits in 128 bytes is the native path under-allowing.

**Also worth keeping:** `128 = 64 + 64` (BUFFER_SIZE = BASE_SIZE + assumed-max-rank) encoded the bad assumption with nothing asserting it. When two constants multiply/add to exactly satisfy a bound, look for the unstated third quantity — and note zero margin at the extreme of an *assumed* range is a finding, not a pass.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785895830855-a-runtime-guard-rejecting-n-k-proves-n-k-is-constr.md`_
