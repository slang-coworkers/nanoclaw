---
title: "Two verification failures no store audit can catch: compression drop and magnitude-preserving attribution error"
type: learning
topic: misc
source: learnings/1785918806752-two-verification-failures-no-store-audit-can-catch.md
---

# Two verification failures no store audit can catch: compression drop and magnitude-preserving attribution error

## Why these two are special

Every verification habit worth having reads **stored text**: frontmatter audits, link checks, count
reconciliation, restatement sweeps within a document. These two failures are invisible to all of
them, because in both cases **the store is correct**.

## 1. Compression drops a qualifier the store holds

A coworker had written **"3/3 post-onset"** in their own anchor file — twice — then compressed it for
an operator as *"every examined draw failed, across days."* The unqualified form was refutable on the
spot: the runner had passed cleanly the day before the onset.

**The failure is in the transform from store to message, and nothing persists the transform.** A
store audit passes. A memory-based self-check passes, because you remember the *claim*, not the
sentence.

⇒ **Before compressing a claim for an operator, diff it against the stored sentence — open the file,
compare literally. Not against your memory of it.**

**Corollary: a correct time-scoped zero becomes a false universal the moment the date is dropped.**
"Zero head-check occurrences" was true *today* and false *historically*. Keep the scope attached or
the claim inverts.

**And the qualified form is usually stronger, not weaker.** "Always broken" is a worse case for
decommissioning a machine than "demonstrably worked, then stopped" — an onset is what licenses "look
for what changed" and implies a fix exists. Dropping the qualifier discarded the best evidence in
order to sound stronger.

## 2. A magnitude-preserving attribution error survives reconciliation

A tally read **9 failures / 6 runs / 0 passes — every number correct** — while two of the run→PR
citations were transposed: one run belonged to a different PR entirely, which double-counted one PR
and dropped a run from another.

**Every summary check passed, because the sums were right.** Reconciling totals cannot detect a
*permutation* of labels — the magnitude is invariant under the error.

⇒ **Verify labels at source.** Read each record's own identifying fields (for GitHub Actions: the
run's `event` and `head_branch`); never infer an entity from position in a list or adjacency in your
notes.

## 3. The instrument trap underneath it

⛔ **For GitHub Actions, run-level `.conclusion` reports only the LATEST attempt and masks earlier
failures.** I opened a run, saw zero failing jobs, and dismissed it as clean — attempt 2 had
succeeded over attempt 1's genuine failure. Enumerate
`repos/<r>/actions/runs/<id>/attempts/<n>/jobs` when attempt history matters.

That masking also hid a real distinction: **a job failure inside a merge-group run does not imply the
PR was evicted** — a retry on a healthy runner can rescue it in-queue, leaving exactly one
`failed_checks` event in the timeline. Occurrence counts and eviction counts measure different
things; don't substitute one for the other.

## The unifying shape

**A check often has to be inverted to have content.** "Does this file contain the right recipe?"
returns yes for a file that *also* contains a wrong one. The useful predicate is the negation — "does
it contain any wrong one?" — which requires enumeration, not a spot check. Same asymmetry as an
absence proof.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785918806752-two-verification-failures-no-store-audit-can-catch.md`_
