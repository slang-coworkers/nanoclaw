---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786379727146-vxsict
written_at: 2026-08-10T19:32:01.177Z
---

# [approver/challenger-miss] Date a scraped page by summing its parts, not by reading its header — a capture can be R2 metadata over an R1 body

## Symptom

slang#12455 got a second push while I was deciding, so I re-ran Devin against the
new head `656583bb`. The capture's header looked unambiguously fresh: `3 files`,
`+274 −9`, `Commits 2` — all exactly right for R2 (R1 was `+307 −9`, 1 commit).
By the rule I already had ("date the capture by its own content, never the page
header"), it passed.

It was still stale. The **analysis body** was R1's.

## How I caught it — arithmetic, not inspection

Devin lists per-section diff figures above its narrative. I summed them:

```
+18/−2  +133  +26  +112  +18/−7   =   +307 / −9
```

That is R1's total, not R2's `+274/−9`. And the arithmetic closes exactly: R2's
commit was 7 insertions / 40 deletions, and `307 − 274 = 33 = 40 − 7`. Section 4
("Self-tests") reading `+112` is R1's self-test block; R2 had trimmed it.

Two corroborating signals, both in the same capture:
- the page still read `Loading diffs…` — the diff panel had never finished;
- `Checks 49/51`, matching R1's 49 check-runs; R2's head has 48.

So the page was **internally inconsistent**: live sidebar metadata rendered over a
cached analysis of the previous revision. The header is not a timestamp for the
body.

## Root cause of my near-miss

My existing rule said "date it by content, not the header" — and I applied it to
the *totals line*, which is content, and which was correct for R2. But the totals
line and the analysis body come from **different refresh paths**. Checking one
piece of content does not date another.

## The rule

**Sum the parts and check they equal the whole.** When a scraped artifact reports
both an aggregate and a breakdown, they are independent observations; agreement
means fresh, disagreement dates the stale half. This is stronger than any
single-field freshness check because it needs no external reference — the page
refutes itself.

Generalized: *a composite artifact has a freshness per region, not per document.*
Before trusting any region, find a second region that should be arithmetically or
logically tied to it and verify the tie. If nothing in the artifact constrains the
region you care about, you cannot date it — record it **unattested** and exclude
it in **both** directions (neither a finding nor a clean bill), which is what I
did here.

## Prior art this extends

I already knew "Devin's first capture after a push is the old rev, and it looks
live." That framing implies the *whole* capture is one revision or the other. The
real failure mode is worse: it can be **both at once**, and the fresh half is
exactly the half you'd check first.
