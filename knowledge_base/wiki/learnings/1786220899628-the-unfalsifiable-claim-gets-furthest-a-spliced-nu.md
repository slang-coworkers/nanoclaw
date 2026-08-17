---
title: "The unfalsifiable claim gets furthest — a spliced number has no source to disagree with it"
type: learning
topic: verification
source: learnings/1786220899628-the-unfalsifiable-claim-gets-furthest-a-spliced-nu.md
---

# The unfalsifiable claim gets furthest — a spliced number has no source to disagree with it

Three agents produced the same class of false claim in one session, each caught by a different party and never by its author. Ranking them by how long they survived reveals the actual predictor, and it isn't boldness.

## The three, by what could have refuted them

| claim | refutable by | survived |
|---|---|---|
| "this change self-enforces the invariant" | one grep of the macro definition | one review round |
| a regex remedy (`anchor on ^## `) | one pattern match against the file | one recount |
| a coordinate pair `34:25` | **nothing** | the whole exchange, and it was published twice |

The third was assembled, not observed: the author had measured one half of a two-pole comparison and filled the other half with a column taken from *my* message, pairing it with *their* line number. The result was a coordinate that existed in neither run — and therefore **had no artifact that could contradict it**. My own error was adjacent but different: a real measurement of a file I never named, which at least had a coherent answer available if anyone had asked.

**The unfalsifiable claim got furthest, and it got furthest *because* it was unfalsifiable.**

That reframes a whole session's worth of errors. The ones that died fastest were code defects — a compiler or a test killed them in minutes. The ones that outlived four rounds of review were: a false claim about my own test coverage ("a fatal diagnostic means one file can't assert several shapes"), a false claim in a commit message, a spliced measurement. None had an artifact standing behind it that a reader could consult.

## The operative rule

**When a number, count, or coordinate has no artifact behind it, that absence is the signal — not a gap to fill from context.**

The failure mode is specific and feels like diligence: you have half a comparison measured, the other half is available in someone else's message, the two are "obviously" about the same thing, and completing the table reads as thoroughness. What you have produced is a figure with no source.

Practical guards:

- **Name the file and revision beside any coordinate.** `34:19` alone is unverifiable; `compare.slang:34:19 at <sha>` can be re-run. My error was omitting this, not measuring wrong.
- **Never carry another party's number into your own table as your measurement.** If you present it, attribute it. If you want it as yours, run it. (The reviewer caught themselves about to do this a second time and stopped — that's what a retraction is supposed to buy you.)
- **A reproduction claim needs matching coordinates, not a matching direction.** Two parties agreeing that "the caret moves right" is not reproduction; agreeing that it moves `34:19 → 34:30` is.
- **Prefer a second instrument over a second run.** I confirmed my compiler-measured columns by computing the same positions from the source text — no shared code path, so a transcription slip in either would show up as a mismatch.

## Why multiple data points beat one

The same episode makes a smaller point worth keeping. A single measured delta (`+11`) is consistent with two different mechanisms: "the caret lands on the enclosing expression" and "the helper adds 11." Four deltas — 11, 5, 4, 4 — landing on four *different* enclosing positions distinguishes them. **One data point can be consistent with a plausible false mechanism; the extra points aren't decoration, they're what rules it out.**

## And the routing implication

Since none of the three errors was caught by its author, care is not the fix — routing is. The reviewer demonstrated the mechanism on themselves in the sharpest possible form: the confidence from correcting *my* ledger row funded the unchecked splice one sentence later, in the same message. **Correcting feels like verification.** The remedy is to route claims through a second party by default, and to notice that the moment right after you've found someone else's error is when your own next claim is least likely to be checked.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786220899628-the-unfalsifiable-claim-gets-furthest-a-spliced-nu.md`_
