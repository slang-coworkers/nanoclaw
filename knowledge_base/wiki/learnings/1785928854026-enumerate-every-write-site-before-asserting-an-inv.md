---
title: "Enumerate every write site before asserting an invariant — grep beats mutual review"
type: learning
topic: review-process
source: learnings/1785928854026-enumerate-every-write-site-before-asserting-an-inv.md
---

# Enumerate every write site before asserting an invariant — grep beats mutual review

**Before you assert what a shared data structure preserves, enumerate every site that writes it — mechanically, first.**

```bash
grep -n 'm_typeCheckingCache' source/slang/*.cpp source/slang/*.h    # one call
```

**Exhaustiveness is a property of the tool, not of the attention.** Reading one site carefully tells you the *operation*; it never tells you the *invariant*.

**The case (2026-08-05, shader-slang/slang `m_typeCheckingCacheMutex`).** A performance claim about the global type-checking cache took **four successive narrowings**, each found by opening a site I hadn't:

1. *"`~Linkage` locks the mutex to **merge** the cache back"* — wrong verb. `slang-session.cpp:123-127` is a bare `RefPtr` **replacement** gated on strictly-greater `getCount()`. Nothing is combined. (A second agent inherited this verb, built a monotonic-growth claim on it, and routed it to a human before it was caught.)
2. Corrected the verb, then asserted *"content is not accumulated — the global is the largest single cache, not the union of all work."* **Also wrong** — I reasoned about content without reading the producer.
3. `slang-global-session.cpp:823-828` copy-constructs each Linkage cache **from the current global**, so a departing cache is normally a **superset** of what it replaces. Sequential use accumulates **losslessly**; loss requires **overlapping snapshots** (two Linkages copy the same global; the smaller one's new entries vanish while the count rises — *loss is invisible in the size*).
4. Finally ran the grep: **four** write sites, not two. `slang-session.cpp:147-149` **lazily creates an empty cache** when the global is null (`:825` guards the seed), so the first Linkage of a process is a superset of nothing. My "structural superset" claim was too strong — the correct one is **"the surviving cache is always the largest, and seeded caches are supersets of what they replace,"** which holds regardless of destruction order because the gate is on size.

**Transferable rules:**

- **Run the enumeration before the prose, not after two corrections.** Four narrowings in a row is evidence the cheap check was skipped, *not* evidence of healthy convergence. One grep would have prevented rounds 2 and 3.
- **A count rising does not mean content was retained.** Size-monotonic and content-monotonic are different properties; a gated wholesale replace gives the first without the second.
- **State the regime with the invariant** — "lossless sequentially, lossy under concurrent snapshots." An unqualified invariant is a scope error.
- **Mutual review and exhaustive enumeration do different jobs and are not substitutes.** Two agents refusing to adopt each other's unverified claims guards against *inheriting* a bad claim — it caught things here, but serially, one per round-trip, and it only ever finds what someone happens to look at next. *"No one has found the next problem yet"* reads identically to *"there are no more problems"*; only a bounded search distinguishes them.
- **Fixing the argument is not fixing the claim: sweep the restatements.** Descriptions, frontmatter, headings, index lines and table cells outrank prose because they're what a future reader scans first. Both agents in this exchange corrected a body and left a stale summary crediting the refuted framing — including this learning's predecessor, whose title said "read both halves" when the answer was four sites.
- **When your correction is already routed to a human, a second-order error goes out immediately** — not in the next scheduled report.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785928854026-enumerate-every-write-site-before-asserting-an-inv.md`_
