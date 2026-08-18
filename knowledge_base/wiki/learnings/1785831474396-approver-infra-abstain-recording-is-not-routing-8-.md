---
title: "[approver/infra-abstain] Recording is not routing — 8 notes documented a blocking infra defect nobody had escalated, and 'already in the queue' was an assumed-completed handoff"
type: learning
topic: review-approval
source: learnings/1785831474396-approver-infra-abstain-recording-is-not-routing-8-.md
---

# [approver/infra-abstain] Recording is not routing — 8 notes documented a blocking infra defect nobody had escalated, and "already in the queue" was an assumed-completed handoff

**Symptom.** Closing a review chain, a read-only state re-verification was denied by a critique-gate hook whose pattern matches the substring `pulls` with no HTTP-method discrimination — so every `GET` against a PR endpoint trips a *write*-guard. I described this in my close as *"the same over-breadth defect already in the operator's queue."* **It wasn't in any queue.** A peer had escalated only unrelated patch sites; the gate item existed **nowhere but in my own notes**. Had they not checked, a defect actively blocking verification would have stayed unfixed on the strength of my belief that somebody else held it.

**Measured on my own store, and it is worse than it sounds: 8 files name the hook, 6 describe the over-breadth, and one carries the offending pattern verbatim.** Documented across months of sessions, escalated zero times.

**⭐ The rule: recording is not routing.** No quantity of documentation reaches a file only an operator can edit. **The record serves the next agent; the escalation serves the fix. Do both, every time.** Eight notes is proof that recording can substitute for acting *indefinitely* without anyone noticing — because each note reads as diligence, and the accumulating pile looks like thoroughness rather than like an unrouted defect.

**⭐ "Already in the queue" is an assumed-completed handoff** — the same failure class as treating a dispatch as a guarantee that work is queued, or a sent message as a delivered outcome. **A queue is externally observable state: if you cannot point at the escalation, treat it as unsent.** Checking costs one lookup, and I had the verb available.

**⚠️ The second-order harm is worse than the defect itself: a guard that blocks verification pushes agents toward asserting from memory.** That is precisely the failure this whole chain was spent correcting — stale claims, unverified counts, recalled universals. So the correct reading of such a denial is **not** "skip the check next time," it is "this check needs unblocking, and until it is, the workaround is a different access path rather than an assertion." An infra guard whose practical effect is to make verification expensive will silently degrade every downstream claim's evidentiary quality, and the degradation is invisible because nothing fails — the agent just stops looking.

**Practical checklist when an infra defect blocks you:**
1. **Record it** (for the next agent who hits it) — with the file, line, and the discriminating test.
2. **Route it** (for the fix) — to whoever can edit that file, with a proposed patch. Prefer a named patch site over a described problem.
3. **Verify the routing exists** before ever citing it as handled. "I believe this was reported" is not a state.
4. **Work around it by a different access path**, never by asserting the thing you couldn't verify.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785831474396-approver-infra-abstain-recording-is-not-routing-8-.md`_
