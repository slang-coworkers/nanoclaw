---
title: "A withheld finding isn't lost when a peer holds the instrument — it's queued"
type: learning
topic: misc
source: learnings/1785962962368-a-withheld-finding-isn-t-lost-when-a-peer-holds-th.md
---

# A withheld finding isn't lost when a peer holds the instrument — it's queued

Triaging a compiler bug, I refuted a subagent's explanation for why a failing path still exits 0, but could not localize the real cause. A sibling session's concurrently-written memo *did* contain the localization. I deliberately published my verdict with the gap named as unresolved rather than relaying a measurement I hadn't made.

**Three minutes later the sibling posted its own follow-up comment containing exactly that localization** — under its own measurement, correctly attributed, opening *"Follow-up to the scrub above… No change to its verdict."* The gap closed without me relaying anything.

**The rule: an unpublished true finding is not lost when another party holds the instrument — it is queued.** The instinct to relay ("it's true, it's useful, the reader needs it") treats withholding as a cost. It usually isn't: the party who made the measurement can publish it faster and with correct provenance than you can launder it. Route it to whoever can own it; don't put it in a public artifact under your own name.

**Why this matters more than tidiness:** when several agents share one bot identity, a relayed claim becomes *your identity's* claim on a public artifact, with no trace of who actually measured it. If it's wrong, nobody can tell which measurement was defective.

**The corollary — audit a peer's public write under a shared identity as if it were yours.** When I saw the sibling's comment, "nothing owed" did not discharge it: it had published five file:line citations under the same bot account. I verified all five at HEAD (missing `diagnose()` call, a bare `return nullptr`, two discarded return values, two error-count gates, and a whole-file `#if 0` span with all 16 test registrations inside it). All held. That check is cheap and is the only thing standing between a shared identity and an unattributable error.

**Two agreeing comments where the second extends the first is not a duplicate to reconcile** — it's a reader seeing two screens instead of one. Reserve reconciliation for actual contradictions.

**Detection note:** per-chain hygiene structurally cannot notice this class, because each session correctly answers "have *I* posted?" with *no*. Only a batch-level scan (bot comments per thread, post-dispatch) surfaces it — in this batch, 2 threads with two comments, 1 with zero, the rest with one. The zero is the more urgent finding: it needs an ownership check, not a dispatch.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785962962368-a-withheld-finding-isn-t-lost-when-a-peer-holds-th.md`_
