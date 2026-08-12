---
title: "A pre-flight 'has anyone posted yet?' check cannot prevent a double-post under a shared bot identity — it is evidence about the past, not a claim on the resource"
type: learning
topic: verification
source: learnings/1785961848290-a-pre-flight-has-anyone-posted-yet-check-cannot-pr.md
---

# A pre-flight "has anyone posted yet?" check cannot prevent a double-post under a shared bot identity — it is evidence about the past, not a claim on the resource

## What happened

A maintainer's webhook request ("scrub this stale issue") fanned out across 18 GitHub issues. The host
delivered it to **two agent groups independently** — a triager group and an orchestrator group — so every
issue had **two sessions working it in parallel, posting under the same bot identity**. Neither group knew
the other existed.

The orchestrator, believing it was coordinating a single worker, instructed the triager to "serialize the
remaining six, and re-check the bot-comment count before each post."

Result on one issue: the guard read `bot-comments = 0`, **correctly** — and ten seconds later the triager's
comment landed on top of a comment the other group had posted at `20:19:39` vs `20:19:49`. Two automated
scrub verdicts on one maintainer's issue.

## Why the guard cannot work

`check → act` has a window between the two steps. Under a concurrent writer you cannot close it, only
narrow it. A pre-flight read tells you **what was true at read time** — it is evidence about the past, not
a reservation of the resource.

⇒ **Under a shared write identity, treat any fan-out as racing by default.** `bot-comments = 0` does **not**
mean "unclaimed"; it means "nothing had landed yet when I looked."

## What actually helps

- **Fix it upstream:** don't have two groups working one list. This is a dispatch problem, not something
  the downstream worker can guard against. Whoever fans out owes the deduplication.
- **Post-then-reconcile beats check-then-post.** The mitigation that genuinely worked: after posting,
  immediately re-read the thread; if a twin appeared, post one short public reconciliation naming what the
  two agree on and what differs, so the human isn't left to reconcile two bot comments. That is repair, not
  prevention — but it is available and cheap.
- **Fix your own error in place, not in a new comment.** When the twin's version caught a real mistake in
  mine, the right move was PATCHing my own comment (read it live first, confirm still mine and unchanged)
  rather than adding a third comment to an already-crowded thread.
- **Before "finishing" leftover items in a shared queue, get a cross-group check** from whoever holds the
  cross-session view. A per-session view cannot see another group's in-flight work at all.

## Cost framing

A double-post under one bot identity is not merely noise — it is a cost to the **maintainer**, who now has
two automated verdicts to reconcile on their own issue. That asymmetry is why the reconciliation comment
mattered and why standing down on the remaining items was correct rather than merely cautious.

## Related

Same family as: a subagent's `gh` write leaving no outbound row in the parent session, so the session
record cannot distinguish "my sibling wrote this" from "an external party wrote this." When an unexplained
artifact appears under your identity, enumerate self-inflicted and same-identity causes *before* concluding
anything about an external writer.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785961848290-a-pre-flight-has-anyone-posted-yet-check-cannot-pr.md`_
