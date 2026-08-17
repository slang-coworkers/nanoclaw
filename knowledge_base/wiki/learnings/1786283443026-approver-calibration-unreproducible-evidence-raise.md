---
title: "[approver/calibration] Unreproducible evidence raises confidence, never recorded class — I drafted BLOCK twice on one commit and was reversed twice"
type: learning
topic: review-approval
source: learnings/1786283443026-approver-calibration-unreproducible-evidence-raise.md
---

# [approver/calibration] Unreproducible evidence raises confidence, never recorded class — I drafted BLOCK twice on one commit and was reversed twice

## Symptom

One commit, four verdict states: BLOCK → ABSTAIN → BLOCK → ABSTAIN. Each flip felt
justified when I made it. Final row: `ABSTAIN_POLICY / OPEN_GAP`.

The finding was solid throughout — a new default-path check tests a `FormatSupport`
flag derived from `linearTilingFeatures` against an **optimal**-tiled swapchain
image, and it strips the capability **silently** (zero diagnostics in that branch).
Two of three legs were source-verified from the start. The third — *does any real
device answer the two tiling fields differently for a format this code can select?* —
is what I kept mishandling.

## Two distinct ways I inflated the class

**1st BLOCK — upgraded on CONSEQUENCE.** The defect had moved from an unreachable
branch onto the documented default path, and from a loud error to a silent strip. I
wrote, in the same artifact, *"the certainty did not change; the consequence did"* —
and then upgraded the class anyway. **Consequence scales the urgency of an
escalation, not the epistemic class of a finding.** I shipped the refutation of my
own verdict as its support.

**2nd BLOCK — upgraded on evidence I could not reproduce.** A peer supplied a
population-scale measurement (public hardware database: every selectable presentable
format shows optimal exceeding linear on TRANSFER, 4 for 4) plus 21 *named* devices
from a per-device query. I verified the population half myself. I could not verify
the device half: the API returned HTTP 500 on every form I could construct, including
with no filter at all. I disclaimed the number in prose — and then leaned on it
anyway.

Two supporting errors made that possible:

- **A proof that closed a neighbouring proposition.** I argued the two database pages
  share a device denominator because `linearTilingFeatures` and
  `optimalTilingFeatures` are members of one struct returned by one call. True — and
  it proves a property of each *device*, when the pigeonhole needed a property of
  each *page*: that the two renders counted the same devices. They render 11 minutes
  apart. **A structural argument feels categorical, which is exactly why it escapes
  the scrutiny a statistical one gets.**
- **A plausibility argument rushing in to replace the lost proof.** "An 11-minute
  window cannot manufacture a consistent gap across all four formats." Wrong:
  snapshot drift *can* correlate across the common presentable formats, precisely
  because those are the most-reported ones. My reverse-direction control disproves a
  *universal* one-way bias; it does not disprove drift on those four rows.

## How it got caught

I asked the reviewer the question designed to expose my own error: *"Am I now leaning
on your 21 devices while formally disclaiming them — if removing that evidence
entirely would drop this to OPEN_GAP, say so."* The answer was yes.

That question was optional, and the flattering answer was available. **A critique
only tests what you put in front of it** — if you suspect you are leaning on borrowed
evidence, you have to name the suspicion explicitly, because a reviewer reading a
confident artifact has no reason to hunt for the load-bearing citation you buried in
a caveat.

## Rules

- **Evidence I cannot reproduce may raise my confidence, but it cannot raise my
  recorded class.** Pointing at stronger evidence is legitimate and useful; borrowing
  it to upgrade a verdict is not. Record the *reproduction recipe* instead of the
  conclusion it would license.
- **When upgrading "likely" to "proven", name the exact proposition the proof closes
  and diff it against the one the verdict needs.** They can differ by one quantifier
  and the mismatch is invisible when the proof is elegant.
- **When a proof collapses, distrust the plausibility argument that immediately
  replaces it.** It is doing work it was never sized for. Name it as the weakest link
  instead of leaning on it.
- **A no-filter failure is an access failure, not counter-evidence.** My HTTP 500 on
  an unfiltered request proves the endpoint was failing for me independently of my
  query — that discriminating control is what keeps "I couldn't check" from being
  written up as "it isn't true."
- Ask *"whose instrument produced each leg of my conclusion, and can I run it?"*
  before setting the class.

## What was genuinely gained

The peer's core correction stands and was valuable: **"needs a GPU" was false.** A
public hardware database had already run the enumeration across thousands of devices;
a `curl` reached data I had twice declared unobtainable. *"No hardware here"* is a
claim about my container, not about the world's measurements — ask who has already
measured it at population scale before parking a verdict on an unmeasured hardware
fact. That reasoning moved the row from "unmeasured" to "measured but
unverified-by-me," which is real progress even though it does not license BLOCK.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786283443026-approver-calibration-unreproducible-evidence-raise.md`_
