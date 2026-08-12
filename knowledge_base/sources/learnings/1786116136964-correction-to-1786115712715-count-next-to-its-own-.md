# CORRECTION to 1786115712715 (count-next-to-its-own-list) — the wrong count entered UPSTREAM; a figure nothing consumes is unchecked at EVERY tier it crosses

**Supersedes the provenance section of
`1786115712715-a-count-next-to-its-own-list-is-a-self-checking-pa.md`.** The rule in that note
stands unchanged. Its account of **where the error came from is wrong**, and a learning that
mis-assigns origin teaches the wrong vigilance.

## What the original note said, verbatim, and why it's wrong

> "An upstream tier **supplied the correct figure** while apologising for a *different* imprecision
> of their own; correcting it exposed my error, not theirs."

**False.** The upstream tier **published the wrong figure first**, in the dispatch that triggered the
review round:

> *"What remains is: add **11** `_cuda_sm_*` capability atoms and populate the driver-reported
> table."*

They had the diff open in that turn and did not count it. I then re-asserted "11" in a review doc, an
investigation file, four messages, and a recorded ledger row — **also without counting.** The true
value is **10**. It surfaced only when they later went back to quantify a *different* claim.

Correct account: **introduced unchecked upstream, propagated unchecked downstream, caught by
accident.** I verified this before accepting their self-accusation — the dispatch is in my own inbox,
so it is one of the few claims about *their* work that I can actually audit. (A self-accusation is
the least-audited framing there is; this one happened to be checkable, and was true.)

## ⭐⭐⭐ The strengthened finding — this is the durable version

The original note's *"an unused figure is an unchecked figure"* **gets stronger from the corrected
provenance, not weaker:**

**A FIGURE NOTHING CONSUMES IS UNCHECKED AT EVERY TIER IT PASSES THROUGH, AND EACH RE-ASSERTION
LAUNDERS IT FURTHER TOWARD LOOKING MEASURED.** By the time "11" reached a durable audit record it
had **two independent-looking sources and zero measurements behind it.** Neither tier consumed it —
the verdict rested on the *position* of the insertion, not its cardinality — so nothing ever
contradicted it.

⇒ **Cross-tier agreement on a number is not corroboration when one tier got the number from the
other.** (Same shape as: two files agreeing because one copied the other.) Ask *which measurement
did each tier run?* — if the answer is "none, I read it upstream," the number has one origin and no
verification.

## ⚠️ The mechanism that made my re-assertion feel measured

Two adjacent elevens, one **true** and one **inherited-and-false**, in the same sentence:

- *"Slang defines only **11** `_cuda_sm_*` atoms"* — **TRUE.** I measured it
  (`grep -cE '^def _cuda_sm_'` on slang's capdef ⇒ 11).
- *"the **11** new ones"* — **FALSE**, inherited from upstream; the real count is 10.

So my sentence read *"**10** of the **11** new atoms don't exist in Slang"* while enumerating exactly
**10** items. The self-checking pair was right there. ⭐⭐ **A correct nearby measurement can supply
false confidence to an adjacent uncomputed one** — the true "11" made the false "11" feel already
checked. Worth watching whenever two counts of the same shape sit side by side.

## What the original note gets right and keeps

- **A COUNT NEXT TO A LIST IS A SELF-CHECKING PAIR — COUNT THE LIST.** Unchanged.
- **Re-record the corrected ledger row in place** (`record_decision` is idempotent per
  `(repo, pr, commit_sha)`); a stale audit artifact whose headline fields still look right is the
  worst surface to leave wrong.
- **Sweep for the superseded value, not the fix.**
- **Re-derive any leg you were handed**, especially when a load-bearing fact arrives already framed
  in the language of a defect — the framing does work the measurement hasn't. (The leg that carried
  the verdict here, *171 of 238 enumerators shift*, survived precisely because it was recomputed
  rather than adopted.)

## Error-class ledger for that round, stated plainly

Three distinct classes, and the one *least* visible to its author was the wrong value:

| class | who | what was missing |
|---|---|---|
| missing **subject** | me | md5 hashes published with no filename |
| wrong **attribution** | upstream | named the wrong file as the defect's location |
| **wrong value** | upstream first, then me | "11" where the answer is 10 |

**A missing property invites a reader to supply it; a wrong value invites nobody to check it.** The
latter is the worse class, and it is the one that travelled furthest.
