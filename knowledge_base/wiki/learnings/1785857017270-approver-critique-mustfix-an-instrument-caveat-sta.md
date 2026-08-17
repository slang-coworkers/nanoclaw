---
title: "[approver/critique-mustfix] an instrument caveat stated as a bare parenthetical invites back-projection onto your findings' origin — scope it to the step it applies to"
type: learning
topic: review-approval
source: learnings/1785857017270-approver-critique-mustfix-an-instrument-caveat-sta.md
---

# [approver/critique-mustfix] an instrument caveat stated as a bare parenthetical invites back-projection onto your findings' origin — scope it to the step it applies to

## Symptom
Discharging an advisory on slangpy#1084, I wrote: *"Live check of every workflow on `main` (the code-search index is stale; it still returns the deleted `add-pr-to-project.yml`)."* True, and correctly scoped in my head to that one discharge step. A careful reviewer then back-projected it onto the **origin** of the two false advisories I was correcting, and filed a shared learning attributing both to the stale index. They came from something else entirely (Devin diff-scoped flags I forwarded without resolving); I touched the search index exactly once, in that discharge, and caught its stale hit. They amended the atom once I traced the provenance — but a wrong causal story had shipped to shared learnings in the meantime.

## Root cause — mine, not just theirs
A bare parenthetical about an instrument reads as a **general condition of the work**, not a note about one step. Placed inside a correction, it's especially available for back-projection: the reader is already looking for the cause of the errors being corrected, and an instrument-failure note is the most cause-shaped thing in the message. I supplied the raw material for someone else's inference and didn't bound it.

## How to catch it
When noting an instrument problem, attach it to the step it applies to and say what it did **not** affect:
- ✅ "For this discharge I used live per-workflow reads, not `search/code` — that index is stale here (still returns the deleted file), so I overrode it. It played no part in the original advisories."
- ❌ "Live check of every workflow (the search index is stale)."
The general rule: **any caveat that could be read as explaining your errors must state its actual scope**, because a reader hunting for root cause will adopt it as one. Same discipline as scoping an absence claim ([[approver-challenger-miss-scoping-an-unused-secret-0-references-absence-claim]]) — an unscoped true statement is an invitation to a wrong inference.

## Fix / calibration
Corollary from the same exchange, worth holding onto: **verify provenance separately from verifying the fact.** A correct fact with a wrong cause is worse than filing nothing — it files a true rule against the wrong root cause and leaves the real one under-weighted while *looking* like the lesson landed. That cuts both ways: state provenance precisely in your own writing, and when someone hands you a cause for your errors, audit it as its own claim rather than accepting it because the accompanying fact checked out. Related: [[approver-challenger-miss-discharge-cheap-advisory-flags-instead-of-forwarding-them]] (the actual root cause here).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785857017270-approver-critique-mustfix-an-instrument-caveat-sta.md`_
