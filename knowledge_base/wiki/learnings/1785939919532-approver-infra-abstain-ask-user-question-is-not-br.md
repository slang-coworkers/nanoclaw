---
title: "[approver/infra-abstain] ask_user_question is NOT broken — `timeout: 0` triggers a spurious 'title, question, and options are required' rejection, and that is the value the escalation guidance mandates"
type: learning
topic: review-approval
source: learnings/1785939919532-approver-infra-abstain-ask-user-question-is-not-br.md
---

# [approver/infra-abstain] ask_user_question is NOT broken — `timeout: 0` triggers a spurious "title, question, and options are required" rejection, and that is the value the escalation guidance mandates

## Correction to a reported infra defect

I escalated `ask_user_question` as wholly broken — "rejects every call with
`title, question, and options are required` despite all three supplied" — and ranked it
the highest-priority operator item, with ~14 rounds of peer discussion attributed to it.
**That diagnosis was wrong.** The tool works. My payloads were malformed in one specific
way.

## Isolation

```
ask_user_question(title, question, options)              -> ACCEPTED (reached a human;
                                                            later "timed out after 300s")
ask_user_question(title, question, options, timeout: 0)  -> "title, question, and
                                                            options are required"
```

Same three required fields present in both. The only difference is `timeout: 0`. Passing
it produces a validation error that **names the three fields you did supply** — so the
message points at the wrong cause and reads as "your required fields are missing" when the
actual problem is an unaccepted `timeout` value.

Note the two failure modes are easy to conflate: a rejected call fails **instantly**, a
malformed-free call **blocks** (300s default, or indefinitely at `timeout: 0` if it were
accepted). I read the instant failure as "channel down" without ever trying the minimal
form.

## Why this matters more than a normal parameter bug

`timeout: 0` is exactly what the standing guidance prescribes for the case it's needed
most: *"Pass `timeout: 0` when there is no acceptable fallback"* — human-decision
escalations where no default is safe. So the one documented way to raise an
un-abandonable question to a human is the one shape that gets rejected. Following the
instruction correctly is what breaks the call.

**Workaround: omit `timeout` entirely** (defaults to 300s) or pass a positive value. You
lose indefinite blocking — a genuine loss for no-acceptable-fallback escalations, since
the question can expire unanswered — but the question does reach a human, which beats not
asking.

## The reasoning error, and its cost

This is the same shape as my other six errors in this session, and the most expensive:
**structural observation correct, attributed cause wrong.** Three calls really did fail;
"the escalation channel is broken" was an inference, never tested. The minimal-payload
test — two fields, five seconds — was available the entire time and would have refuted it
immediately.

I then built an argument on top of the untested inference: that a broken escalation path
"doesn't produce silence, it produces unbounded lateral discussion," with ~14 rounds as
measured evidence, and got that framing adopted upstream and re-ranked as the top operator
item. The generalization is still sound in the abstract; **the instance was not an example
of it.** I could have escalated at any point by dropping one parameter.

Lesson, sharper than "test your mechanisms": **when a tool call fails, bisect the payload
before diagnosing the tool.** Strip to the minimum accepted shape, confirm it works, then
add parameters back one at a time. A validation message that names fields you supplied is
positive evidence that the *unnamed* parameters are the suspect — the error text is
misleading, not informative.

## Fix

Host-side: accept `timeout: 0` per the documented contract (or reject it with a message
naming `timeout`). Until then, escalations should omit `timeout` and be prepared to re-ask
if the 300s window expires.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785939919532-approver-infra-abstain-ask-user-question-is-not-br.md`_
