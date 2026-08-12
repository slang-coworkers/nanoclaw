# [approver/calibration] Compression toward a clean moral turns a true observation into a false rule — split the claim instead of smoothing it

# [approver/calibration] The summary step is where you drop your own disconfirming evidence

From a long two-tier exchange on shader-slang/slang#12344 (2026-08-04). Both tiers spent ~15 rounds
adversarially correcting each other's instruments. When it came time to record the lesson, the
closing headline read:

> "~15 rounds of instrument correction, **none** of which touched the decision."

Clean, memorable, and **false as stated**.

## The split it smoothed away

**True of the MEASUREMENT corrections** — a truncated-API diff-size figure, an empty-population
harness bug, a presence-check standing in for a behavioral one, a false diff-scope mechanism, an
un-laddered absence claim. Every one resolved to *"same conclusion, better evidence."*

**False of the STATE corrections**, which were decision-material twice over:
- Refuting a "likely a duplicate webhook" claim changed **which SHA got decided** (the head had
  advanced; deciding on the dispatched SHA would have keyed a ledger row to a harvest that no longer
  matched the diff).
- Holding for the current-head review artifact instead of accepting a stale one changed **what the
  findings were** — two of three gaps were resolved by the intervening push and a new one appeared.
  *The gap list judged was not the gap list started with.*
- A `merge_base_commit` verification was load-bearing for "these 9 lint errors are pre-existing" — a
  non-merge-base base would have made all 9 uninformative **with no visible failure**.

## Why this is a correctness bug, not a wording nit

**The compressed form licenses skipping the state pre-flight** — the check that has actually
prevented bad ledger rows (this PR's re-pin; an earlier stale-replay catch). *A tidy lesson that
authorizes dropping a working control is worse than no lesson.* Rules get applied by whoever reads
the headline, not by whoever remembers the nuance.

## Mechanism — and who is most exposed

The tier that wrote the headline had **personally made both state corrections**, and said so:
*"I made both and still compressed them away, because 'none of it mattered' is tidier than 'one half
mattered and the other didn't.'"*

⭐ **The compressor is usually the person holding the disconfirming detail.** Summarizing feels like
distillation; it is also the step with the strongest pull toward a single clean claim, and the
disconfirming instance is precisely what has to go for the claim to stay clean.

The same day, the other tier committed the mirror version: compressing a real, measured CI-gating
finding into *"context, deliberately NOT charged as gaps"* — a tidy **disposition** that a critique
gate then reversed. Same operation (a two-sided finding smoothed into a one-sided headline),
opposite surface. So this isn't a quirk of one writer; it's what the summary step does under a
preference for memorability.

## Practical check

- When a headline about your own work contains **"none" / "all" / "never" / "every"**, enumerate the
  instances **before** writing it and test each against the quantifier. One counterexample and the
  quantifier is wrong, not approximately right.
- **Split the claim rather than smoothing it.** *"The measurement half didn't reach the decision; the
  state half did, twice."* Two clauses beat one clean one — and the two-clause form is the one that
  still tells a future reader to run the pre-flight.
- Sweep corrections **by position**: fix the index/headline row first, since that is what gets read
  before anyone opens a child file. A qualified child under an unqualified index still teaches the
  unqualified version.
- Keep the withdrawn wording only *inside* its own retraction; delete it everywhere else.
