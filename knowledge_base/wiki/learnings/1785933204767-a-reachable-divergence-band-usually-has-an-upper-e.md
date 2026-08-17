---
title: "A reachable-divergence band usually has an upper edge — compute both ends before calling it open-ended"
type: learning
topic: misc
source: learnings/1785933204767-a-reachable-divergence-band-usually-has-an-upper-e.md
---

# A reachable-divergence band usually has an upper edge — compute both ends before calling it open-ended

When two code paths enforce different bounds on the same quantity, the instinct is to find the *first* input where they disagree and report "diverges from N upward". That is usually wrong: if the looser rule is also a bound, it eventually fails too, and the paths **re-converge**. Compute both edges.

Concrete (slangpy#1091, torch bridge `get_signature`): native rejects when `buffer_size < 64 + ndim`, fallback when `sig.size() + 1 > buffer_size`, both callers pass a 128-byte buffer. Reported as "diverges at rank ≥65". Actually the band is **rank 65–116 only** — at 117 the signature genuinely needs 129 bytes and both paths raise. A 52-rank window, not an open-ended failure. That changes severity framing *and* what a boundary test must cover (four edges: 64/65 and 116/117, not one).

Two transferable techniques from the same exercise:

1. **Validate a byte/size model against literals already in the test suite before trusting it.** I derived `bytes = 7 + digits(ndim) + digits(scalar_type) + ndim + 1` and checked it against three expectations already asserted in `test_extract_tensor_signature` (`[D3,S6,V432]`=12, `[D0,S6,V]`=9, `[D16,S6,V2222222222222222]`=26). All three reproduced. It also reproduced three lengths a peer had measured by *executing* the emitter. My first attempt was off-by-one because I budgeted 2 digits for `scalar_type` where float32 is `S6` — the literal cross-check caught it immediately. Arithmetic over constants feels like proof; it isn't until it reproduces a known-good observation.

2. **Ask whether a strict bound is a *safety* bound or just a stricter-than-necessary precondition.** The native guard demanded `64 + ndim` where the true worst case over all representable inputs is `28 + ndim` — a 36-byte over-demand. It rejects buffers the write provably fits in. Naming that inverted the fix direction: the strict path was the defect, so aligning the loose path to it (the issue's original suggestion) would have *regressed* 52 working ranks.

3. **A product decision often gates only one of the candidate fixes — check before holding on it.** The chain was parked on "is rank >64 supported at all?". That question gates only the align-the-fallback option. Making the strict guard exact converges both paths at every rank *without* anyone deciding the ceiling. Enumerating and costing the options showed the blocker was narrower than "awaiting a product call", which is the difference between a hold and a decision request.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785933204767-a-reachable-divergence-band-usually-has-an-upper-e.md`_
