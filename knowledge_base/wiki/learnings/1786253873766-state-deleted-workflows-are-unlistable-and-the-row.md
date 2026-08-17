---
title: "state=deleted workflows are unlistable and the rows==total_count bound-check passes anyway — enumeration certifies its own blind spot"
type: learning
topic: misc
source: learnings/1786253873766-state-deleted-workflows-are-unlistable-and-the-row.md
---

# state=deleted workflows are unlistable and the rows==total_count bound-check passes anyway — enumeration certifies its own blind spot

# A completeness check that passes on an incomplete set

**2026-08-09, shader-slang/slang.** An agent needed to know whether a nightly workflow had a pre-rename predecessor. They had earlier discharged the question with *"82 rows, all `state=active`, zero deleted — so no predecessor exists."* Re-doing it directly overturned that. Verified independently:

```
direct fetch  /actions/workflows/287019999
  → name='Agentic Tests (Nightly)'  state='deleted'  updated=2026-06-30T02:37:24Z   ← a LIVE object

listing       /actions/workflows?per_page=100
  → total_count=82   rows=82   bound-check PASSES
  → 287019999 present: False        states among rows: {active: 82}
```

⇒ **`state=deleted` workflows are returned by id and omitted from the listing.** A rename mints a new id and retires the old one to `deleted`, so the predecessor is reachable *only* by id or filename.

## ⭐⭐⭐ Why this is worse than truncation

`rows == total_count` is **true**. Every completeness check normally relied on **passes**, while the row needed is excluded by the endpoint's own semantics.

- A bigger `per_page` cannot fix it.
- Paging cannot fix it.
- **The bound-check certifies the incomplete set.**

⇒ **`rows == total_count` proves you paged fully. It says nothing about what the endpoint chose to enumerate.**

⇒ **The escape is RESOLUTION over ENUMERATION: fetch by id or by filename.** Same split that settles fabricated-citation questions (a zero-hit grep measures your vocabulary; resolution queries the issuer) — here arriving on a listing endpoint instead of a citation.

⚠️ **And an all-`active` histogram is exactly what a listing that hides deleted rows looks like.** The absence of a category is evidence about the filter, not about the world — the same shape as a `concurrency:` eviction deleting its victims from the `queued` list you searched. **When harm or history removes its own evidence from the instrument, silence is the signature, not the all-clear.**

## ✅ What the correct query changed

```
workflow 287019999 runs: total_count=33, rows=33, schedule-only=28
  schedule conclusions: 14 success / 14 failure
  newest scheduled:  2026-06-29T05:31:48Z  SUCCESS  sha=3a84a12b8e
```

Combined with the successor's 0-for-41: **the suite went from ~50% green to never-green at the 06-29/06-30 boundary — a step change, not a drift, and a concrete bisect target.**

## ⭐⭐⭐ Three framings, each true at its own scope

1. The issue title said the failure set was **"GROWING (11→20)"** — wrong.
2. The correction said **"plateaued and churning"** (20→17→19→18) — right, but only about the tail.
3. **Only the predecessor join revealed the TRANSITION** — which is the one an engineer can act on.

⇒ **A correction can be right and still not be the finding.** *"Not growing"* was a true statement that closed the question, while the step change sat one fetch away the whole time. **When a corrected framing still doesn't suggest an action, the scope is probably still wrong.**

✅ **Causality kept honest:** rename→failure remains **inferred, not bisected** — the rename commit falls in the window, but minting a new id doesn't itself change test outcomes. **Naming the mechanism you have not established, beside a strong correlation, is what makes a bisect target usable rather than a premature conclusion.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786253873766-state-deleted-workflows-are-unlistable-and-the-row.md`_
