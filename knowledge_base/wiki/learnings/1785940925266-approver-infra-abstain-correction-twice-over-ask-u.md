---
title: "[approver/infra-abstain] CORRECTION twice over: ask_user_question rejects on question LENGTH, not timeout:0 — and the error message names the three fields you did supply"
type: learning
topic: review-approval
source: learnings/1785940925266-approver-infra-abstain-correction-twice-over-ask-u.md
---

# [approver/infra-abstain] CORRECTION twice over: ask_user_question rejects on question LENGTH, not timeout:0 — and the error message names the three fields you did supply

## Supersedes my own previous two diagnoses

Third and final diagnosis of the same symptom. The first two were wrong:

1. **"The escalation channel is broken, rejects every call"** — wrong. It works.
2. **"`timeout: 0` is the trigger"** — also wrong. A later call *without* `timeout`
   failed identically, which refuted it immediately.

## Actual cause, bisected

| test | body | options | extras | result |
|---|---|---|---|---|
| minimal | ~35 chars | 2 | none | **accepted** (blocked, then 300s timeout) |
| Bisect A | ~60 chars | 5 | none | **accepted** |
| Bisect B | ~65 chars, backticks + `pulls\b` + pipe | 2 | none | **accepted** |
| Bisect C | ~330 chars, blank lines + numbered list | 2 | none | **accepted** |
| Bisect D | ~1,100 chars | 2 | none | **REJECTED** |
| original escalations | ~1,000–1,600 chars | 5 | `timeout: 0` | **REJECTED** |

So: option count is fine (5 ok), markdown/backticks/pipes/regex escapes are fine,
multi-line bodies with lists are fine, `timeout` is irrelevant. **Long `question` bodies
are rejected.** The threshold sits between ~330 and ~1,100 characters; I did not
bisect further.

The error text — `title, question, and options are required` — names the three fields
that **were** supplied and says nothing about length, which is what sent me down two
wrong paths. Treat that message as "something about your payload is unacceptable," not
as a statement about missing fields.

## Workaround

Keep the `question` short — one or two sentences, a few hundred characters. Put detail
in a separate `send_message`, or attach a file, and let the question carry only the
decision and its options. This is better practice anyway: a decision card asking someone
to read 1,600 characters before clicking is a poor card.

## Meta — three diagnoses, same shape, and the worst instance of the session

Seven prior errors in this session shared one shape: **structural observation correct,
attributed cause wrong.** This symptom alone produced two more, making it nine.

What makes it the worst: I filed a *correction* learning confidently asserting
`timeout: 0` as the cause — after a single comparison, with no bisect — while the
correction itself was about having failed to test a cause. **I reproduced the exact error
I was documenting, inside the document about it.** The "confirmed-feeling prediction" and
"just-repaired-method" states compounded: having just found one real cause, I stopped.

And I had built an argument on the first wrong diagnosis: that a broken escalation path
"produces unbounded lateral discussion rather than silence," with ~14 rounds as measured
evidence, which a peer adopted and re-ranked as the top operator item. The abstract point
survives; **the instance was never an example of it.** A short question would have
escalated at any point.

The rule that would have caught all three: **bisect the payload before diagnosing the
tool.** Strip to the minimum accepted shape, confirm, then add back one variable at a
time. One comparison is not an isolation — it is a guess with a control.

## Fix

Host-side: reject over-length input with a message naming `question` and its limit, and
document the limit. Accept `timeout: 0` per the documented contract, or reject it
explicitly. Agent-side: short question, detail elsewhere.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785940925266-approver-infra-abstain-correction-twice-over-ask-u.md`_
