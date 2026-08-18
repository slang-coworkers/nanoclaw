---
title: "[approver/critique-mustfix] 'Deliberate and tested' is not 'inconsequential' — intent and consequence are orthogonal in gap-severity calls"
type: learning
topic: review-approval
source: learnings/1786113456723-approver-critique-mustfix-deliberate-and-tested-is.md
---

# [approver/critique-mustfix] "Deliberate and tested" is not "inconsequential" — intent and consequence are orthogonal in gap-severity calls

## Symptom

On slangpy#1094 I cleared a Devin gap (removal of the corrupt-cache `remove_all`
self-heal) on the reasoning: *the new test is literally named
`invalid_shader_cache_is_disabled_without_deleting_cache` and asserts the
preservation directly, therefore this is deliberate, not a defect.* The
DECISION_REVIEW critique reversed it, correctly.

I was simultaneously writing, in the same document, that I could **not resolve**
whether the trade had been accepted (the PR has no description). Clearing while
recording unresolved uncertainty is self-contradictory — the severity bar says
uncertainty abstains.

## Root cause

The severity bar asks whether a gap is **inconsequential**: trigger unreachable,
covered elsewhere, or pure future-proofing. I answered a different, easier
question — *is it intentional?* — and let the answer stand in for the first.

They are orthogonal. A deliberate, well-tested design decision can carry a large
blast radius; the test proves the author meant it, and says nothing about whether
a maintainer accepts the tradeoff. Here: caching stays off for that path on every
subsequent run, recoverable only by a human deleting the directory by hand, with
no on-disk repair path anywhere in the cache implementation (grep-verified). All
of that is true *and* the behavior is intentional.

The pull toward the wrong question is strong because evidence of intent is cheap
and satisfying to find — a test name, an assertion, a comment — while evidence
about consequence requires tracing what happens on the failure path afterward.

## How to catch it

- When about to clear a gap, state the clear in the bar's own vocabulary:
  "trigger unreachable because X", "covered elsewhere at Y", "no real-world
  trigger because Z". If the sentence you actually want to write is "the author
  did this on purpose", you have not cleared it — you have identified the author's
  intent, which is a different finding.
- **A test asserting behavior B proves the author wanted B. It is not evidence
  that B is safe.** Never launder a test into a severity clear.
- Cross-check the document for self-contradiction before recording: an
  "unresolved / could not determine" note anywhere in the same reasoning about
  the same gap is disqualifying for a clear on that gap.
- Deliberate-but-consequential is a real and common category, and it is exactly
  what abstain exists for: the decision a human must make, not one the author
  already made.

## Fix

Reversed to `OPEN_GAP` on slangpy#1094; the recorded reason now separates intent
("deliberate and directly asserted by the new test") from consequence
("persistent, warning-only, requiring manual deletion to recover; no on-disk
repair path"), and states that accepting the trade is a maintainer's product
decision. Two other critique corrections in the same round are worth noting as
the same family of error — asserting a regression from the *shape* of a finding
without checking the diff for the line being cited, and describing a
5-warning failure path as "silent, behind one log_warn". In all three, a
plausible characterization went in unverified against the artifact it described.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786113456723-approver-critique-mustfix-deliberate-and-tested-is.md`_
