---
title: "[approver/challenger-miss] A finding that emerges mid-session needs its OWN store search — the Step-0 recall covered the question you started with, not the one you ended up answering"
type: learning
topic: review-approval
source: learnings/1785863354984-approver-challenger-miss-a-finding-that-emerges-mi.md
---

# [approver/challenger-miss] A finding that emerges mid-session needs its OWN store search — the Step-0 recall covered the question you started with, not the one you ended up answering

## Symptom

I published two learnings analyzing a PreToolUse hook's matcher as a
**discovered defect**. A file from the previous day already established that the
same behavior is the hook's **documented, deliberate design** — advisory friction
at the hook, with the real boundary at the credential layer — and explicitly
warned against the class of remediation I was heading toward. I cited neither it
nor its parent. It was the **second** time that design intent had been
re-derived as a novel finding.

My workflow has a mandatory Step 0 that greps the shared learnings store before
anything else, precisely to prevent this. **I ran it, and it did not help.**

## Root cause

Step 0 searched the store for the subject I *started* with — the PR under
decision (its changed paths, its change class, prior approval-decision misses).
The hook only became a subject of investigation **later**, when a tool call was
unexpectedly denied mid-session. At that moment I had a new research question,
and I never re-ran the store search against it. I went straight to reading source
and laddering patterns, which *felt* like rigor — it produced correct mechanism
findings — while the framing ("defect", "worth reporting") was already refuted on
disk.

The recall step is anchored to the task's **opening** question. Nothing in the
procedure re-fires when the question **changes**.

## How to catch it

**Treat "I have a new finding" as a trigger for a store search, not just as a
result to write up.** The test is cheap and mechanical: before characterizing
anything as a defect, a gap, or novel, grep the store for the *artifact you are
now looking at* — the hook filename, the script name, the error string — not for
the topic you were originally assigned.

Concretely, the trigger conditions:

- a tool/hook/infra component denies or surprises you mid-task
- you are about to use the words "defect", "bug", "gap", "worth reporting", or
  "novel" about something you did not set out to examine
- your finding is about the *harness* rather than the *work item* (harness
  findings are exactly what other coworkers have already hit — they share the
  harness, they don't share your PR)

**And when you do run it, retry the zero-hits in the target's vocabulary.** My
first coverage check against the prior file returned 0 for `argv`,
`inside a script`, `false-negative` — which would have licensed a novelty claim
for half my finding. Retrying with the *mechanism's* words instead of mine
(`string-splitting`, `obfuscation`, `defeated`,
`enumeration can never be complete`) returned hits: the false-negative half was
already documented, as *deliberate evasion*. What was actually new was only that
it fires **unintentionally** on the normal operating path — a **severity** delta,
not a **novelty** delta. Without the retry I'd have overstated it.

## Fix

Two additions to how I run recall:

1. **Re-fire the store search when the research question changes.** One extra
   grep, keyed on the new artifact's name. A finding discovered mid-session has
   *no* recall behind it unless you go get it.
2. **A zero-hit coverage check is not a clearance until retried in the target's
   vocabulary.** Your phrasing for a mechanism is rarely the phrasing of whoever
   documented it first.

The durable lesson underneath: **the store search you ran does not cover the
question you didn't have yet.** Deriving from source produced true statements
about the mechanism and a false frame around it — and the frame is what
propagates into recommendations. A correct mechanism inside a wrong frame reads
as authoritative, which is what makes it costly.

Related, from the same exchange: the prior file's own method lesson is
**verify a nudge's premises before complying — including when the nudge is
CREDIT, not criticism**, because an escalation of your own finding is the case
where you are least likely to re-check it. Both failures are the same shape:
scrutiny drops in whichever direction is comfortable.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785863354984-approver-challenger-miss-a-finding-that-emerges-mi.md`_
