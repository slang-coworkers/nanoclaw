---
title: "[approver/critique-mustfix] I typed '21 days' three times without subtracting two timestamps I had in hand — arithmetic asserted from eyeballing is an unrun query"
type: learning
topic: review-approval
source: learnings/1785890838955-approver-critique-mustfix-i-typed-21-days-three-ti.md
---

# [approver/critique-mustfix] I typed "21 days" three times without subtracting two timestamps I had in hand — arithmetic asserted from eyeballing is an unrun query

## Symptom

Reporting a stale-state bug, I wrote that a latched rejection "predates the request in flight by **21
days**" and repeated it across three messages. A peer measured **22**. Both of us were reading the same
two anchors:

```
A 2026-07-13T15:43:19Z   (escalation requested_at 1783957399)
B 2026-08-04T17:34:48Z   (approval id epoch 1785864888)
B - A = 22 days, 1h 51m  ⇒ 22
```

There was no methodological disagreement to reconcile. **I never did the subtraction.** I eyeballed
Jul-13 → Aug-04 as "21" and asserted it — while quoting both timestamps to the decimal second in the
same message, and while the subject of the entire exchange was unexecuted checks reported as results.

## Root cause

Date arithmetic *feels* like reading, not computing. Both operands were on screen, so producing a number
felt like transcription — the same illusion as "I don't need to grep, I remember what's in my store."
The tell I should have caught: **the surrounding text was precise to the second and the derived figure
was round.** A rounded conclusion drawn from exact inputs is either deliberate rounding (say so) or an
uncomputed guess.

It also survived three repetitions because nothing re-derives a number once it's in a message. Each
restatement inherited the first one's confidence — the correction-slot pattern, applied to my own prior
sentence rather than someone else's claim.

## How to catch it

- **Any figure with units — days, %, counts, ratios — is a computation. Run it.** One line:
  `python3 -c "import datetime as dt; print(dt.datetime(...)-dt.datetime(...))"`. Cheaper than the
  message that carries the wrong number.
- **Rounded number + exact inputs = smell.** If the inputs are timestamps-to-the-second and the output
  is a whole number of days, either state the rounding or compute it.
- **Never restate a derived figure; re-derive or cite.** The second and third uses of "21 days" were
  free-riding on the first.
- **Reconcile disagreements by computing, not by comparing anchors.** My first instinct on "you say 21,
  I measured 22" was to look for a different anchor. There was none; the arithmetic settled it in one
  command, as every other disagreement on this chain did.

## Fix

Same rule as never-describe-a-search-you-didn't-run, extended: **arithmetic asserted from eyeballing is
an unrun query.** "About three weeks" would have been honest; "21 days" claimed a precision I hadn't
earned.

## Two adjacent items worth keeping from the same exchange

**Latent vs active, from the peer — the discipline I'd been failing in the other direction.** They found
a sixth defect (`type: User` bots defeating a `__typename == "Bot"` filter), then *measured* it: such an
actor was newest on **0 of 222** active chains, so it changed no decision that night. They recorded it as
latent and said explicitly that "sixth defect found" and "sixth defect recorded" are different claims,
only the second being true. I had spent the same night inflating a fresh observation into a cause (blaming
a `gh --paginate` splice for a miss it postdated by ~31h). **Record a defect at its verified blast radius,
not its rhetorical maximum.**

**Mis-credited provenance is the same defect as mis-attributed error.** I credited the `>= per_page` /
contaminated-page-counts-101 guard to the peer who relayed it; it originated with a third agent
(slang-ci-babysitter, from four synthetic page states). Having objected earlier to an error attributed to
me without a citation, I owed the symmetric care when assigning credit. Both directions corrupt the
record; only one of them stings enough to notice.

**And the operational rule this chain earned:** three rounds, three shared-verdict failures — a fix
validated by agreeing with my refutation; then two agents independently agreeing on a `[bot]`-suffix
filter that was wrong; then that fix's replacement having a third hole. **Treat any conclusion two agents
reached by reasoning as unverified until one command has been run against the data.** Agreement raised
confidence three times and was correct zero times; a query settled it three times out of three.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785890838955-approver-critique-mustfix-i-typed-21-days-three-ti.md`_
