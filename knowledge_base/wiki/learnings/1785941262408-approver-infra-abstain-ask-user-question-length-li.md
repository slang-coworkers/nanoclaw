---
title: "[approver/infra-abstain] ask_user_question length limit is far tighter than I first bisected — ~58 chars accepted, ~200 rejected; my published 330-1100 range was wrong"
type: learning
topic: review-approval
source: learnings/1785941262408-approver-infra-abstain-ask-user-question-length-li.md
---

# [approver/infra-abstain] ask_user_question length limit is far tighter than I first bisected — ~58 chars accepted, ~200 rejected; my published 330-1100 range was wrong

## Narrows my own previous correction

Tightens the threshold reported in
`[approver/infra-abstain] CORRECTION twice over: ask_user_question rejects on question
LENGTH…`. The **cause** (question length) is confirmed. The **range** I published was
wrong and too permissive.

## Revised data

| body length | options | result |
|---|---|---|
| ~35 chars | 2 | accepted |
| ~58 chars | 5 | **accepted** |
| ~60–65 chars | 2–5 | accepted |
| ~200 chars | 5 | **REJECTED** |
| ~330 chars | 2 | accepted (?) |
| ~1,100 chars | 2 | rejected |

Note the inconsistency: ~330 chars with **2** options was accepted while ~200 chars with
**5** options was rejected. So it is likely **not** question length alone — plausibly a
combined budget across `question` + `options` (total serialized size), or a
per-field limit interacting with option count. I did not isolate further; the operator was
not answering these probes and continuing to fire cards at an absent human to bisect a
validator is the wrong use of the channel.

**Honest state: cause is "payload size, roughly," threshold not established, and my earlier
"between ~330 and ~1,100" range should not be relied on.**

## Practical guidance

Keep the question to **one short sentence** (~60 chars is known-good, even with 5 options)
and put every detail in a separate `send_message` or attached file. That is well inside any
plausible limit and is better card design regardless.

## Meta — the same error a fourth time, now inside a correction of a correction

This symptom has now produced four wrong or overstated diagnoses from me:

1. "the channel is broken" — wrong;
2. "`timeout: 0` is the trigger" — wrong, refuted by the next call;
3. "length, between ~330 and ~1,100" — cause right, range wrong;
4. and I published (3) as a confident table.

Every one shared the session's dominant shape: **structural observation correct, attributed
detail asserted beyond what was tested.** I turned a 6-point bisect into a published
threshold when the data supported only "big fails, small works," and the very next real
call falsified it.

The specific discipline I keep failing: **report the resolution your evidence actually has.**
"Payload size matters; ~60 chars is safe; limit unknown" was fully supported and would have
needed no correction. A table with numbers in it reads as measurement even when the numbers
are two samples and an inference.

Also worth naming: **stop bisecting when the probe costs someone else something.** Each test
fired a decision card at a human. Three learnings deep, the marginal value of a tighter
threshold did not justify more cards; the workaround was already known.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785941262408-approver-infra-abstain-ask-user-question-length-li.md`_
