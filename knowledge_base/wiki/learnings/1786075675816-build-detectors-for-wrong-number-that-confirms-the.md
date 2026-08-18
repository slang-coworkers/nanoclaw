---
title: "Build detectors for 'wrong number that CONFIRMS the hypothesis' — and treat a flattering diagnosis like a flattering number"
type: learning
topic: ci-tooling
source: learnings/1786075675816-build-detectors-for-wrong-number-that-confirms-the.md
---

# Build detectors for "wrong number that CONFIRMS the hypothesis" — and treat a flattering diagnosis like a flattering number

**2026-08-07, a four-round audit exchange over one CI issue (shader-slang/slang #12418).** Two agents each verified their own work at every step. Six defects surfaced. **Every single one was caught by the other party's instrument disagreeing — never by our own verification passing. And our own verification passed every time.**

The defects, and the direction each failed in:

| defect | whose | failed toward |
|---|---|---|
| bucketed CI reds by signature-string presence, not terminal failure (11 of 29 rows misfiled) | mine | infra / rerunnable |
| a retry-promotion path (`Too many failed tests for retry(N)`) let 2 jobs supply 200 of ~250 terminal failures, inflating a discriminator | mine | infra |
| "both counts correct, different scopes" — a reconciliation I reached for without checking their set | mine | dispute resolved, nothing to check |
| a timeout mechanism inferred from a skew that actually argued the opposite way | mine | plausible story, inquiry closed |
| coverage check comparing a cache against a set derived with the **same narrow bound** ⇒ self-confirming "0 missing" | theirs | complete, nothing missing |
| integrity invariant `rows == distinct ids`, blind to **truncation** (a truncated file satisfies it perfectly); 4 files had 0 rows and were reported "594/594 fetched" | theirs | complete |

⭐⭐⭐ **The common structure: each defect's failure mode AGREED with the hypothesis being tested.** A wrong number that contradicts your expectation gets investigated within minutes. A wrong number that confirms it is never contradicted by anything downstream, so it survives indefinitely. **The class of bug to build detectors for is not "wrong number" but "wrong number that confirms the current hypothesis."**

Concretely, for CI-classification tooling:
- Assert on **completeness**, not shape: `rows_written == total_count` (the API gives you `total_count` — use it). `rows == distinct_ids` cannot see truncation.
- Verify coverage against an **independent basis**. Deriving your comparison set with the same filter/bound you're testing produces a null that means nothing.
- A figure that **reproduces** on re-derivation is not vindicated — offsetting errors cancel. My headline count re-derived to the identical number while 11 of 29 members were wrong. **Verify members, not totals.**
- Perishable fields (`steps[]`, job logs — ~7-day retention) make a rate **drift toward healthy as its window ages**. Store the derived bucket, stamp it with a date, and say when it stopped being reproducible.

⭐⭐ **The corollary that nearly cost us the real bug: a flattering DIAGNOSIS needs the same falsification probe as a flattering number.** I diagnosed their missing row as a `filter=all` omission. It fit their evidence exactly, explained the row, and flattered a shared "we both already know this trap" framing. They almost accepted it — which would have "fixed" a non-bug and shipped the real one (silent truncated writes) forward. What killed it was one measurement: their 22 rows overlapped the default-filter set in **0 of 22**, so a truncated `filter=all` response could not be a subset of default. **Diagnoses that make both parties look competent are the least audited artifacts in a review.**

**Practice worth adopting:** adversarial cross-derivation as a standing step for any figure that will reach a maintainer — not a second look by the same instrument, but a genuinely independent one, with the explicit question *"which way does an error here push my recommendation?"* If the answer is "toward the conclusion I already hold," that figure needs the independent pass most.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786075675816-build-detectors-for-wrong-number-that-confirms-the.md`_
