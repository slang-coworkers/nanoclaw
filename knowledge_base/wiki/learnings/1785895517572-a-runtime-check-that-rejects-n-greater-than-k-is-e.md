---
title: "A runtime check that rejects N greater than K is evidence N is constructible, not evidence of a cap"
type: learning
topic: verification
source: learnings/1785895517572-a-runtime-check-that-rejects-n-greater-than-k-is-e.md
---

# A runtime check that rejects N greater than K is evidence N is constructible, not evidence of a cap

# A runtime check that rejects `N > K` is evidence `N > K` is CONSTRUCTIBLE — not evidence of a cap

**2026-08-05, slangpy#1091.** A triage memo downgraded an issue to P3 partly on: *"torch caps rank at 64
(`dim_bitset_size`), so `required_size = 64 + ndim ≤ 128` — the native bound never rejects a
constructible tensor."*

The cited evidence is a `TORCH_CHECK` inside ATen's `dim_list_to_bitset`:

```
constexpr size_t dim_bitset_size = 64;
TORCH_CHECK(..., "only tensors with up to ", dim_bitset_size, " dims are supported");
```

**The inference runs backwards.** A *runtime check that errors* when a tensor has >64 dims is only
reachable if such tensors can EXIST. If construction capped rank at 64, that check would be dead
code. So the same text that was read as "rank is capped at 64" is better read as "rank >64 is
constructible, and *these particular ops* refuse it." A per-operation guard is not a
construction-time invariant.

## Why it mattered

The two constants are `BASE_SIZE = 64` and `BUFFER_SIZE = 128`. Since every in-tree caller passes 128
and the native rule is `buffer_size < BASE_SIZE + ndim`:

- rank 64 → `128 < 128` is false → passes **with exactly zero bytes of margin**
- rank 65 → `128 < 129` is true → `BUFFER_TOO_SMALL`, and the wrapper *throws*
- the fallback rule (`sig.size() + 1 > buffer_size`) needs only ~79 bytes at rank 65 → **succeeds**

So if rank ≥65 is constructible, the two paths diverge **from pure Python, with no caller-chosen
buffer size** — which was the exact scenario the memo had (correctly) refuted on the C-ABI axis, and
then wrongly declared unreachable everywhere. `128 = 64 + 64` silently encodes "max rank 64" and
nothing asserts it.

## The generalizable rules

1. **A guard's existence is evidence about what its input space CONTAINS.** Before citing a check as
   proof of an invariant, ask what makes it reachable. `TORCH_CHECK`/`assert`/`raise` on a condition
   implies the condition occurs.
2. **Distinguish a per-operation guard from a construction-time invariant.** Only the latter bounds
   what can exist. Where the check lives decides which one it is.
3. **Zero-margin arithmetic is a finding, not a pass.** When a bound holds by exactly 0 bytes at the
   extreme of an assumed range, the assumption is load-bearing and undocumented — say so instead of
   reporting "never rejects."
4. **Aligning to the stricter rule can turn a working case into a failing one.** The proposed fix
   (raise the fallback to the contractual bound) would make rank-65 fail on *both* paths, where it
   works on one today. Check which side of a divergence is the correct one before unifying.

Companion to *a claim that reduces urgency gets less scrutiny* and *would this reading have differed
if the claim were false?* — here the answer was no: the `dim_bitset_size` text reads identically
whether or not the cap exists, so it could never have discriminated.

**Verification status:** the backwards inference is established by inspection. Rank-65
constructibility itself is NOT yet executed (no torch in the triaging container) — the decisive
one-liner is `torch.empty([1]*65)` then `extract_torch_tensor_signature` under both
`torch_bridge_mode` values. Filed as a hypothesis with a named test, not as a fact.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785895517572-a-runtime-check-that-rejects-n-greater-than-k-is-e.md`_
