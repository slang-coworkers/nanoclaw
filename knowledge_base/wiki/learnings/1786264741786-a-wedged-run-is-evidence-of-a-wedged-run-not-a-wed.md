---
title: "A wedged run is evidence of a wedged run, not a wedged outcome — verify the consequence at its own surface"
type: learning
topic: verification
source: learnings/1786264741786-a-wedged-run-is-evidence-of-a-wedged-run-not-a-wed.md
---

# A wedged run is evidence of a wedged run, not a wedged outcome — verify the consequence at its own surface

## The error

I found a `pages build and deployment` run stuck in `queued` for **72 days** (`updated_at` identical to `started_at`) and reported that published docs "may be silently stale since late May."

**Wrong.** A different endpoint answered the question the run object cannot:

```
GET /repos/{owner}/{repo}/pages         → status: errored, source: master//docs
GET /repos/{owner}/{repo}/pages/builds  → last "built": 2026-08-07T13:37Z
```

Pages published successfully **ten weeks after** that run stalled. The stalled run was an orphaned artifact blocking nothing. The real breakage was **2 days old, not 72**.

## The rule

**A wedge is evidence of a wedged *run*, never of a wedged *outcome*.** The leap from "this never finished" to "therefore the thing it would have produced is stale" needs separate evidence — and that evidence usually lives at a **different endpoint**, not in a deeper read of the same object.

Why the leap is tempting and wrong: **a system with more than one path to an outcome routes around a stalled run without telling you.** Retries, alternate triggers, and separate deploy paths all silently satisfy the outcome while the orphan sits there forever.

Report the two as separate claims. **Only the outcome claim is actionable.** Put this in the code that emits the flag (an `outcome_unverified` field on every candidate), not in prose a future reader must remember.

## Note the direction of the error

My version made the finding sound **bigger (72 days vs 2) and older** — the flattering direction for a finding. That's the asymmetry worth internalizing: an error that inflates the importance of your own discovery is the one least likely to get audited, so it owes the check *first*.

## Sub-finding: characterize precisely, with a control

"Three errors then a wedge" was still too coarse. Sorting the full 100-build window chronologically:

- Three `errored` builds **self-recovered** — the next build succeeded and five more followed.
- Three more `errored`, then one build entered `building` with `duration: 0` and **never advanced** (32h+).
- That `building` row is the **only one in 100 builds** spanning three weeks.

**The discriminator is the wedged non-terminal state, not the errors** — errors recur and clear; the wedge doesn't. Without the recovery control I'd have blamed the wrong thing.

And a scope check worth doing before escalating: `curl` the published URL. It returned **HTTP 200** with a real title, so the last good build is still being served. That makes it a **stale-content risk (43h and growing)**, not an outage — a materially different severity and urgency than "docs are down."

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786264741786-a-wedged-run-is-evidence-of-a-wedged-run-not-a-wed.md`_
