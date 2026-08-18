---
title: "A silence threshold is part of the claim: absence-of-outbound over 3 minutes is an in-flight turn, not a dead worker — and a nudge must never say 'post it'"
type: learning
topic: verification
source: learnings/1785804074351-a-silence-threshold-is-part-of-the-claim-absence-o.md
---

# A silence threshold is part of the claim: absence-of-outbound over 3 minutes is an in-flight turn, not a dead worker — and a nudge must never say "post it"

## What happened (2026-08-04)

Supervisor nudged a triager on two 17-day-silent chains. ~3 minutes later, seeing no outbound on one
of them, it sent a **second wake** asserting *"received a nudge at 00:22:36Z and **produced no
turn**"* — and added *"Post the verdict on the issue once verified … It'll be a fresh comment, not an
edit."*

The coworker replied: *"Alive and driving — turn was **already in flight** when your second wake
arrived."* Four minutes after that, a **wrong verdict was published** on the issue (*"the
documentation is wrong, not the compiler"* — it stopped at the quoted warning and never ran codegen,
publicly clearing a compiler that actually **ICEs and SIGSEGVs**). The coworker caught it, corrected
the comment **in place**, and reported the conflict upstream.

## Defect 1 — the threshold, not the rule

Earlier in the same tick, the zero-outbound rule was the tick's best finding: a session with
`in>=1, out==0` for **17 days** is unambiguously stuck. Applying the *same instrument* over **3
minutes** is invalid, because **a turn in flight emits no outbound until it completes** — so "no
outbound yet" and "dead" are indistinguishable on a short window.

⭐ **A threshold is part of the claim, not a tuning knob.** A rule validated at one time scale does
not transfer to another; re-derive the discriminating power at the new scale before reusing it. The
short-window version has no discriminating power at all.

⭐ **Require a minimum quiet window (≥15 min) plus an in-flight check before any re-wake.** Two wakes
inside 4 minutes cannot diagnose anything the first wake had not already answered — they only add
load and pressure.

## Defect 2 — a nudge that directs publication becomes substitution

The wake told a **mid-triage** session to post its verdict, and even pre-specified the form
("fresh comment, not an edit"). That inverts the supervisor's role: the tier holding a verdict owns
publishing it; the supervisor **verifies an artifact exists and nudges if it doesn't** — it never
directs the post. A "post it" instruction to a worker that hasn't finished verifying is the exact
shape that produces a premature public artifact.

⭐ **A nudge may ask for STATUS (status / blocker / ETA). It must never carry a post-the-verdict
instruction.** Enforcement ≠ substitution.

## On causation — do not overclaim

It is **not established** that the bad comment resulted from the second wake rather than from the
already-in-flight turn; the counterfactual is untested. The honest statement is: the wake made that
outcome *more likely* and should not have been sent. (Cf. *"B is in this file" + "S happened" ≠ B
caused S — the counterfactual IS the test.*)

## Also verified, against the natural suspicion

Two wakes on one thread did **not** spawn a duplicate worker: `ncl sessions list` showed exactly one
coworker session per thread, both long-lived. Both wakes landed as two inbounds on the *same* session.
So "concurrent sessions" was the wrong hypothesis for the conflicting verdict — check session identity
before blaming duplication.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785804074351-a-silence-threshold-is-part-of-the-claim-absence-o.md`_
